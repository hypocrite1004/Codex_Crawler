from rest_framework import viewsets, permissions, generics, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.models import User
from django.db.models import Count, Q
from django.utils.html import strip_tags
from django.utils import timezone
from .models import (
    Post,
    Category,
    Comment,
    AIConfig,
    CrawlerSource,
    CrawlerLog,
    CrawlRun,
    CveRecord,
    PostCveMention,
)
from .serializers import (
    PostSerializer,
    PostListSerializer,
    AdminPostListSerializer,
    CategorySerializer,
    PublicUserSerializer,
    ProfileSerializer,
    RegisterSerializer,
    CommentSerializer,
    AIConfigSerializer,
    CrawlerSourceSerializer,
    CrawlerLogSerializer,
    CrawlRunSerializer,
    CrawlItemSerializer,
    CveRecordSerializer,
    AdminCveRecordSerializer,
)
from .crawler_security import CrawlerSecurityError, validate_crawler_request_config
from .post_helpers import apply_post_status as _apply_post_status
from .post_helpers import generate_summary_payload, normalize_summary_payload
import os
import re
from urllib.parse import urlparse
from .cve_sync import sync_post_cve_mentions


def is_staff_user(user) -> bool:
    return bool(getattr(user, 'is_authenticated', False) and getattr(user, 'is_staff', False))


def is_admin_user(user) -> bool:
    return bool(getattr(user, 'is_authenticated', False) and getattr(user, 'is_superuser', False))


class IsStaffUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_staff_user(request.user)


class IsSuperUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_admin_user(request.user)


def sanitize_rich_text(html_content: str) -> str:
    """Allow a limited HTML subset for editor content and strip executable payloads."""
    if not html_content:
        return ""

    from bs4 import BeautifulSoup, Comment as BsComment

    allowed_tags = {
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
        'a', 'h1', 'h2', 'h3',
    }
    removable_tags = {'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta'}
    allowed_attrs = {'a': {'href', 'target', 'rel'}}

    soup = BeautifulSoup(html_content, 'html.parser')

    for comment in soup.find_all(string=lambda text: isinstance(text, BsComment)):
        comment.extract()

    for tag_name in removable_tags:
        for tag in soup.find_all(tag_name):
            tag.decompose()

    for tag in soup.find_all(True):
        if tag.name not in allowed_tags:
            tag.unwrap()
            continue

        cleaned_attrs: dict[str, str] = {}
        for attr, value in tag.attrs.items():
            if attr not in allowed_attrs.get(tag.name, set()):
                continue

            value_str = ' '.join(value) if isinstance(value, list) else str(value)
            value_str = value_str.strip()

            if tag.name == 'a' and attr == 'href':
                parsed = urlparse(value_str)
                if value_str.startswith('#') or parsed.scheme in {'http', 'https', 'mailto'}:
                    cleaned_attrs['href'] = value_str
            elif tag.name == 'a' and attr == 'target' and value_str == '_blank':
                cleaned_attrs['target'] = '_blank'

        if tag.name == 'a' and 'href' in cleaned_attrs:
            cleaned_attrs['rel'] = 'noopener noreferrer'

        tag.attrs = cleaned_attrs

    return str(soup).strip()

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all()
    serializer_class = PublicUserSerializer
    permission_classes = [permissions.IsAuthenticated]

class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]

class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = Comment.objects.select_related('author', 'post', 'post__author')
        if is_staff_user(self.request.user):
            return queryset
        if not self.request.user.is_authenticated:
            return queryset.none()
        return queryset.filter(author=self.request.user)

    def list(self, request, *args, **kwargs):
        if not is_staff_user(request.user):
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return super().list(request, *args, **kwargs)

    def perform_update(self, serializer):
        from rest_framework.exceptions import PermissionDenied
        from rest_framework.exceptions import ValidationError
        if serializer.instance.author.id != self.request.user.id and not is_staff_user(self.request.user):
            raise PermissionDenied("You do not have permission to edit this comment.")
        sanitized_content = sanitize_rich_text(serializer.validated_data.get('content', serializer.instance.content))
        if not strip_tags(sanitized_content).strip():
            raise ValidationError({"content": "This field may not be blank."})
        serializer.save(content=sanitized_content)

    def perform_destroy(self, instance):
        from rest_framework.exceptions import PermissionDenied
        if instance.author.id != self.request.user.id and not is_staff_user(self.request.user):
            raise PermissionDenied("You do not have permission to delete this comment.")
        instance.delete()
from .post_views import PostViewSet


class AIConfigView(APIView):
    """
    GET  /api/ai-config/  -> return current AI config (authenticated)
    PUT  /api/ai-config/  -> update AI config (staff only)
    """
    permission_classes = [IsSuperUser]

    def get(self, request):
        config = AIConfig.get_config()
        serializer = AIConfigSerializer(config)
        return Response(serializer.data)

    def put(self, request):
        config = AIConfig.get_config()
        serializer = AIConfigSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TestClusteringView(APIView):
    """
    POST /api/ai-config/test_clustering/ 
    -> Simulate clustering of recent 50 posts using provided threshold
    """
    permission_classes = [IsSuperUser]

    def post(self, request):
        try:
            threshold = float(request.data.get('threshold', 0.2))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid threshold value'}, status=status.HTTP_400_BAD_REQUEST)

        import numpy as np
        
        # ?轅붽틓????彛???????밸븶???????????곗뒭??????棺堉?댆洹ⓦ럹?50???????('News' ???ㅳ늾???雅?퍔瑗?????숈?????癲ル슢???? ???袁⑸즴???????????????????????ル봿????꿔꺂????紐꺪?
        posts_qs = Post.objects.filter(
            embedding__isnull=False, 
            category__name__iexact='news'
        ).order_by('-created_at')[:50]
        posts = list(posts_qs)
        # ?????????????濚밸Ŧ援잏몭????蹂κ텤??????袁ｋ쨨????????潁???>?轅붽틓????彛????????????꿔꺂???影??
        posts.reverse()

        if not posts:
            return Response({'clusters': [], 'unclustered_count': 0, 'total_tested': 0})

        def cosine_dist(v1, v2):
            if np.linalg.norm(v1) == 0 or np.linalg.norm(v2) == 0:
                return 1.0
            return 1 - (np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2)))

        virtual_parents = {p.id: None for p in posts}
        
        for i, p in enumerate(posts):
            p_vec = np.array(p.embedding)
            best_dist = 1.0
            best_parent_id = None
            
            # ??潁??????癲ル슢理???貫????i???ル봿?? ???) ?????꿔꺂???癰귥쥓夷???????
            for j in range(i):
                prev_p = posts[j]
                # ???? ????袁ㅻ쇀???紐꽷????쎛?????癲?????????꿔꺂???癰?彛????????????밸븶?癲?
                if virtual_parents[prev_p.id] is None:
                    prev_vec = np.array(prev_p.embedding)
                    dist = cosine_dist(p_vec, prev_vec)
                    
                    if dist < best_dist and dist < threshold:
                        best_dist = dist
                        best_parent_id = prev_p.id
            
            if best_parent_id is not None:
                virtual_parents[p.id] = best_parent_id

        # ????얠뺏癲??節뉖뙕????β뼯援???????곗뒭????
        clusters = {}
        for p in posts:
            parent_id = virtual_parents[p.id]
            if parent_id is None:
                clusters[p.id] = {'parent': p.title, 'children': []}
            else:
                clusters[parent_id]['children'].append(p.title)

        # ???癲??1???????鶯???????뀀땽 (???濚밸Ŧ?김???????욱룏? ????얠뺏癲??節뉖뙕? ????????ш끽維?猿놁녇?????살퓢癲??
        result = [c for c in clusters.values() if len(c['children']) > 0]
        unclustered_count = sum(1 for c in clusters.values() if len(c['children']) == 0)

        return Response({
            'clusters': result,
            'unclustered_count': unclustered_count,
            'total_tested': len(posts)
        })


class AIModelsView(APIView):
    """
    GET /api/ai-models/ -> return list of available OpenAI models
    """
    permission_classes = [IsSuperUser]

    def get(self, request):
        api_key = os.environ.get('OPENAI_API_KEY', '')
        if not api_key or api_key.startswith('sk-dummy'):
            # Return curated fallback list when no real key
            fallback = [
                {'id': 'gpt-5', 'category': 'GPT-5'},
                {'id': 'gpt-5-mini', 'category': 'GPT-5'},
                {'id': 'gpt-5-nano', 'category': 'GPT-5'},
                {'id': 'gpt-4.1', 'category': 'GPT-4.1'},
                {'id': 'gpt-4o', 'category': 'GPT-4o'},
                {'id': 'gpt-4o-mini', 'category': 'GPT-4o'},
                {'id': 'o4-mini', 'category': 'o-series'},
                {'id': 'o4-mini-high', 'category': 'o-series'},
                {'id': 'gpt-3.5-turbo', 'category': 'Legacy'},
            ]
            return Response({'models': fallback, 'source': 'fallback'})

        try:
            client = OpenAI(api_key=api_key)
            all_models = client.models.list()

            # Filter to chat-capable models only and sort
            CHAT_PREFIXES = ('gpt-', 'o1', 'o3', 'o4', 'chatgpt-')
            chat_models = sorted(
                [m for m in all_models.data if m.id.startswith(CHAT_PREFIXES)],
                key=lambda m: m.id,
                reverse=True,
            )

            def categorize(model_id):
                if model_id.startswith('gpt-5'):    return 'GPT-5'
                if model_id.startswith('gpt-4.1'):  return 'GPT-4.1'
                if model_id.startswith('gpt-4o'):   return 'GPT-4o'
                if model_id.startswith('gpt-4'):    return 'GPT-4'
                if model_id.startswith('o4'):       return 'o-series'
                if model_id.startswith('o3'):       return 'o-series'
                if model_id.startswith('o1'):       return 'o-series'
                if model_id.startswith('gpt-3'):    return 'Legacy'
                return 'Other'

            result = [
                {'id': m.id, 'category': categorize(m.id)}
                for m in chat_models
            ]
            return Response({'models': result, 'source': 'openai'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)


# ?????? Crawler Views ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

class CrawlerSourceViewSet(viewsets.ModelViewSet):
    """Crawler source CRUD, manual crawl, preview, and log access."""

    queryset = CrawlerSource.objects.all().order_by('-created_at')
    serializer_class = CrawlerSourceSerializer
    permission_classes = [IsSuperUser]

    def get_permissions(self):
        return [IsSuperUser()]

    @action(detail=True, methods=['post'])
    def crawl(self, request, pk=None):
        """Run a crawl immediately for the selected source."""
        source = self.get_object()
        try:
            validate_crawler_request_config(source)
        except CrawlerSecurityError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        if not source.is_active:
            return Response({'error': 'Source is inactive.'}, status=status.HTTP_400_BAD_REQUEST)

        from .crawler import run_crawl

        result = run_crawl(source, triggered_by='manual')
        if result['status'] == 'running':
            return Response(result, status=status.HTTP_409_CONFLICT)
        if result['status'] == 'error':
            return Response({'status': 'error', 'error': 'Crawl failed.'}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(result)

    @action(detail=True, methods=['get'])
    def logs(self, request, pk=None):
        """Return the latest crawl logs for this source."""
        source = self.get_object()
        logs = source.logs.only(
            'id',
            'source_id',
            'status',
            'articles_found',
            'articles_created',
            'error_message',
            'triggered_by',
            'attempt_count',
            'duration_seconds',
            'crawled_at',
        )[:20]
        return Response(CrawlerLogSerializer(logs, many=True).data)

    @action(detail=True, methods=['get'])
    def runs(self, request, pk=None):
        """Return the latest crawl runs for this source."""
        source = self.get_object()
        runs = source.runs.annotate(item_count=Count('items')).only(
            'id',
            'source_id',
            'triggered_by',
            'status',
            'started_at',
            'finished_at',
            'attempt_count',
            'articles_found',
            'articles_created',
            'duplicate_count',
            'filtered_count',
            'error_count',
            'duration_seconds',
            'error_message',
        )[:20]
        return Response(CrawlRunSerializer(runs, many=True).data)

    @action(detail=False, methods=['post'])
    def preview(self, request):
        """Preview crawl results without saving posts."""
        from .crawler import preview_crawl

        data = request.data
        if not data.get('url'):
            return Response({'error': 'URL is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_crawler_request_config(data)
        except CrawlerSecurityError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        result = preview_crawl(data, limit=10)
        if result['status'] == 'error':
            return Response({'status': 'error', 'error': 'Preview failed.'}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(result)
class CrawlerRunViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CrawlRun.objects.select_related('source').annotate(item_count=Count('items')).all().order_by('-started_at')
    serializer_class = CrawlRunSerializer
    permission_classes = [IsSuperUser]

    def get_queryset(self):
        queryset = super().get_queryset()
        source_id = self.request.query_params.get('source')
        if source_id:
            queryset = queryset.filter(source_id=source_id)
        return queryset

    @action(detail=True, methods=['get'])
    def items(self, request, pk=None):
        crawl_run = self.get_object()
        items = crawl_run.items.select_related('post').all()
        return Response(CrawlItemSerializer(items, many=True).data)


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
        from collections import Counter
        from datetime import timedelta

        from django.db.models import Count
        from django.db.models.functions import TruncDate
        from django.utils import timezone

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

        cat_this = (
            period_posts.values('category__name')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        cat_prev = prev_period_posts.values('category__name').annotate(count=Count('id'))
        prev_map = {row['category__name']: row['count'] for row in cat_prev}
        category_dist = [
            {
                'name': row['category__name'] or 'Uncategorized',
                'current': row['count'],
                'prev': prev_map.get(row['category__name'], 0),
            }
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
                words.extend(
                    token.lower()
                    for token in tokens
                    if token.lower() not in stop_words and len(token) >= 2
                )
            return Counter(words)

        this_kw = extract_keywords(list(period_posts.values_list('title', flat=True)))
        prev_kw = extract_keywords(list(prev_period_posts.values_list('title', flat=True)))

        trending = []
        for word, count in this_kw.most_common(50):
            prev_count = prev_kw.get(word, 0)
            if count < 2:
                continue
            change_pct = 100 if prev_count == 0 else round((count - prev_count) / prev_count * 100)
            trending.append({
                'word': word,
                'count': count,
                'prev_count': prev_count,
                'change_pct': change_pct,
            })
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
