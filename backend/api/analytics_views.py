import re
from collections import Counter
from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CrawlerLog, CrawlerSource, CveRecord, Post
from .serializers import AdminCveRecordSerializer, CveRecordSerializer, PostSerializer
from .view_helpers import IsStaffUser, is_admin_user, is_staff_user


class CveRecordViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CveRecord.objects.all()
    serializer_class = CveRecordSerializer
    permission_classes = [permissions.AllowAny]

    def get_serializer_class(self):
        return AdminCveRecordSerializer if is_staff_user(self.request.user) else CveRecordSerializer

    def get_queryset(self):
        queryset = (
            CveRecord.objects.annotate(
                post_count=Count(
                    'post_mentions__post',
                    filter=Q(post_mentions__post__status='published'),
                    distinct=True,
                )
            )
            .all()
            .order_by('-mention_count', '-last_seen', 'cve_id')
        )
        params = self.request.query_params
        cve_id = params.get('q')
        if cve_id:
            queryset = queryset.filter(cve_id__icontains=cve_id)
        severity = params.get('severity')
        if severity:
            queryset = queryset.filter(severity__iexact=severity)
        tracked = params.get('tracked')
        if is_staff_user(self.request.user):
            if tracked == 'true':
                queryset = queryset.filter(is_tracked=True)
            elif tracked == 'false':
                queryset = queryset.filter(is_tracked=False)
        return queryset

    @action(detail=True, methods=['get'])
    def posts(self, request, pk=None):
        cve = self.get_object()
        posts = (
            Post.objects.filter(cve_mentions__cve=cve, status='published')
            .select_related('author', 'category')
            .order_by('-published_at', '-created_at')
            .distinct()
        )
        return Response(PostSerializer(posts, many=True, context={'request': request}).data)


class DashboardView(APIView):
    permission_classes = [IsStaffUser]

    def get(self, request):
        period = request.query_params.get('period', 'week')
        days = 7 if period == 'week' else 30
        now = timezone.now()
        since = now - timedelta(days=days)
        prev_since = since - timedelta(days=days)

        posts_qs = Post.objects.all()
        period_posts = posts_qs.filter(created_at__gte=since)
        prev_period_posts = posts_qs.filter(created_at__gte=prev_since, created_at__lt=since)

        is_admin = is_admin_user(request.user)
        last_log = CrawlerLog.objects.order_by('-crawled_at').first()
        summary = {
            'total_posts': posts_qs.count(),
            'period_posts': period_posts.count(),
            'prev_period_posts': prev_period_posts.count(),
            'last_crawled_at': last_log.crawled_at.isoformat() if last_log else None,
        }
        if is_admin:
            summary.update({
                'active_sources': CrawlerSource.objects.filter(is_active=True).count(),
                'total_sources': CrawlerSource.objects.count(),
            })

        daily_qs = (
            posts_qs.filter(created_at__gte=now - timedelta(days=days))
            .annotate(date=TruncDate('created_at'))
            .values('date', 'category__name')
            .annotate(count=Count('id'))
            .order_by('date')
        )

        daily_map: dict[str, dict] = {}
        for row in daily_qs:
            date_key = str(row['date'])
            category_name = row['category__name'] or 'Uncategorized'
            if date_key not in daily_map:
                daily_map[date_key] = {'date': date_key, 'total': 0}
            daily_map[date_key][category_name] = daily_map[date_key].get(category_name, 0) + row['count']
            daily_map[date_key]['total'] += row['count']

        daily_trend = []
        for index in range(days):
            date_key = str((now - timedelta(days=days - 1 - index)).date())
            daily_trend.append(daily_map.get(date_key, {'date': date_key, 'total': 0}))

        cat_this = period_posts.values('category__name').annotate(count=Count('id')).order_by('-count')
        cat_prev = prev_period_posts.values('category__name').annotate(count=Count('id'))
        prev_map = {row['category__name']: row['count'] for row in cat_prev}
        category_dist = [
            {'name': row['category__name'] or 'Uncategorized', 'current': row['count'], 'prev': prev_map.get(row['category__name'], 0)}
            for row in cat_this
        ]

        stop_words = {
            'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'over', 'under',
            'news', 'report', 'update', 'analysis', 'today', 'after', 'before', 'about',
            'article', 'security', 'market', 'public', 'system', 'issue', 'group', 'state',
        }

        def extract_keywords(titles):
            words = []
            for title in titles:
                tokens = re.findall(r'[A-Za-z]{2,}', title or '')
                words.extend(token.lower() for token in tokens if token.lower() not in stop_words and len(token) >= 2)
            return Counter(words)

        this_kw = extract_keywords(list(period_posts.values_list('title', flat=True)))
        prev_kw = extract_keywords(list(prev_period_posts.values_list('title', flat=True)))

        trending = []
        for word, count in this_kw.most_common(50):
            prev_count = prev_kw.get(word, 0)
            if count < 2:
                continue
            change_pct = 100 if prev_count == 0 else round((count - prev_count) / prev_count * 100)
            trending.append({'word': word, 'count': count, 'prev_count': prev_count, 'change_pct': change_pct})
        trending.sort(key=lambda item: item['change_pct'], reverse=True)
        trending_keywords = trending[:20]

        recent_posts = list(
            period_posts.filter(parent_post__isnull=True)
            .select_related('category')
            .annotate(related_count=Count('related_posts'))
            .order_by('-created_at')[:20]
            .values('id', 'title', 'site', 'created_at', 'category__name', 'related_count')
        )
        for post in recent_posts:
            post['created_at'] = post['created_at'].isoformat()
            post['category'] = post.pop('category__name') or 'Uncategorized'

        top_cves = list(
            CveRecord.objects.annotate(post_count=Count('post_mentions', distinct=True))
            .filter(post_mentions__post__status='published')
            .values('cve_id', 'severity', 'cvss_score', 'mention_count', 'last_seen', 'post_count')
            .order_by('-post_count', '-mention_count', '-last_seen', 'cve_id')
            .distinct()[:10]
        )
        for row in top_cves:
            row['last_seen'] = row['last_seen'].isoformat() if row['last_seen'] else None

        bubble_data = []
        if is_admin:
            try:
                import numpy as np
                from sklearn.decomposition import PCA

                cluster_posts = list(
                    period_posts.filter(parent_post__isnull=True, embedding__isnull=False)
                    .annotate(related_count=Count('related_posts'))
                    .values('id', 'title', 'embedding', 'related_count', 'category__name')
                )

                if len(cluster_posts) >= 2:
                    embeddings = np.array([post['embedding'] for post in cluster_posts])
                    pca = PCA(n_components=min(2, len(cluster_posts)))
                    coords = pca.fit_transform(embeddings)
                    for index, post in enumerate(cluster_posts):
                        bubble_data.append({
                            'id': post['id'],
                            'title': post['title'],
                            'x': round(float(coords[index][0]), 3) if coords.shape[1] > 0 else 0,
                            'y': round(float(coords[index][1]), 3) if coords.shape[1] > 1 else 0,
                            'z': post['related_count'] * 15 + 20,
                            'related_count': post['related_count'],
                            'category': post['category__name'] or 'Uncategorized',
                        })
            except Exception as exc:
                print(f'[Dashboard API] PCA Error: {exc}')

        return Response({
            'summary': summary,
            'daily_trend': daily_trend,
            'category_dist': category_dist,
            'trending_keywords': trending_keywords,
            'recent_posts': recent_posts,
            'top_cves': top_cves,
            'bubble_data': bubble_data,
        })
