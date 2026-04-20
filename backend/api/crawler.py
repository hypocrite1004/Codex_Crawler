import logging
import time

from django.db import models
from django.utils import timezone

from .crawler_fetchers import crawl_html, crawl_rss
from .crawler_notifications import _send_telegram_notifications
from . import crawler_persistence as persistence
from .crawler_preview import _SourceProxy, preview_crawl
from .crawler_security import CrawlerSecurityError, validate_crawler_request_config

logger = logging.getLogger(__name__)

_ensure_system_user = persistence._ensure_system_user
_get_run_item_totals = persistence._get_run_item_totals
normalize_source_url = persistence.normalize_source_url


def _record_crawl_item(run, item_status: str, item: dict, post=None, error_message: str = ''):
    return persistence._record_crawl_item(run, item_status, item, post=post, error_message=error_message)


def _persist_crawled_items(source, items: list[dict], system_user, get_embedding, crawl_run=None):
    return persistence._persist_crawled_items(
        source,
        items,
        system_user,
        get_embedding,
        crawl_run=crawl_run,
        record_item_fn=_record_crawl_item,
    )


def _persist_crawled_items_with_run(source, items: list[dict], system_user, get_embedding, crawl_run):
    return persistence._persist_crawled_items_with_run(
        source,
        items,
        system_user,
        get_embedding,
        crawl_run,
        record_item_fn=_record_crawl_item,
    )


def run_crawl(source, triggered_by: str = 'manual') -> dict:
    from .embeddings import get_embedding
    from .models import CrawlerLog, CrawlRun

    try:
        validate_crawler_request_config(source)
    except CrawlerSecurityError as exc:
        logger.warning(f"[Crawler] blocked source configuration: {getattr(source, 'url', '')} {exc.detail}")
        return {
            'created': 0,
            'found': 0,
            'status': 'error',
            'error': 'Blocked crawler source configuration.',
            'attempt_count': 0,
            'duration_seconds': 0,
            'run_id': None,
        }

    locked = source.__class__.objects.filter(pk=source.pk, is_running=False).update(
        is_running=True,
        last_run_started_at=timezone.now(),
    )
    if not locked:
        return {
            'created': 0,
            'found': 0,
            'status': 'running',
            'error': 'Another crawl is already running for this source.',
            'attempt_count': 0,
            'duration_seconds': 0,
            'run_id': None,
        }

    source.refresh_from_db()
    crawl_run = CrawlRun.objects.create(
        source=source,
        triggered_by=triggered_by,
        status='running',
        started_at=timezone.now(),
    )
    started_at = time.monotonic()
    retry_enabled = triggered_by != 'scheduled'
    max_attempts = 1 if not retry_enabled else 1 + max(0, int(source.max_retries or 0))
    found = 0
    created = 0
    attempt_count = 0
    last_error = ''
    last_status = 'error'

    try:
        for attempt in range(1, max_attempts + 1):
            attempt_count = attempt
            try:
                if source.source_type == 'rss':
                    items, last_status = crawl_rss(source)
                else:
                    items, last_status = crawl_html(source)

                found = len(items)
                system_user = _ensure_system_user()
                persist_result = _persist_crawled_items_with_run(source, items, system_user, get_embedding, crawl_run)
                created = persist_result['created']

                finished_at = timezone.now()
                duration_seconds = max(0, int(time.monotonic() - started_at))

                source.last_crawled_at = finished_at
                source.last_success_at = finished_at
                source.last_status = last_status
                source.last_error_message = ''
                source.consecutive_failures = 0
                source.is_running = False
                source.save(update_fields=[
                    'last_crawled_at',
                    'last_success_at',
                    'last_status',
                    'last_error_message',
                    'consecutive_failures',
                    'is_running',
                    'last_run_started_at',
                ])

                crawl_run.status = last_status
                crawl_run.finished_at = finished_at
                crawl_run.attempt_count = attempt_count
                crawl_run.articles_found = found
                crawl_run.articles_created = created
                crawl_run.duplicate_count = persist_result['duplicate_count']
                crawl_run.filtered_count = persist_result['filtered_count']
                crawl_run.error_count = persist_result['error_count']
                crawl_run.duration_seconds = duration_seconds
                crawl_run.error_message = ''
                crawl_run.save(update_fields=[
                    'status',
                    'finished_at',
                    'attempt_count',
                    'articles_found',
                    'articles_created',
                    'duplicate_count',
                    'filtered_count',
                    'error_count',
                    'duration_seconds',
                    'error_message',
                ])

                CrawlerLog.objects.create(
                    source=source,
                    status=last_status,
                    articles_found=found,
                    articles_created=created,
                    triggered_by=triggered_by,
                    attempt_count=attempt_count,
                    duration_seconds=duration_seconds,
                )

                _send_telegram_notifications(source, created)

                return {
                    'created': created,
                    'found': found,
                    'status': last_status,
                    'error': '',
                    'attempt_count': attempt_count,
                    'duration_seconds': duration_seconds,
                    'run_id': crawl_run.id,
                }
            except Exception as exc:
                last_error = str(exc)
                last_status = 'error'
                logger.exception(f"[Crawler] crawl failed ({source.name}) attempt={attempt}/{max_attempts}: {exc}")

                if retry_enabled and attempt < max_attempts:
                    backoff_seconds = max(0, int(source.retry_backoff_minutes or 0)) * 60 * attempt
                    if backoff_seconds:
                        time.sleep(backoff_seconds)

        finished_at = timezone.now()
        duration_seconds = max(0, int(time.monotonic() - started_at))

        source.last_crawled_at = finished_at
        source.last_status = 'error'
        source.last_error_message = last_error
        source.consecutive_failures = (source.consecutive_failures or 0) + 1
        auto_disabled = bool(
            source.auto_disable_after_failures
            and source.consecutive_failures >= source.auto_disable_after_failures
        )
        if auto_disabled:
            source.is_active = False
        source.is_running = False
        source.save(update_fields=[
            'last_crawled_at',
            'last_status',
            'last_error_message',
            'consecutive_failures',
            'is_active',
            'is_running',
            'last_run_started_at',
        ])

        error_message = last_error
        if auto_disabled:
            error_message = f"{last_error} (source auto-disabled after repeated failures)"

        CrawlerLog.objects.create(
            source=source,
            status='error',
            articles_found=found,
            articles_created=created,
            error_message=error_message,
            triggered_by=triggered_by,
            attempt_count=attempt_count,
            duration_seconds=duration_seconds,
        )

        item_totals = _get_run_item_totals(crawl_run)
        crawl_run.status = 'error'
        crawl_run.finished_at = finished_at
        crawl_run.attempt_count = attempt_count
        crawl_run.articles_found = found or sum(item_totals.values())
        crawl_run.articles_created = item_totals['created'] or created
        crawl_run.duplicate_count = item_totals['duplicate_count']
        crawl_run.filtered_count = item_totals['filtered_count']
        crawl_run.error_count = item_totals['error_count']
        crawl_run.error_message = error_message
        crawl_run.duration_seconds = duration_seconds
        crawl_run.save(update_fields=[
            'status',
            'finished_at',
            'attempt_count',
            'articles_found',
            'articles_created',
            'duplicate_count',
            'filtered_count',
            'error_count',
            'error_message',
            'duration_seconds',
        ])

        return {
            'created': created,
            'found': found,
            'status': 'error',
            'error': error_message,
            'attempt_count': attempt_count,
            'duration_seconds': duration_seconds,
            'run_id': crawl_run.id,
        }
    finally:
        source.__class__.objects.filter(pk=source.pk, is_running=True).update(is_running=False)
