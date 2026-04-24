import json
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Count, Q
from django.utils import timezone

from api.crawler_quality import summarize_quality
from api.models import Post


class Command(BaseCommand):
    help = 'Audit crawler-created post quality without modifying data.'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=7, help='Lookback window based on post created_at. Default: 7.')
        parser.add_argument('--limit', type=int, default=50, help='Maximum number of issue-bearing posts to print. Default: 50.')
        parser.add_argument('--format', choices=['text', 'json'], default='text')
        parser.add_argument('--fail-on-error', action='store_true', help='Exit non-zero when error-severity issues are found.')
        parser.add_argument(
            '--include-source-url-only',
            action='store_true',
            help='Also include recent posts that only have a source_url but no CrawlItem evidence or crawler-system author.',
        )

    def handle(self, *args, **options):
        days = max(1, int(options['days']))
        limit = max(1, int(options['limit']))
        since = timezone.now() - timedelta(days=days)
        crawler_scope = Q(crawl_items__isnull=False) | Q(author__username='crawler-system')
        if options['include_source_url_only']:
            crawler_scope |= Q(source_url__isnull=False) & ~Q(source_url='')

        queryset = (
            Post.objects
            .filter(created_at__gte=since)
            .filter(crawler_scope)
            .annotate(cve_count=Count('cve_mentions', distinct=True))
            .distinct()
            .order_by('-created_at')
        )
        summary = summarize_quality(queryset)

        if options['format'] == 'json':
            payload = {**summary, 'posts': summary['posts'][:limit]}
            self.stdout.write(json.dumps(payload, ensure_ascii=False, indent=2))
        else:
            self.stdout.write(f"Crawler quality audit ({days}d)")
            self.stdout.write(f"Posts checked: {summary['posts_checked']}")
            self.stdout.write(
                f"Issues: {summary['error_count']} error, {summary['warning_count']} warning, {summary['info_count']} info"
            )
            if summary['issues']:
                self.stdout.write("Issue summary:")
                for issue in sorted(summary['issues'].values(), key=lambda item: (item['severity'], item['code'])):
                    self.stdout.write(f"- {issue['severity']} {issue['code']}: {issue['count']} | {issue['message']}")
            if summary['posts']:
                self.stdout.write("Affected posts:")
                for post in summary['posts'][:limit]:
                    issue_codes = ', '.join(issue['code'] for issue in post['issues'])
                    self.stdout.write(f"- #{post['id']} {post['title']} [{issue_codes}]")

        if options['fail_on_error'] and summary['error_count']:
            raise CommandError(f"Crawler quality audit found {summary['error_count']} error issue(s).")
