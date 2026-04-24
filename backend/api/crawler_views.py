from datetime import timedelta

from django.db.models import Count, Max, Q, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .crawler_security import CrawlerSecurityError, validate_crawler_request_config
from .models import CrawlerSource, CrawlRun
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
        return Response({
            'periods': periods,
            'sources': self._summarize_sources(now - timedelta(days=7)),
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

    def _summarize_sources(self, since):
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
            })
        return result
