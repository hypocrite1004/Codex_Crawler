import json
from datetime import timedelta
from io import StringIO
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.core.management import call_command
from django.db import IntegrityError
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from . import crawler as crawler_module
from .management.commands.run_crawler_scheduler import Command as CrawlerSchedulerCommand
from .cve_sync import sync_post_cve_mentions
from .crawler import run_crawl
from .models import AIConfig, CrawlItem, CrawlRun, CrawlerSource, CrawlerLog, Post, Category, Comment, CveRecord, PostCveMention

ACTUAL_RECORD_CRAWL_ITEM = crawler_module._record_crawl_item


class CrawlRunTrackingTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='tester',
            email='tester@example.com',
            password='password123',
        )
        self.staff = User.objects.create_user(
            username='crawler-admin',
            email='crawler-admin@example.com',
            password='password123',
            is_staff=True,
            is_superuser=True,
        )
        self.source = CrawlerSource.objects.create(
            name='Test Feed',
            url='https://example.com/feed.xml',
            source_type='rss',
            crawl_interval=60,
        )

    @patch('api.crawler._send_telegram_notifications')
    @patch('api.embeddings.get_embedding', return_value=None)
    @patch('api.crawler.crawl_rss')
    def test_run_crawl_records_run_and_items(self, mock_crawl_rss, _mock_embedding, _mock_notify):
        Post.objects.create(
            title='Existing Post',
            content='existing content',
            source_url='https://example.com/existing',
            author=self.user,
        )
        mock_crawl_rss.return_value = ([
            {
                'url': 'https://example.com/new',
                'title': 'New Post',
                'content': 'new content',
            },
            {
                'url': 'https://example.com/existing',
                'title': 'Duplicate Post',
                'content': 'duplicate content',
            },
            {
                'url': '',
                'title': 'Missing URL',
                'content': 'filtered content',
            },
        ], 'success')

        result = run_crawl(self.source, triggered_by='manual')

        self.assertEqual(result['status'], 'success')
        self.assertIsNotNone(result['run_id'])

        crawl_run = CrawlRun.objects.get(id=result['run_id'])
        self.assertEqual(crawl_run.articles_found, 3)
        self.assertEqual(crawl_run.articles_created, 1)
        self.assertEqual(crawl_run.duplicate_count, 1)
        self.assertEqual(crawl_run.filtered_count, 1)
        self.assertEqual(crawl_run.error_count, 0)

        statuses = list(crawl_run.items.values_list('item_status', flat=True))
        self.assertEqual(statuses, ['created', 'duplicate', 'filtered'])
        self.assertTrue(CrawlItem.objects.filter(run=crawl_run, item_status='created', post__isnull=False).exists())
        created_post = Post.objects.get(source_url='https://example.com/new')
        self.assertEqual(
            list(created_post.cve_mentions.values_list('cve__cve_id', flat=True)),
            [],
        )

    @patch('api.crawler._send_telegram_notifications')
    @patch('api.embeddings.get_embedding', return_value=None)
    @patch('api.crawler.crawl_rss')
    def test_run_crawl_extracts_cves_for_new_posts(self, mock_crawl_rss, _mock_embedding, _mock_notify):
        mock_crawl_rss.return_value = ([{
            'url': 'https://example.com/cve-news',
            'title': 'Vendor patched CVE-2026-9999',
            'content': 'The advisory also references CVE-2026-8888 in the body.',
        }], 'success')

        result = run_crawl(self.source, triggered_by='manual')

        self.assertEqual(result['status'], 'success')
        post = Post.objects.get(source_url='https://example.com/cve-news')
        self.assertEqual(
            sorted(post.cve_mentions.values_list('cve__cve_id', flat=True)),
            ['CVE-2026-8888', 'CVE-2026-9999'],
        )

    @patch('api.crawler._send_telegram_notifications')
    @patch('api.embeddings.get_embedding', return_value=None)
    @patch('api.crawler.crawl_rss')
    def test_item_write_is_atomic_when_created_item_recording_fails(self, mock_crawl_rss, _mock_embedding, _mock_notify):
        mock_crawl_rss.return_value = ([
            {
                'url': 'https://example.com/atomic',
                'title': 'Atomic Post',
                'content': 'atomic content',
            },
        ], 'success')

        def side_effect(run, item_status, item, post=None, error_message=''):
            if item_status == 'created':
                raise RuntimeError('created item write failed')
            return ACTUAL_RECORD_CRAWL_ITEM(run, item_status, item, post=post, error_message=error_message)

        with patch('api.crawler._record_crawl_item', side_effect=side_effect):
            result = run_crawl(self.source, triggered_by='manual')

        self.assertEqual(result['status'], 'success')
        self.assertFalse(Post.objects.filter(source_url='https://example.com/atomic').exists())

        crawl_run = CrawlRun.objects.get(id=result['run_id'])
        self.assertEqual(crawl_run.articles_created, 0)
        self.assertEqual(crawl_run.error_count, 1)
        self.assertFalse(CrawlItem.objects.filter(run=crawl_run, item_status='created').exists())
        self.assertTrue(CrawlItem.objects.filter(run=crawl_run, item_status='error').exists())

    def test_source_runs_endpoint_returns_recent_runs(self):
        crawl_run = CrawlRun.objects.create(
            source=self.source,
            triggered_by='manual',
            status='success',
            articles_found=2,
            articles_created=1,
        )

        self.client.force_authenticate(user=self.staff)
        response = self.client.get(f'/api/crawler-sources/{self.source.id}/runs/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], crawl_run.id)
        self.assertEqual(response.data[0]['item_count'], 0)

    def test_run_items_endpoint_returns_item_details(self):
        crawl_run = CrawlRun.objects.create(
            source=self.source,
            triggered_by='scheduled',
            status='success',
            articles_found=1,
            articles_created=1,
        )
        CrawlItem.objects.create(
            run=crawl_run,
            item_status='created',
            source_url='https://example.com/new',
            normalized_url='https://example.com/new',
            title='Created Item',
            payload={'title': 'Created Item'},
        )

        self.client.force_authenticate(user=self.staff)
        response = self.client.get(f'/api/crawler-runs/{crawl_run.id}/items/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['item_status'], 'created')
        self.assertEqual(response.data[0]['title'], 'Created Item')
        self.assertEqual(response.data[0]['diagnostic_category'], 'ok')

    def test_run_and_item_endpoints_include_operator_diagnostics(self):
        crawl_run = CrawlRun.objects.create(
            source=self.source,
            triggered_by='scheduled',
            status='error',
            error_message='feed unavailable',
            articles_found=3,
            duplicate_count=1,
            filtered_count=1,
            error_count=1,
        )
        CrawlItem.objects.create(
            run=crawl_run,
            item_status='duplicate',
            source_url='https://example.com/duplicate',
            normalized_url='https://example.com/duplicate',
            title='Duplicate Item',
            error_message='Duplicate source URL',
            payload={'title': 'Duplicate Item'},
        )
        CrawlItem.objects.create(
            run=crawl_run,
            item_status='filtered',
            title='Filtered Item',
            error_message='Missing source URL',
            payload={'title': 'Filtered Item'},
        )
        CrawlItem.objects.create(
            run=crawl_run,
            item_status='error',
            source_url='https://example.com/error',
            normalized_url='https://example.com/error',
            title='Error Item',
            error_message='Item persistence failed',
            payload={'title': 'Error Item'},
        )

        self.client.force_authenticate(user=self.staff)
        run_response = self.client.get(f'/api/crawler-runs/{crawl_run.id}/')
        item_response = self.client.get(f'/api/crawler-runs/{crawl_run.id}/items/')

        self.assertEqual(run_response.status_code, 200)
        self.assertEqual(run_response.data['diagnostic_category'], 'network_error')
        self.assertEqual(item_response.status_code, 200)
        categories = {item['title']: item['diagnostic_category'] for item in item_response.data}
        self.assertEqual(categories['Duplicate Item'], 'duplicate_url')
        self.assertEqual(categories['Filtered Item'], 'missing_url')
        self.assertEqual(categories['Error Item'], 'persistence_error')

    def test_crawler_metrics_endpoint_returns_period_and_source_summaries(self):
        now = timezone.now()
        CrawlRun.objects.create(
            source=self.source,
            triggered_by='manual',
            status='success',
            started_at=now,
            finished_at=now,
            articles_found=4,
            articles_created=2,
            duplicate_count=1,
            filtered_count=1,
            error_count=0,
            duration_seconds=5,
        )
        CrawlRun.objects.create(
            source=self.source,
            triggered_by='scheduled',
            status='error',
            started_at=now,
            finished_at=now,
            articles_found=1,
            articles_created=0,
            duplicate_count=0,
            filtered_count=0,
            error_count=1,
            duration_seconds=2,
        )

        self.client.force_authenticate(user=self.staff)
        response = self.client.get('/api/crawler-runs/metrics/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['periods']['24h']['total_runs'], 2)
        self.assertEqual(response.data['periods']['24h']['successful_runs'], 1)
        self.assertEqual(response.data['periods']['24h']['failed_runs'], 1)
        self.assertEqual(response.data['periods']['24h']['articles_created'], 2)
        self.assertEqual(response.data['periods']['7d']['error_count'], 1)
        self.assertEqual(response.data['sources'][0]['source_id'], self.source.id)
        self.assertEqual(response.data['sources'][0]['recent_runs'], 2)

    @patch('api.crawler._send_telegram_notifications')
    @patch('api.embeddings.get_embedding', return_value=None)
    @patch('api.crawler.crawl_rss')
    def test_normalized_source_url_treats_tracking_variants_as_duplicates(self, mock_crawl_rss, _mock_embedding, _mock_notify):
        canonical_url = 'https://example.com/article?id=42'
        Post.objects.create(
            title='Canonical Post',
            content='existing content',
            source_url=f'{canonical_url}&utm_source=newsletter',
            normalized_source_url=crawler_module.normalize_source_url(f'{canonical_url}&utm_source=newsletter'),
            author=self.user,
        )
        mock_crawl_rss.return_value = ([
            {
                'url': f'{canonical_url}&fbclid=test-value',
                'title': 'Tracked Duplicate',
                'content': 'duplicate content',
            },
        ], 'success')

        result = run_crawl(self.source, triggered_by='manual')

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['created'], 0)
        crawl_run = CrawlRun.objects.get(id=result['run_id'])
        self.assertEqual(crawl_run.duplicate_count, 1)
        self.assertTrue(CrawlItem.objects.filter(run=crawl_run, item_status='duplicate').exists())

    @patch('api.crawler._send_telegram_notifications')
    @patch('api.embeddings.get_embedding', return_value=None)
    @patch('api.crawler.crawl_rss')
    def test_post_create_integrity_error_is_treated_as_duplicate(
        self,
        mock_crawl_rss,
        _mock_embedding,
        _mock_notify,
    ):
        mock_crawl_rss.return_value = ([
            {
                'url': 'https://example.com/racy-duplicate?utm_source=newsletter',
                'title': 'Racy Duplicate',
                'content': 'duplicate content',
            },
        ], 'success')

        filter_mock = MagicMock()
        filter_mock.exists.side_effect = [False, True]

        with (
            patch('api.models.Post.objects.filter', return_value=filter_mock),
            patch('api.models.Post.objects.create', side_effect=IntegrityError('duplicate key value violates unique constraint')),
        ):
            result = run_crawl(self.source, triggered_by='manual')

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['created'], 0)
        crawl_run = CrawlRun.objects.get(id=result['run_id'])
        self.assertEqual(crawl_run.duplicate_count, 1)
        self.assertEqual(crawl_run.error_count, 0)
        self.assertTrue(CrawlItem.objects.filter(run=crawl_run, item_status='duplicate').exists())

    def test_audit_normalized_source_urls_command_reports_no_duplicates_when_clean(self):
        stdout = StringIO()
        call_command('audit_normalized_source_urls', stdout=stdout)
        output = stdout.getvalue()

        self.assertIn('중복 normalized_source_url이 없습니다.', output)

    def test_normalized_source_url_unique_constraint_blocks_duplicates(self):
        normalized_url = crawler_module.normalize_source_url('https://example.com/unique?id=7&utm_source=newsletter')
        Post.objects.create(
            title='Original Post',
            content='content',
            source_url='https://example.com/unique?id=7&utm_source=newsletter',
            normalized_source_url=normalized_url,
            author=self.user,
        )

        with self.assertRaises(IntegrityError):
            Post.objects.create(
                title='Duplicate Post',
                content='content',
                source_url='https://example.com/unique?id=7&fbclid=test',
                normalized_source_url=normalized_url,
                author=self.user,
            )

    def test_normalized_source_url_unique_constraint_ignores_null_and_blank(self):
        Post.objects.create(
            title='Null Normalized URL 1',
            content='content',
            source_url='https://example.com/null-1',
            normalized_source_url=None,
            author=self.user,
        )
        Post.objects.create(
            title='Null Normalized URL 2',
            content='content',
            source_url='https://example.com/null-2',
            normalized_source_url=None,
            author=self.user,
        )
        Post.objects.create(
            title='Blank Normalized URL 1',
            content='content',
            source_url='https://example.com/blank-1',
            normalized_source_url='',
            author=self.user,
        )
        Post.objects.create(
            title='Blank Normalized URL 2',
            content='content',
            source_url='https://example.com/blank-2',
            normalized_source_url='',
            author=self.user,
        )

    def test_crawler_sources_require_staff_access(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get('/api/crawler-sources/')

        self.assertEqual(response.status_code, 403)

    def test_crawler_source_create_rejects_localhost_url(self):
        self.client.force_authenticate(user=self.staff)

        response = self.client.post('/api/crawler-sources/', {
            'name': 'Blocked Localhost Source',
            'url': 'http://127.0.0.1/feed.xml',
            'source_type': 'rss',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('url', response.data)

    def test_crawler_source_create_rejects_blocked_headers(self):
        self.client.force_authenticate(user=self.staff)

        response = self.client.post('/api/crawler-sources/', {
            'name': 'Blocked Header Source',
            'url': 'https://example.com/feed.xml',
            'source_type': 'html',
            'request_headers': {
                'Authorization': 'Bearer secret',
            },
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('request_headers', response.data)

    @patch('api.crawler.preview_crawl')
    def test_preview_rejects_private_network_target(self, mock_preview):
        self.client.force_authenticate(user=self.staff)

        response = self.client.post('/api/crawler-sources/preview/', {
            'url': 'http://192.168.0.10/internal',
            'source_type': 'html',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('url', response.data)
        mock_preview.assert_not_called()

    @patch('api.crawler.run_crawl')
    def test_manual_crawl_rejects_invalid_saved_source(self, mock_run_crawl):
        blocked_source = CrawlerSource.objects.create(
            name='Blocked Source',
            url='http://127.0.0.1/internal',
            source_type='rss',
        )
        self.client.force_authenticate(user=self.staff)

        response = self.client.post(f'/api/crawler-sources/{blocked_source.id}/crawl/')

        self.assertEqual(response.status_code, 400)
        self.assertIn('url', response.data)
        mock_run_crawl.assert_not_called()

    @patch('api.crawler.crawl_rss')
    def test_run_crawl_blocks_invalid_source_before_fetch(self, mock_crawl_rss):
        self.source.url = 'http://127.0.0.1/blocked'
        self.source.save(update_fields=['url'])

        result = run_crawl(self.source, triggered_by='manual')

        self.assertEqual(result['status'], 'error')
        self.assertEqual(result['error'], 'Blocked crawler source configuration.')
        self.assertIsNone(result['run_id'])
        mock_crawl_rss.assert_not_called()

    @patch('api.views.validate_crawler_request_config')
    @patch('api.crawler.preview_crawl', return_value={'status': 'error', 'error': 'socket timeout 10.0.0.5'})
    def test_preview_masks_internal_error_details(self, _mock_preview, mock_validate):
        mock_validate.return_value = None
        self.client.force_authenticate(user=self.staff)

        response = self.client.post('/api/crawler-sources/preview/', {
            'url': 'https://example.com/feed.xml',
            'source_type': 'rss',
        }, format='json')

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.data['error'], 'Preview failed.')

    @patch('api.views.validate_crawler_request_config')
    @patch('api.crawler.run_crawl', return_value={'status': 'error', 'error': 'dial tcp 10.0.0.5', 'created': 0, 'found': 0, 'attempt_count': 1, 'duration_seconds': 0, 'run_id': 1})
    def test_manual_crawl_masks_internal_error_details(self, _mock_run_crawl, mock_validate):
        mock_validate.return_value = None
        self.client.force_authenticate(user=self.staff)

        response = self.client.post(f'/api/crawler-sources/{self.source.id}/crawl/')

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.data['error'], 'Crawl failed.')

    @patch('api.crawler._send_telegram_notifications')
    @patch('api.embeddings.get_embedding', return_value=None)
    @patch('api.crawler._record_crawl_item')
    @patch('api.crawler.crawl_rss')
    def test_created_item_failure_rolls_back_post_and_records_error(
        self,
        mock_crawl_rss,
        mock_record_crawl_item,
        _mock_embedding,
        _mock_notify,
    ):
        mock_crawl_rss.return_value = ([
            {
                'url': 'https://example.com/atomic-new',
                'title': 'Atomic New Post',
                'content': 'atomic content',
            },
        ], 'success')

        def record_side_effect(run, item_status, item, post=None, error_message=''):
            if item_status == 'created':
                raise RuntimeError('created log failed')
            return ACTUAL_RECORD_CRAWL_ITEM(run, item_status, item, post=post, error_message=error_message)

        mock_record_crawl_item.side_effect = record_side_effect

        result = run_crawl(self.source, triggered_by='manual')

        self.assertEqual(result['status'], 'success')
        self.assertFalse(Post.objects.filter(source_url='https://example.com/atomic-new').exists())
        crawl_run = CrawlRun.objects.get(id=result['run_id'])
        self.assertEqual(crawl_run.articles_created, 0)
        self.assertEqual(crawl_run.error_count, 1)
        self.assertTrue(CrawlItem.objects.filter(run=crawl_run, item_status='error').exists())

    def test_run_crawl_returns_running_when_source_is_locked(self):
        self.source.is_running = True
        self.source.last_run_started_at = timezone.now()
        self.source.save(update_fields=['is_running', 'last_run_started_at'])

        result = run_crawl(self.source, triggered_by='scheduled')

        self.assertEqual(result['status'], 'running')
        self.assertEqual(result['attempt_count'], 0)
        self.assertIsNone(result['run_id'])
        self.assertEqual(CrawlRun.objects.count(), 0)

    @override_settings(CRAWLER_STALE_RUN_MINUTES=60)
    @patch('api.crawler._send_telegram_notifications')
    @patch('api.embeddings.get_embedding', return_value=None)
    @patch('api.crawler.crawl_rss')
    def test_run_crawl_recovers_stale_lock_before_starting_new_run(self, mock_crawl_rss, _mock_embedding, _mock_notify):
        stale_started_at = timezone.now() - timedelta(hours=2)
        self.source.is_running = True
        self.source.last_run_started_at = stale_started_at
        self.source.save(update_fields=['is_running', 'last_run_started_at'])
        stale_run = CrawlRun.objects.create(
            source=self.source,
            triggered_by='manual',
            status='running',
            started_at=stale_started_at,
        )
        mock_crawl_rss.return_value = ([{
            'url': 'https://example.com/recovered',
            'title': 'Recovered Crawl',
            'content': 'content',
        }], 'success')

        result = run_crawl(self.source, triggered_by='manual')

        self.assertEqual(result['status'], 'success')
        self.assertNotEqual(result['run_id'], stale_run.id)
        stale_run.refresh_from_db()
        self.assertEqual(stale_run.status, 'error')
        self.assertIn('stale lock timeout', stale_run.error_message)
        self.assertGreater(stale_run.duration_seconds, 0)

        self.source.refresh_from_db()
        self.assertFalse(self.source.is_running)
        self.assertEqual(self.source.consecutive_failures, 0)
        self.assertEqual(CrawlerLog.objects.filter(source=self.source, status='error').count(), 1)
        self.assertEqual(CrawlerLog.objects.filter(source=self.source, status='success').count(), 1)

    @override_settings(CRAWLER_STALE_RUN_MINUTES=60)
    @patch('api.management.commands.run_crawler_scheduler.run_crawl', return_value={
        'status': 'success',
        'created': 0,
        'found': 0,
        'attempt_count': 1,
    })
    def test_scheduler_recovers_stale_locks_before_due_check(self, mock_run_crawl):
        stale_started_at = timezone.now() - timedelta(hours=2)
        self.source.is_running = True
        self.source.last_run_started_at = stale_started_at
        self.source.last_crawled_at = timezone.now() - timedelta(days=1)
        self.source.save(update_fields=['is_running', 'last_run_started_at', 'last_crawled_at'])
        stale_run = CrawlRun.objects.create(
            source=self.source,
            triggered_by='scheduled',
            status='running',
            started_at=stale_started_at,
        )

        processed = CrawlerSchedulerCommand().run_due_sources(limit=1)

        self.assertEqual(processed, 0)
        mock_run_crawl.assert_not_called()
        stale_run.refresh_from_db()
        self.assertEqual(stale_run.status, 'error')
        self.source.refresh_from_db()
        self.assertFalse(self.source.is_running)
        self.assertEqual(self.source.last_status, 'error')

    @patch('api.crawler.time.sleep', return_value=None)
    @patch('api.crawler.crawl_rss', side_effect=ValueError('feed unavailable'))
    def test_scheduled_run_does_not_retry_and_still_auto_disables_source(self, _mock_crawl_rss, _mock_sleep):
        self.source.max_retries = 1
        self.source.auto_disable_after_failures = 1
        self.source.retry_backoff_minutes = 1
        self.source.save(update_fields=['max_retries', 'auto_disable_after_failures', 'retry_backoff_minutes'])

        result = run_crawl(self.source, triggered_by='scheduled')

        self.assertEqual(result['status'], 'error')
        self.assertEqual(result['attempt_count'], 1)
        self.source.refresh_from_db()
        self.assertEqual(self.source.consecutive_failures, 1)
        self.assertFalse(self.source.is_active)
        self.assertFalse(self.source.is_running)

        crawl_run = CrawlRun.objects.get(id=result['run_id'])
        self.assertEqual(crawl_run.status, 'error')
        self.assertEqual(crawl_run.attempt_count, 1)

        crawl_log = CrawlerLog.objects.get(source=self.source)
        self.assertEqual(crawl_log.status, 'error')
        self.assertEqual(crawl_log.attempt_count, 1)
        _mock_sleep.assert_not_called()

    @patch('api.crawler.time.sleep', return_value=None)
    @patch('api.crawler.crawl_rss', side_effect=ValueError('feed unavailable'))
    def test_manual_run_keeps_retry_behavior(self, _mock_crawl_rss, mock_sleep):
        self.source.max_retries = 1
        self.source.auto_disable_after_failures = 1
        self.source.retry_backoff_minutes = 1
        self.source.save(update_fields=['max_retries', 'auto_disable_after_failures', 'retry_backoff_minutes'])

        result = run_crawl(self.source, triggered_by='manual')

        self.assertEqual(result['status'], 'error')
        self.assertEqual(result['attempt_count'], 2)
        self.source.refresh_from_db()
        self.assertEqual(self.source.consecutive_failures, 1)
        self.assertFalse(self.source.is_active)
        self.assertFalse(self.source.is_running)

        crawl_run = CrawlRun.objects.get(id=result['run_id'])
        self.assertEqual(crawl_run.status, 'error')
        self.assertEqual(crawl_run.attempt_count, 2)

        crawl_log = CrawlerLog.objects.get(source=self.source)
        self.assertEqual(crawl_log.status, 'error')
        self.assertEqual(crawl_log.attempt_count, 2)
        mock_sleep.assert_called_once_with(60)

    @patch('api.crawler.time.sleep', return_value=None)
    @patch('api.crawler._ensure_system_user')
    @patch('api.crawler._persist_crawled_items_with_run')
    @patch('api.crawler.crawl_rss')
    def test_failed_run_aggregates_item_totals_into_run_summary(
        self,
        mock_crawl_rss,
        mock_persist,
        mock_system_user,
        _mock_sleep,
    ):
        self.source.max_retries = 0
        self.source.save(update_fields=['max_retries'])
        mock_system_user.return_value = self.user
        mock_crawl_rss.return_value = ([
            {'url': 'https://example.com/duplicate', 'title': 'Duplicate', 'content': 'duplicate'},
            {'url': '', 'title': 'Filtered', 'content': 'filtered'},
        ], 'success')

        def persist_side_effect(_source, items, _system_user, _get_embedding, crawl_run):
            CrawlItem.objects.create(
                run=crawl_run,
                item_status='duplicate',
                source_url=items[0]['url'],
                normalized_url=items[0]['url'],
                title=items[0]['title'],
                error_message='Duplicate source URL',
                payload=items[0],
            )
            CrawlItem.objects.create(
                run=crawl_run,
                item_status='filtered',
                source_url='',
                normalized_url='',
                title=items[1]['title'],
                error_message='Missing source URL',
                payload=items[1],
            )
            raise RuntimeError('persist exploded')

        mock_persist.side_effect = persist_side_effect

        result = run_crawl(self.source, triggered_by='manual')

        self.assertEqual(result['status'], 'error')
        crawl_run = CrawlRun.objects.get(id=result['run_id'])
        self.assertEqual(crawl_run.articles_found, 2)
        self.assertEqual(crawl_run.articles_created, 0)
        self.assertEqual(crawl_run.duplicate_count, 1)
        self.assertEqual(crawl_run.filtered_count, 1)
        self.assertEqual(crawl_run.error_count, 0)

    @patch('api.embeddings.get_embedding', return_value=None)
    @patch('api.crawler._record_crawl_item')
    @patch('api.crawler.crawl_rss')
    def test_item_create_failure_rolls_back_post_and_records_error_item(
        self,
        mock_crawl_rss,
        mock_record_item,
        _mock_embedding,
    ):
        mock_crawl_rss.return_value = ([
            {'url': 'https://example.com/new-rollback', 'title': 'Rollback Post', 'content': 'rollback content'},
        ], 'success')

        def record_side_effect(run, item_status, item, post=None, error_message=''):
            if item_status == 'created':
                raise RuntimeError('record failed')
            return ACTUAL_RECORD_CRAWL_ITEM(run, item_status, item, post=post, error_message=error_message)

        mock_record_item.side_effect = record_side_effect

        result = run_crawl(self.source, triggered_by='manual')

        self.assertEqual(result['status'], 'success')
        self.assertFalse(Post.objects.filter(source_url='https://example.com/new-rollback').exists())
        crawl_run = CrawlRun.objects.get(id=result['run_id'])
        self.assertEqual(crawl_run.articles_created, 0)
        self.assertEqual(crawl_run.error_count, 1)
        self.assertTrue(CrawlItem.objects.filter(run=crawl_run, item_status='error').exists())


class PostWorkflowTests(APITestCase):
    def setUp(self):
        self.author = User.objects.create_user(
            username='author',
            email='author@example.com',
            password='password123',
        )
        self.staff = User.objects.create_user(
            username='staff',
            email='staff@example.com',
            password='password123',
            is_staff=True,
        )
        self.admin = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='password123',
        )
        self.other_user = User.objects.create_user(
            username='reader',
            email='reader@example.com',
            password='password123',
        )

    def test_non_staff_publish_request_creates_review_post(self):
        self.client.force_authenticate(user=self.author)

        response = self.client.post('/api/posts/', {
            'title': 'Workflow Post',
            'content': '<p>content</p>',
            'is_draft': False,
        }, format='json')

        self.assertEqual(response.status_code, 201)
        post = Post.objects.get(id=response.data['id'])
        self.assertEqual(post.status, 'review')
        self.assertTrue(post.is_draft)
        self.assertIsNotNone(post.approval_requested_at)

    def test_staff_can_approve_review_post(self):
        post = Post.objects.create(
            title='Review Post',
            content='content',
            author=self.author,
            status='review',
            is_draft=True,
        )
        post.approval_requested_at = post.created_at
        post.save(update_fields=['approval_requested_at'])

        self.client.force_authenticate(user=self.staff)
        response = self.client.post(f'/api/posts/{post.id}/approve/')

        self.assertEqual(response.status_code, 200)
        post.refresh_from_db()
        self.assertEqual(post.status, 'published')
        self.assertFalse(post.is_draft)
        self.assertEqual(post.approved_by_id, self.staff.id)
        self.assertIsNotNone(post.approved_at)

    def test_public_list_excludes_review_posts(self):
        Post.objects.create(
            title='Published Post',
            content='content',
            author=self.staff,
            status='published',
            is_draft=False,
        )
        review_post = Post.objects.create(
            title='Review Post',
            content='content',
            author=self.author,
            status='review',
            is_draft=True,
        )

        response = self.client.get('/api/posts/')

        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)
        returned_ids = [item['id'] for item in response.data['results']]
        self.assertNotIn(review_post.id, returned_ids)
        self.assertEqual(len(returned_ids), 1)

    def test_mine_filter_returns_only_authenticated_users_posts(self):
        own_post = Post.objects.create(
            title='My Draft',
            content='content',
            author=self.author,
            status='draft',
            is_draft=True,
        )
        Post.objects.create(
            title='Another User Post',
            content='content',
            author=self.staff,
            status='published',
            is_draft=False,
        )

        self.client.force_authenticate(user=self.author)
        response = self.client.get('/api/posts/?mine=true')

        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)
        returned_ids = [item['id'] for item in response.data['results']]
        self.assertEqual(returned_ids, [own_post.id])

    def test_posts_limit_alias_returns_paginated_shape(self):
        Post.objects.create(
            title='First Published Post',
            content='content',
            author=self.author,
            status='published',
            is_draft=False,
        )
        Post.objects.create(
            title='Second Published Post',
            content='content',
            author=self.staff,
            status='published',
            is_draft=False,
        )

        response = self.client.get('/api/posts/?limit=1')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(response.data['page'], 1)
        self.assertEqual(response.data['page_size'], 1)
        self.assertEqual(len(response.data['results']), 1)

    def test_restore_to_draft_clears_review_metadata(self):
        post = Post.objects.create(
            title='Rejected Post',
            content='content',
            author=self.author,
            status='rejected',
            is_draft=True,
            approved_by=self.staff,
            approved_at=timezone.now(),
            rejected_by=self.staff,
            rejected_at=timezone.now(),
            rejection_reason='Needs revision',
        )

        self.client.force_authenticate(user=self.author)
        response = self.client.post(f'/api/posts/{post.id}/restore_to_draft/')

        self.assertEqual(response.status_code, 200)
        post.refresh_from_db()
        self.assertEqual(post.status, 'draft')
        self.assertIsNone(post.approval_requested_at)
        self.assertIsNone(post.approved_by)
        self.assertIsNone(post.approved_at)
        self.assertIsNone(post.rejected_by)
        self.assertIsNone(post.rejected_at)
        self.assertEqual(post.rejection_reason, '')

    def test_create_post_extracts_cves(self):
        self.client.force_authenticate(user=self.author)

        response = self.client.post('/api/posts/', {
            'title': 'Patch for CVE-2026-1111',
            'content': '<p>Body also mentions CVE-2026-2222.</p>',
            'is_draft': True,
        }, format='json')

        self.assertEqual(response.status_code, 201)
        post = Post.objects.get(id=response.data['id'])
        self.assertEqual(
            sorted(post.cve_mentions.values_list('cve__cve_id', flat=True)),
            ['CVE-2026-1111', 'CVE-2026-2222'],
        )

    def test_update_post_resyncs_auto_extracted_cves(self):
        post = Post.objects.create(
            title='Initial CVE-2026-3000',
            content='Initial content',
            author=self.author,
            status='draft',
            is_draft=True,
        )
        PostCveMention.objects.create(
            post=post,
            cve=CveRecord.objects.create(cve_id='CVE-2026-3000'),
            source='auto_extract',
            mentioned_in='title',
        )

        self.client.force_authenticate(user=self.author)
        response = self.client.patch(f'/api/posts/{post.id}/', {
            'title': 'Updated advisory',
            'content': '<p>Now it references CVE-2026-4444 only.</p>',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        post.refresh_from_db()
        self.assertEqual(
            list(post.cve_mentions.values_list('cve__cve_id', flat=True)),
            ['CVE-2026-4444'],
        )

    def test_delete_post_requires_admin(self):
        post = Post.objects.create(
            title='Delete Target',
            content='content',
            author=self.author,
            status='published',
            is_draft=False,
        )

        self.client.force_authenticate(user=self.staff)
        response = self.client.delete(f'/api/posts/{post.id}/')
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Post.objects.filter(id=post.id).exists())

        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(f'/api/posts/{post.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Post.objects.filter(id=post.id).exists())

    def test_toggle_share_requires_staff(self):
        post = Post.objects.create(
            title='Share Target',
            content='content',
            author=self.author,
            status='published',
            is_draft=False,
            is_shared=False,
        )

        self.client.force_authenticate(user=self.author)
        response = self.client.post(f'/api/posts/{post.id}/toggle_share/')
        self.assertEqual(response.status_code, 403)
        post.refresh_from_db()
        self.assertFalse(post.is_shared)

        self.client.force_authenticate(user=self.staff)
        response = self.client.post(f'/api/posts/{post.id}/toggle_share/')
        self.assertEqual(response.status_code, 200)
        post.refresh_from_db()
        self.assertTrue(post.is_shared)

    def test_comment_list_is_staff_only(self):
        post = Post.objects.create(
            title='Comment Target',
            content='content',
            author=self.author,
            status='published',
            is_draft=False,
        )
        Comment.objects.create(
            post=post,
            author=self.author,
            content='comment body',
        )

        response = self.client.get('/api/comments/')
        self.assertEqual(response.status_code, 404)

        self.client.force_authenticate(user=self.author)
        response = self.client.get('/api/comments/')
        self.assertEqual(response.status_code, 404)

        self.client.force_authenticate(user=self.staff)
        response = self.client.get('/api/comments/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_comment_detail_is_owner_or_staff_only(self):
        post = Post.objects.create(
            title='Comment Detail Target',
            content='content',
            author=self.author,
            status='published',
            is_draft=False,
        )
        comment = Comment.objects.create(
            post=post,
            author=self.author,
            content='comment body',
        )

        response = self.client.get(f'/api/comments/{comment.id}/')
        self.assertEqual(response.status_code, 404)

        self.client.force_authenticate(user=self.other_user)
        response = self.client.get(f'/api/comments/{comment.id}/')
        self.assertEqual(response.status_code, 404)

        self.client.force_authenticate(user=self.author)
        response = self.client.get(f'/api/comments/{comment.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], comment.id)

        self.client.force_authenticate(user=self.staff)
        response = self.client.get(f'/api/comments/{comment.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], comment.id)


class AIConfigAndSummarySecurityTests(APITestCase):
    def setUp(self):
        self.author = User.objects.create_user(
            username='summary-author',
            email='summary-author@example.com',
            password='password123',
        )
        self.staff = User.objects.create_user(
            username='summary-staff',
            email='summary-staff@example.com',
            password='password123',
            is_staff=True,
        )
        self.post = Post.objects.create(
            title='Published Post',
            content='<p>summary content</p>',
            author=self.author,
            status='published',
            is_draft=False,
        )
        self.config = AIConfig.get_config()
        self.config.telegram_bot_token = 'secret-token'
        self.config.telegram_chat_id = 'secret-chat'
        self.config.save(update_fields=['telegram_bot_token', 'telegram_chat_id'])

    def test_ai_config_requires_staff_access(self):
        self.client.force_authenticate(user=self.author)

        response = self.client.get('/api/ai-config/')

        self.assertEqual(response.status_code, 403)

    def test_summary_get_only_returns_existing_summary(self):
        response = self.client.get(f'/api/posts/{self.post.id}/summarize/')
        self.assertEqual(response.status_code, 404)

        self.post.summary = json.dumps({'title': 'Saved Summary', 'summary': 'Stored summary'})
        self.post.is_summarized = True
        self.post.save(update_fields=['summary', 'is_summarized'])

        response = self.client.get(f'/api/posts/{self.post.id}/summarize/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(response.data['summary'])['title'], 'Saved Summary')

    @patch('api.views.generate_summary_payload', return_value={'title': 'AI Title', 'summary': 'AI Summary'})
    def test_summary_generation_requires_authenticated_author(self, _mock_generate_summary):
        response = self.client.post(f'/api/posts/{self.post.id}/summarize/')
        self.assertEqual(response.status_code, 401)

        self.client.force_authenticate(user=self.author)
        response = self.client.post(f'/api/posts/{self.post.id}/summarize/')

        self.assertEqual(response.status_code, 200)
        self.post.refresh_from_db()
        self.assertTrue(self.post.is_summarized)
        self.assertEqual(json.loads(self.post.summary)['title'], 'AI Title')

    @patch('api.views.generate_summary_payload', return_value={'title': 'Staff Title', 'summary': 'Staff Summary'})
    def test_staff_can_generate_summary_for_another_users_post(self, _mock_generate_summary):
        self.client.force_authenticate(user=self.staff)

        response = self.client.post(f'/api/posts/{self.post.id}/summarize/')

        self.assertEqual(response.status_code, 200)
        self.post.refresh_from_db()
        self.assertTrue(self.post.is_summarized)
        self.assertEqual(json.loads(self.post.summary)['title'], 'Staff Title')


class CveFeatureTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            username='cve-staff',
            email='cve-staff@example.com',
            password='password123',
            is_staff=True,
        )
        self.author = User.objects.create_user(
            username='cve-author',
            email='cve-author@example.com',
            password='password123',
        )
        self.category = Category.objects.create(name='news')
        self.post = Post.objects.create(
            title='CVE Linked Post',
            content='content',
            author=self.author,
            category=self.category,
            status='published',
            is_draft=False,
        )
        self.other_post = Post.objects.create(
            title='Another Post',
            content='content',
            author=self.author,
            category=self.category,
            status='published',
            is_draft=False,
        )
        self.cve = CveRecord.objects.create(
            cve_id='CVE-2025-12345',
            severity='HIGH',
            cvss_score=8.8,
            mention_count=1,
            legacy_mention_count=7,
        )
        PostCveMention.objects.create(
            post=self.post,
            cve=self.cve,
            mentioned_in='content',
        )

    def test_post_detail_includes_cve_mentions(self):
        response = self.client.get(f'/api/posts/{self.post.id}/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['cve_mentions']), 1)
        self.assertEqual(response.data['cve_mentions'][0]['cve_id'], 'CVE-2025-12345')

    def test_posts_can_be_filtered_by_cve_id(self):
        response = self.client.get('/api/posts/?cve=CVE-2025-12345')

        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)
        returned_ids = [item['id'] for item in response.data['results']]
        self.assertEqual(returned_ids, [self.post.id])

    def test_cve_list_returns_post_count_and_supports_severity_filter(self):
        response = self.client.get('/api/cves/?severity=HIGH')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['cve_id'], 'CVE-2025-12345')
        self.assertEqual(response.data[0]['post_count'], 1)
        self.assertEqual(response.data[0]['mention_count'], 1)
        self.assertNotIn('legacy_mention_count', response.data[0])
        self.assertNotIn('is_tracked', response.data[0])
        self.assertNotIn('notes', response.data[0])

    def test_staff_cve_list_includes_operational_fields(self):
        self.client.force_authenticate(user=self.staff)

        response = self.client.get('/api/cves/?severity=HIGH')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]['legacy_mention_count'], 7)

    def test_cve_posts_endpoint_returns_linked_posts(self):
        response = self.client.get(f'/api/cves/{self.cve.id}/posts/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], self.post.id)

    def test_auto_extract_does_not_overwrite_legacy_import_mentions(self):
        legacy_post = Post.objects.create(
            title='Legacy imported CVE-2025-12345 article',
            content='content',
            author=self.author,
            category=self.category,
            status='published',
            is_draft=False,
        )
        legacy_mention = PostCveMention.objects.create(
            post=legacy_post,
            cve=self.cve,
            source='legacy_import',
            mentioned_in='content',
            legacy_reference_ids=[100],
        )

        result = sync_post_cve_mentions(legacy_post, source='auto_extract')

        legacy_mention.refresh_from_db()
        self.assertEqual(result['skipped_existing'], 1)
        self.assertEqual(result['created'], 0)
        self.assertEqual(legacy_mention.source, 'legacy_import')
        self.assertEqual(legacy_mention.mentioned_in, 'content')

    def test_backfill_command_reports_dry_run_changes(self):
        backfill_post = Post.objects.create(
            title='Backfill CVE-2026-7777',
            content='Body mentions CVE-2026-8888.',
            author=self.author,
            category=self.category,
            status='published',
            is_draft=False,
        )

        stdout = StringIO()
        call_command('backfill_post_cves', post_id=backfill_post.id, dry_run=True, stdout=stdout)
        output = stdout.getvalue()

        self.assertIn('created=2', output)
        self.assertFalse(PostCveMention.objects.filter(post=backfill_post).exists())

    def test_sync_refreshes_current_count_without_touching_legacy_count(self):
        extra_post = Post.objects.create(
            title='Second CVE-2025-12345 article',
            content='content',
            author=self.author,
            category=self.category,
            status='published',
            is_draft=False,
        )

        result = sync_post_cve_mentions(extra_post)

        self.assertEqual(result['created'], 1)
        self.cve.refresh_from_db()
        self.assertEqual(self.cve.mention_count, 2)
        self.assertEqual(self.cve.legacy_mention_count, 7)
