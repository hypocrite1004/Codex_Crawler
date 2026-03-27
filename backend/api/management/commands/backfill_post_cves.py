from collections import Counter

from django.core.management.base import BaseCommand, CommandError

from api.cve_sync import sync_post_cve_mentions
from api.models import Post


class Command(BaseCommand):
    help = '기존 Post 전체에 대해 CVE auto_extract 백필을 수행합니다.'

    def add_arguments(self, parser):
        parser.add_argument('--post-id', type=int, help='특정 Post 하나만 처리합니다.')
        parser.add_argument('--category', help='특정 category name만 처리합니다.')
        parser.add_argument('--status', help='특정 post status만 처리합니다.')
        parser.add_argument('--limit', type=int, help='처리할 최대 게시글 수')
        parser.add_argument('--batch-size', type=int, default=200, help='iterator chunk 크기')
        parser.add_argument(
            '--source',
            default='auto_extract',
            help='PostCveMention.source 값 (기본: auto_extract)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='실제 저장 없이 예상 변경량만 출력합니다.',
        )

    def handle(self, *args, **options):
        batch_size = max(1, int(options['batch_size']))
        source = (options['source'] or 'auto_extract').strip()
        if source not in {'auto_extract', 'manual', 'legacy_import'}:
            raise CommandError('지원하지 않는 source 값입니다.')

        queryset = Post.objects.select_related('category').order_by('id')
        if options.get('post_id'):
            queryset = queryset.filter(id=options['post_id'])
        if options.get('category'):
            queryset = queryset.filter(category__name__iexact=options['category'])
        if options.get('status'):
            queryset = queryset.filter(status=options['status'])
        if options.get('limit'):
            queryset = queryset[: options['limit']]

        summary = Counter()
        processed = 0

        for post in queryset.iterator(chunk_size=batch_size):
            processed += 1
            result = sync_post_cve_mentions(post, source=source, dry_run=bool(options['dry_run']))

            summary['posts_processed'] += 1
            summary['mentions_created'] += result['created']
            summary['mentions_updated'] += result['updated']
            summary['mentions_removed'] += result['removed']
            summary['mentions_noop'] += result['noop']
            summary['mentions_skipped_existing'] += result['skipped_existing']

            if any(result[key] for key in ('created', 'updated', 'removed')):
                summary['posts_changed'] += 1

            if processed % batch_size == 0:
                self.stdout.write(
                    f"processed={processed} changed={summary['posts_changed']} "
                    f"created={summary['mentions_created']} updated={summary['mentions_updated']} "
                    f"removed={summary['mentions_removed']} skipped_existing={summary['mentions_skipped_existing']}"
                )

        self.stdout.write(self.style.SUCCESS(
            f"완료: posts={summary['posts_processed']} changed={summary['posts_changed']} "
            f"created={summary['mentions_created']} updated={summary['mentions_updated']} "
            f"removed={summary['mentions_removed']} noop={summary['mentions_noop']} "
            f"skipped_existing={summary['mentions_skipped_existing']}"
            + (' (dry-run)' if options['dry_run'] else '')
        ))
