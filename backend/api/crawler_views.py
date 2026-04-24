from datetime import timedelta

from django.conf import settings
from django.db.models import Count, Max, Q, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .crawler_quality import analyze_post_quality, summarize_quality_by_source
from .crawler_security import CrawlerSecurityError, validate_crawler_request_config
from .models import CrawlerSource, CrawlRun, Post
from .serializers import CrawlerLogSerializer, CrawlerSourceSerializer, CrawlItemSerializer, CrawlRunSerializer
from .view_helpers import IsSuperUser


class CrawlerSourceViewSet(viewsets.ModelViewSet):
    queryset = CrawlerSource.objects.all().order_by('-created_at')
    serializer_class = CrawlerSourceSerializer
    permission_classes = [IsSuperUser]

    def get_permissions(self):
        return [IsSuperUser()]

    @action(detail=True, methods=['post'])
    def crawl(self, request, pk=None):
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
        source = self.get_object()
        logs = source.logs.only(
            'id', 'source_id', 'status', 'articles_found', 'articles_created',
            'error_message', 'triggered_by', 'attempt_count', 'duration_seconds', 'crawled_at',
        )[:20]
        return Response(CrawlerLogSerializer(logs, many=True).data)

    @action(detail=True, methods=['get'])
    def runs(self, request, pk=None):
        source = self.get_object()
        runs = source.runs.annotate(item_count=Count('items')).only(
            'id', 'source_id', 'triggered_by', 'status', 'started_at', 'finished_at',
            'attempt_count', 'articles_found', 'articles_created', 'duplicate_count',
            'filtered_count', 'error_count', 'duration_seconds', 'error_message',
        )[:20]
        return Response(CrawlRunSerializer(runs, many=True).data)

    @action(detail=True, methods=['get'])
    def quality(self, request, pk=None):
        source = self.get_object()
        try:
            days = min(90, max(1, int(request.query_params.get('days', 7))))
            limit = min(50, max(1, int(request.query_params.get('limit', 20))))
        except (TypeError, ValueError):
            return Response({'error': 'days and limit must be integers.'}, status=status.HTTP_400_BAD_REQUEST)
        since = timezone.now() - timedelta(days=days)
        posts = (
            Post.objects
            .filter(created_at__gte=since, crawl_items__run__source=source)
            .annotate(cve_count=Count('cve_mentions', distinct=True))
            .prefetch_related('crawl_items__run__source')
            .distinct()
            .order_by('-created_at')
        )
        summary = summarize_quality_by_source(posts)
        source_summary = next(
            (item for item in summary['sources'] if item['source_id'] == source.id),
            self._empty_quality_summary(source),
        )
        return Response({
            'source': {
                'id': source.id,
                'name': source.name,
                'is_active': source.is_active,
                'health_status': source.health_status(),
                'last_error_message': source.last_error_message,
            },
            'lookback_days': days,
            'summary': source_summary,
            'affected_posts': self._affected_quality_posts(source, posts, limit),
            'latest_run_id': source.runs.order_by('-started_at').values_list('id', flat=True).first(),
            'recommended_actions': self._quality_recommendations(source_summary),
        })

    @action(detail=True, methods=['post'])
    def mark_needs_review(self, request, pk=None):
        source = self.get_object()
        if source.is_running:
            return Response({'error': 'Source is currently running.'}, status=status.HTTP_409_CONFLICT)

        reason = (request.data.get('reason') or 'Quality remediation requested by operator.').strip()
        source.is_active = False
        source.last_status = 'error'
        source.last_error_message = f'Needs selector review: {reason}'
        source.save(update_fields=['is_active', 'last_status', 'last_error_message'])
        return Response({
            'status': 'needs_review',
            'source': CrawlerSourceSerializer(source).data,
        })

    @action(detail=False, methods=['post'])
    def preview(self, request):
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

    def _affected_quality_posts(self, source, posts, limit):
        affected_posts = []
        for post in posts:
            issues = analyze_post_quality(post)
            if not issues:
                continue
            crawl_item = next(
                (
                    item for item in post.crawl_items.all()
                    if getattr(getattr(item, 'run', None), 'source_id', None) == source.id
                ),
                None,
            )
            affected_posts.append({
                'post_id': post.id,
                'title': post.title,
                'source_url': post.source_url,
                'created_at': post.created_at.isoformat() if post.created_at else None,
                'crawl_item_id': crawl_item.id if crawl_item else None,
                'run_id': crawl_item.run_id if crawl_item else None,
                'issues': [
                    {
                        'code': issue.code,
                        'severity': issue.severity,
                        'message': issue.message,
                    }
                    for issue in issues
                ],
            })
            if len(affected_posts) >= limit:
                break
        return affected_posts

    def _empty_quality_summary(self, source):
        return {
            'source_id': source.id,
            'source_name': source.name,
            'posts_checked': 0,
            'error_count': 0,
            'warning_count': 0,
            'info_count': 0,
            'issue_count': 0,
            'quality_status': 'ok',
            'issues': [],
        }

    def _quality_recommendations(self, summary):
        issue_codes = {issue['code'] for issue in summary.get('issues', [])}
        recommendations = []
        if issue_codes & {'missing_title', 'missing_content', 'short_content'}:
            recommendations.append('Review title/content selectors and run Preview before re-enabling the source.')
        if 'missing_published_at' in issue_codes:
            recommendations.append('Review date selector or feed published date mapping.')
        if issue_codes & {'missing_source_url', 'missing_normalized_source_url', 'normalized_source_url_mismatch'}:
            recommendations.append('Review link selector and URL normalization for this source.')
        if 'missing_security_context' in issue_codes:
            recommendations.append('Review extraction/enrichment coverage for CVE and IOC context.')
        if not recommendations:
            recommendations.append('No remediation action is required for the current lookback window.')
        return recommendations


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

    @action(detail=False, methods=['get'])
    def metrics(self, request):
        now = timezone.now()
        periods = {
            '24h': self._summarize_period(now - timedelta(hours=24)),
            '7d': self._summarize_period(now - timedelta(days=7)),
        }
        since_7d = now - timedelta(days=7)
        quality = self._summarize_quality_sources(since_7d)
        return Response({
            'periods': periods,
            'sources': self._summarize_sources(since_7d, quality),
            'quality': quality,
            'alerts': self._summarize_alerts(now, since_7d, quality),
        })

    @action(detail=True, methods=['get'])
    def items(self, request, pk=None):
        crawl_run = self.get_object()
        items = crawl_run.items.select_related('post').all()
        return Response(CrawlItemSerializer(items, many=True).data)

    def _summarize_period(self, since):
        queryset = CrawlRun.objects.filter(started_at__gte=since)
        aggregate = queryset.aggregate(
            total_runs=Count('id'),
            successful_runs=Count('id', filter=Q(status__in=['success', 'playwright_fallback'])),
            failed_runs=Count('id', filter=Q(status='error')),
            running_runs=Count('id', filter=Q(status='running')),
            articles_found=Sum('articles_found'),
            articles_created=Sum('articles_created'),
            duplicate_count=Sum('duplicate_count'),
            filtered_count=Sum('filtered_count'),
            error_count=Sum('error_count'),
            duration_seconds=Sum('duration_seconds'),
        )
        total_runs = aggregate['total_runs'] or 0
        successful_runs = aggregate['successful_runs'] or 0
        return {
            'since': since.isoformat(),
            'total_runs': total_runs,
            'successful_runs': successful_runs,
            'failed_runs': aggregate['failed_runs'] or 0,
            'running_runs': aggregate['running_runs'] or 0,
            'success_rate': round((successful_runs / total_runs) * 100, 1) if total_runs else 0,
            'articles_found': aggregate['articles_found'] or 0,
            'articles_created': aggregate['articles_created'] or 0,
            'duplicate_count': aggregate['duplicate_count'] or 0,
            'filtered_count': aggregate['filtered_count'] or 0,
            'error_count': aggregate['error_count'] or 0,
            'duration_seconds': aggregate['duration_seconds'] or 0,
        }

    def _summarize_sources(self, since, quality_summary=None):
        quality_by_source = {
            item['source_id']: item
            for item in (quality_summary or {}).get('sources', [])
            if item.get('source_id') is not None
        }
        sources = (
            CrawlerSource.objects
            .annotate(
                recent_runs=Count('runs', filter=Q(runs__started_at__gte=since)),
                successful_runs=Count('runs', filter=Q(runs__started_at__gte=since, runs__status__in=['success', 'playwright_fallback'])),
                failed_runs=Count('runs', filter=Q(runs__started_at__gte=since, runs__status='error')),
                articles_created=Sum('runs__articles_created', filter=Q(runs__started_at__gte=since)),
                item_errors=Sum('runs__error_count', filter=Q(runs__started_at__gte=since)),
                last_run_at=Max('runs__started_at'),
            )
            .filter(recent_runs__gt=0)
            .order_by('-failed_runs', '-recent_runs', 'name')[:12]
        )
        result = []
        for source in sources:
            recent_runs = source.recent_runs or 0
            successful_runs = source.successful_runs or 0
            quality = quality_by_source.get(source.id, self._empty_source_quality(source))
            result.append({
                'source_id': source.id,
                'source_name': source.name,
                'health_status': source.health_status(),
                'recent_runs': recent_runs,
                'successful_runs': successful_runs,
                'failed_runs': source.failed_runs or 0,
                'success_rate': round((successful_runs / recent_runs) * 100, 1) if recent_runs else 0,
                'articles_created': source.articles_created or 0,
                'item_errors': source.item_errors or 0,
                'last_run_at': source.last_run_at.isoformat() if source.last_run_at else None,
                'quality': quality,
            })
        return result

    def _summarize_quality_sources(self, since):
        posts = (
            Post.objects
            .filter(created_at__gte=since, crawl_items__isnull=False)
            .annotate(cve_count=Count('cve_mentions', distinct=True))
            .prefetch_related('crawl_items__run__source')
            .distinct()
            .order_by('-created_at')
        )
        return summarize_quality_by_source(posts)

    def _empty_source_quality(self, source):
        return {
            'source_id': source.id,
            'source_name': source.name,
            'posts_checked': 0,
            'error_count': 0,
            'warning_count': 0,
            'info_count': 0,
            'issue_count': 0,
            'quality_status': 'ok',
            'issues': [],
        }

    def _summarize_alerts(self, now, since, quality_summary=None):
        stale_cutoff = now - timedelta(minutes=max(10, int(getattr(settings, 'CRAWLER_STALE_RUN_MINUTES', 120))))
        sources = (
            CrawlerSource.objects
            .annotate(
                recent_runs=Count('runs', filter=Q(runs__started_at__gte=since)),
                successful_runs=Count('runs', filter=Q(runs__started_at__gte=since, runs__status__in=['success', 'playwright_fallback'])),
                failed_runs=Count('runs', filter=Q(runs__started_at__gte=since, runs__status='error')),
                articles_created=Sum('runs__articles_created', filter=Q(runs__started_at__gte=since)),
                duplicate_count=Sum('runs__duplicate_count', filter=Q(runs__started_at__gte=since)),
                filtered_count=Sum('runs__filtered_count', filter=Q(runs__started_at__gte=since)),
                item_errors=Sum('runs__error_count', filter=Q(runs__started_at__gte=since)),
            )
            .order_by('name')
        )
        alerts = []
        for source in sources:
            recent_runs = source.recent_runs or 0
            successful_runs = source.successful_runs or 0
            failed_runs = source.failed_runs or 0
            item_errors = source.item_errors or 0
            item_total = (
                (source.articles_created or 0)
                + (source.duplicate_count or 0)
                + (source.filtered_count or 0)
                + item_errors
            )

            if source.is_running and (
                source.last_run_started_at is None or source.last_run_started_at < stale_cutoff
            ):
                alerts.append(self._alert(source, 'error', 'stale_running', 'Crawler run may be stuck', 'The source has been running longer than the stale lock timeout. Recovery will mark it failed before the next run.'))

            if recent_runs >= 3 and failed_runs / recent_runs >= 0.5:
                alerts.append(self._alert(source, 'error', 'high_failure_rate', 'High failure rate', f'{failed_runs}/{recent_runs} runs failed in the last 7 days.'))
            elif recent_runs > 0 and successful_runs == 0:
                alerts.append(self._alert(source, 'warning', 'no_recent_success', 'No recent successful runs', 'The source has run recently but has no successful run in the last 7 days.'))

            if item_total >= 4 and item_errors / item_total >= 0.25:
                alerts.append(self._alert(source, 'warning', 'high_item_error_rate', 'High item error rate', f'{item_errors}/{item_total} recorded items failed in the last 7 days.'))

        for quality in (quality_summary or {}).get('sources', []):
            if quality['error_count']:
                alerts.append({
                    'source_id': quality['source_id'],
                    'source_name': quality['source_name'],
                    'severity': 'error',
                    'category': 'quality_error_findings',
                    'title': 'Stored content quality errors',
                    'message': f"{quality['error_count']} error issue(s) across {quality['posts_checked']} recent post(s).",
                })
            elif quality['warning_count']:
                alerts.append({
                    'source_id': quality['source_id'],
                    'source_name': quality['source_name'],
                    'severity': 'warning',
                    'category': 'quality_warning_findings',
                    'title': 'Stored content quality warnings',
                    'message': f"{quality['warning_count']} warning issue(s) across {quality['posts_checked']} recent post(s).",
                })

        severity_order = {'error': 0, 'warning': 1}
        return sorted(alerts, key=lambda alert: (severity_order.get(alert['severity'], 2), alert['source_name'], alert['category']))[:12]

    def _alert(self, source, severity, category, title, message):
        return {
            'source_id': source.id,
            'source_name': source.name,
            'severity': severity,
            'category': category,
            'title': title,
            'message': message,
        }
