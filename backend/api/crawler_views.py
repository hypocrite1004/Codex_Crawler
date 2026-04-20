from django.db.models import Count
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

    @action(detail=True, methods=['get'])
    def items(self, request, pk=None):
        crawl_run = self.get_object()
        items = crawl_run.items.select_related('post').all()
        return Response(CrawlItemSerializer(items, many=True).data)
