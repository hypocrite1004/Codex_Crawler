import json

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import Category, Comment, CrawlItem, CrawlerLog, CrawlerSource, CrawlRun, CveRecord, Post, PostCveMention


class Command(BaseCommand):
    help = 'Seed deterministic data for Playwright E2E flows.'

    def handle(self, *args, **options):
        now = timezone.now()

        news, _ = Category.objects.get_or_create(
            name='news',
            defaults={'description': 'E2E seeded category'},
        )

        author, _ = User.objects.update_or_create(
            username='qa_author',
            defaults={'email': 'qa_author@example.com', 'is_staff': False, 'is_superuser': False},
        )
        author.set_password('password123')
        author.save(update_fields=['password'])

        staff, _ = User.objects.update_or_create(
            username='qa_staff',
            defaults={'email': 'qa_staff@example.com', 'is_staff': True, 'is_superuser': False},
        )
        staff.set_password('password123')
        staff.save(update_fields=['password'])

        admin, _ = User.objects.update_or_create(
            username='qa_admin',
            defaults={'email': 'qa_admin@example.com', 'is_staff': True, 'is_superuser': True},
        )
        admin.set_password('password123')
        admin.save(update_fields=['password'])

        published_no_summary, _ = Post.objects.update_or_create(
            title='E2E Published News Without Summary',
            defaults={
                'content': '<p>E2E published content without summary.</p>',
                'category': news,
                'author': author,
                'site': 'E2E Source',
                'source_url': 'https://example.com/e2e-published-without-summary',
                'is_shared': False,
                'is_summarized': False,
                'summary': '',
                'is_draft': False,
                'status': 'published',
                'published_at': now,
                'approval_requested_at': None,
                'approved_by': staff,
                'approved_at': now,
                'rejected_by': None,
                'rejected_at': None,
                'rejection_reason': '',
                'archived_at': None,
            },
        )

        published_with_summary, _ = Post.objects.update_or_create(
            title='E2E Published News With Summary',
            defaults={
                'content': '<p>E2E published content with summary.</p>',
                'category': news,
                'author': author,
                'site': 'E2E Source',
                'source_url': 'https://example.com/e2e-published-with-summary',
                'is_shared': True,
                'is_summarized': True,
                'summary': json.dumps({'title': 'Seeded Summary', 'summary': 'Seeded summary body'}, ensure_ascii=False),
                'is_draft': False,
                'status': 'published',
                'published_at': now,
                'approval_requested_at': None,
                'approved_by': staff,
                'approved_at': now,
                'rejected_by': None,
                'rejected_at': None,
                'rejection_reason': '',
                'archived_at': None,
            },
        )

        review_post, _ = Post.objects.update_or_create(
            title='E2E Review Intel',
            defaults={
                'content': '<p>E2E review content.</p>',
                'category': news,
                'author': author,
                'site': 'E2E Source',
                'source_url': 'https://example.com/e2e-review',
                'is_shared': False,
                'is_summarized': False,
                'summary': '',
                'is_draft': True,
                'status': 'review',
                'approval_requested_at': now,
                'approved_by': None,
                'approved_at': None,
                'rejected_by': None,
                'rejected_at': None,
                'rejection_reason': '',
                'archived_at': None,
            },
        )

        draft_post, _ = Post.objects.update_or_create(
            title='E2E Draft Intel',
            defaults={
                'content': '<p>E2E draft content.</p>',
                'category': news,
                'author': author,
                'site': 'E2E Source',
                'source_url': 'https://example.com/e2e-draft',
                'is_shared': False,
                'is_summarized': False,
                'summary': '',
                'is_draft': True,
                'status': 'draft',
                'approval_requested_at': None,
                'approved_by': None,
                'approved_at': None,
                'rejected_by': None,
                'rejected_at': None,
                'rejection_reason': '',
                'archived_at': None,
            },
        )

        hidden_post, _ = Post.objects.update_or_create(
            title='E2E Hidden Draft Intel',
            defaults={
                'content': '<p>Hidden draft content.</p>',
                'category': news,
                'author': author,
                'site': 'E2E Source',
                'source_url': 'https://example.com/e2e-hidden-draft',
                'is_shared': False,
                'is_summarized': False,
                'summary': '',
                'is_draft': True,
                'status': 'draft',
                'approval_requested_at': None,
                'approved_by': None,
                'approved_at': None,
                'rejected_by': None,
                'rejected_at': None,
                'rejection_reason': '',
                'archived_at': None,
            },
        )

        Comment.objects.filter(post=published_no_summary).delete()
        Comment.objects.create(
            post=published_no_summary,
            author=author,
            content='<p>E2E seeded comment from author.</p>',
        )

        cve, _ = CveRecord.objects.update_or_create(
            cve_id='CVE-2026-10001',
            defaults={
                'description': 'E2E seeded CVE record.',
                'severity': 'HIGH',
                'cvss_score': 8.8,
                'vendor': 'E2E Vendor',
                'product': 'E2E Product',
                'mention_count': 1,
                'legacy_mention_count': 0,
                'first_seen': now,
                'last_seen': now,
                'is_tracked': False,
                'notes': '',
            },
        )
        PostCveMention.objects.update_or_create(
            post=published_with_summary,
            cve=cve,
            defaults={
                'source': 'manual',
                'mentioned_in': 'content',
                'legacy_reference_ids': [],
            },
        )

        crawler_source, _ = CrawlerSource.objects.update_or_create(
            name='E2E Crawler Diagnostics',
            defaults={
                'url': 'https://example.com/e2e-feed.xml',
                'source_type': 'rss',
                'is_active': True,
                'category': news,
                'crawl_interval': 60,
                'last_crawled_at': now,
                'last_success_at': now,
                'last_run_started_at': now,
                'last_status': 'success',
                'consecutive_failures': 0,
                'max_retries': 2,
                'retry_backoff_minutes': 10,
                'auto_disable_after_failures': 5,
            },
        )
        if not CrawlerLog.objects.filter(source=crawler_source, triggered_by='manual', articles_found=4, articles_created=1).exists():
            CrawlerLog.objects.create(
                source=crawler_source,
                status='success',
                articles_found=4,
                articles_created=1,
                triggered_by='manual',
                attempt_count=1,
                duration_seconds=3,
            )
        crawl_run = (
            CrawlRun.objects
            .filter(source=crawler_source, articles_found=4, articles_created=1, duplicate_count=1, filtered_count=1, error_count=1)
            .order_by('id')
            .first()
        )
        if crawl_run is None:
            crawl_run = CrawlRun.objects.create(
                source=crawler_source,
                triggered_by='manual',
                status='success',
                started_at=now,
                finished_at=now,
                attempt_count=1,
                articles_found=4,
                articles_created=1,
                duplicate_count=1,
                filtered_count=1,
                error_count=1,
                duration_seconds=3,
            )
        for item in [
            {
                'post': published_with_summary,
                'item_status': 'created',
                'source_url': 'https://example.com/e2e-created',
                'normalized_url': 'https://example.com/e2e-created',
                'title': 'E2E Created Crawl Item',
                'error_message': '',
                'payload': {'title': 'E2E Created Crawl Item'},
            },
            {
                'post': None,
                'item_status': 'duplicate',
                'source_url': 'https://example.com/e2e-duplicate',
                'normalized_url': 'https://example.com/e2e-duplicate',
                'title': 'E2E Duplicate Crawl Item',
                'error_message': 'Duplicate source URL',
                'payload': {'title': 'E2E Duplicate Crawl Item'},
            },
            {
                'post': None,
                'item_status': 'filtered',
                'source_url': '',
                'normalized_url': '',
                'title': 'E2E Filtered Crawl Item',
                'error_message': 'Missing source URL',
                'payload': {'title': 'E2E Filtered Crawl Item'},
            },
            {
                'post': None,
                'item_status': 'error',
                'source_url': 'https://example.com/e2e-error',
                'normalized_url': 'https://example.com/e2e-error',
                'title': 'E2E Error Crawl Item',
                'error_message': 'Item persistence failed',
                'payload': {'title': 'E2E Error Crawl Item'},
            },
        ]:
            CrawlItem.objects.update_or_create(
                run=crawl_run,
                title=item['title'],
                defaults=item,
            )

        self.stdout.write(self.style.SUCCESS('E2E seed data prepared.'))
