from django.contrib.auth.models import User
from django.db import IntegrityError, models, transaction
from django.utils import timezone

from .cve_sync import sync_post_cve_mentions


def _ensure_system_user():
    system_user = User.objects.filter(is_staff=True).first() or User.objects.first()
    if system_user is not None:
        return system_user
    return User.objects.create_user(
        username='crawler-system',
        email='crawler-system@local.invalid',
        password=User.objects.make_random_password(),
    )


def _extract_iocs(content: str) -> list[str]:
    import re
    ips = re.findall(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b', content)
    urls = re.findall(r'(?i)\b(?:https?://|www\.)[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|]', content)
    hashes = re.findall(r'\b[a-fA-F0-9]{32}\b|\b[a-fA-F0-9]{40}\b|\b[a-fA-F0-9]{64}\b', content)
    return list(set(ips + urls + hashes))


def _serialize_payload(item: dict) -> dict:
    return {key: (value.isoformat() if hasattr(value, 'isoformat') else value) for key, value in item.items()}


def normalize_source_url(url: str) -> str:
    from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

    raw = (url or '').strip()
    if not raw:
        return ''
    parsed = urlparse(raw)
    if not parsed.scheme or not parsed.netloc:
        return raw
    scheme = parsed.scheme.lower()
    hostname = (parsed.hostname or '').lower()
    port = parsed.port
    if (scheme == 'http' and port == 80) or (scheme == 'https' and port == 443):
        port = None
    netloc = hostname if not port else f'{hostname}:{port}'
    path = parsed.path or '/'
    if path != '/' and path.endswith('/'):
        path = path.rstrip('/')
    tracking_keys = {'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'mkt_tok', '_hsenc', '_hsmi'}
    query_items = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if not key.lower().startswith('utm_') and key.lower() not in tracking_keys
    ]
    query = urlencode(sorted(query_items))
    return urlunparse((scheme, netloc, path, '', query, ''))


def _record_crawl_item(run, item_status: str, item: dict, post=None, error_message: str = ''):
    from .models import CrawlItem
    raw_url = item.get('url', '') or ''
    CrawlItem.objects.create(
        run=run,
        post=post,
        item_status=item_status,
        source_url=raw_url,
        normalized_url=normalize_source_url(raw_url),
        title=(item.get('title') or '')[:255],
        error_message=error_message,
        payload=_serialize_payload(item),
    )


def _get_run_item_totals(run) -> dict:
    status_totals = {row['item_status']: row['count'] for row in run.items.values('item_status').annotate(count=models.Count('id'))}
    return {
        'created': status_totals.get('created', 0),
        'duplicate_count': status_totals.get('duplicate', 0),
        'filtered_count': status_totals.get('filtered', 0),
        'error_count': status_totals.get('error', 0),
    }


def _persist_crawled_items(source, items: list[dict], system_user, get_embedding, crawl_run=None, record_item_fn=None) -> int:
    from datetime import timedelta

    from pgvector.django import CosineDistance

    from .models import AIConfig, Post

    result = {'created': 0, 'duplicate_count': 0, 'filtered_count': 0, 'error_count': 0}
    record_item_fn = record_item_fn or _record_crawl_item
    is_news_category = bool(source.category and source.category.name.lower() == 'news')
    similarity_threshold = AIConfig.get_config().similarity_threshold if is_news_category else None

    for item in items:
        url = item.get('url', '').strip()
        normalized_url = normalize_source_url(url)
        if not url:
            result['filtered_count'] += 1
            if crawl_run is not None:
                record_item_fn(crawl_run, 'filtered', item, error_message='Missing source URL')
            continue

        if Post.objects.filter(models.Q(normalized_source_url=normalized_url) | models.Q(source_url=url)).exists():
            result['duplicate_count'] += 1
            if crawl_run is not None:
                record_item_fn(crawl_run, 'duplicate', item, error_message='Duplicate source URL')
            continue

        title = item.get('title') or '(No title)'
        content = item.get('content', '')
        vector = get_embedding(f"{title}\n{content}")

        try:
            new_post = Post.objects.create(
                title=title,
                content=content,
                source_url=url,
                normalized_source_url=normalized_url,
                site=source.name,
                category=source.category,
                author=system_user,
                is_draft=False,
                published_at=item.get('published_at'),
                iocs=_extract_iocs(content),
                embedding=vector if vector else None,
            )
            sync_post_cve_mentions(new_post)
        except IntegrityError:
            if Post.objects.filter(models.Q(normalized_source_url=normalized_url) | models.Q(source_url=url)).exists():
                result['duplicate_count'] += 1
                if crawl_run is not None:
                    record_item_fn(crawl_run, 'duplicate', item, error_message='Duplicate source URL')
                continue
            raise
        result['created'] += 1
        if crawl_run is not None:
            record_item_fn(crawl_run, 'created', item, post=new_post)

        if not vector or not is_news_category or similarity_threshold is None:
            continue

        seven_days_ago = timezone.now() - timedelta(days=7)
        closest = Post.objects.filter(
            created_at__gte=seven_days_ago,
            parent_post__isnull=True,
            embedding__isnull=False,
            category__name__iexact='news',
        ).exclude(id=new_post.id).annotate(distance=CosineDistance('embedding', vector)).order_by('distance').first()

        if closest and getattr(closest, 'distance', 1.0) < similarity_threshold:
            closest.parent_post = new_post
            closest.save(update_fields=['parent_post'])
            Post.objects.filter(parent_post=closest.id).exclude(id=closest.id).exclude(id=new_post.id).update(parent_post=new_post)

    return result['created']


def _persist_crawled_items_with_run(source, items: list[dict], system_user, get_embedding, crawl_run, record_item_fn=None) -> dict:
    from datetime import timedelta

    from pgvector.django import CosineDistance

    from .models import AIConfig, Post

    import logging
    logger = logging.getLogger(__name__)

    result = {'created': 0, 'duplicate_count': 0, 'filtered_count': 0, 'error_count': 0}
    record_item_fn = record_item_fn or _record_crawl_item
    is_news_category = bool(source.category and source.category.name.lower() == 'news')
    similarity_threshold = AIConfig.get_config().similarity_threshold if is_news_category else None

    for item in items:
        url = item.get('url', '').strip()
        normalized_url = normalize_source_url(url)
        if not url:
            result['filtered_count'] += 1
            record_item_fn(crawl_run, 'filtered', item, error_message='Missing source URL')
            continue

        try:
            duplicate_detected = False
            new_post = None
            with transaction.atomic():
                if Post.objects.filter(models.Q(normalized_source_url=normalized_url) | models.Q(source_url=url)).exists():
                    duplicate_detected = True
                else:
                    title = item.get('title') or '(제목 없음)'
                    content = item.get('content', '')
                    vector = get_embedding(f"{title}\n{content}")
                    new_post = Post.objects.create(
                        title=title,
                        content=content,
                        source_url=url,
                        normalized_source_url=normalized_url,
                        site=source.name,
                        category=source.category,
                        author=system_user,
                        is_draft=False,
                        published_at=item.get('published_at'),
                        iocs=_extract_iocs(content),
                        embedding=vector if vector else None,
                    )
                    sync_post_cve_mentions(new_post)

                    if vector and is_news_category and similarity_threshold is not None:
                        seven_days_ago = timezone.now() - timedelta(days=7)
                        closest = Post.objects.filter(
                            created_at__gte=seven_days_ago,
                            parent_post__isnull=True,
                            embedding__isnull=False,
                            category__name__iexact='news',
                        ).exclude(id=new_post.id).annotate(distance=CosineDistance('embedding', vector)).order_by('distance').first()
                        if closest and getattr(closest, 'distance', 1.0) < similarity_threshold:
                            closest.parent_post = new_post
                            closest.save(update_fields=['parent_post'])
                            Post.objects.filter(parent_post=closest.id).exclude(id=closest.id).exclude(id=new_post.id).update(parent_post=new_post)

                    record_item_fn(crawl_run, 'created', item, post=new_post)

            if duplicate_detected:
                result['duplicate_count'] += 1
                record_item_fn(crawl_run, 'duplicate', item, error_message='Duplicate source URL')
            elif new_post is not None:
                result['created'] += 1
        except IntegrityError:
            if Post.objects.filter(models.Q(normalized_source_url=normalized_url) | models.Q(source_url=url)).exists():
                result['duplicate_count'] += 1
                record_item_fn(crawl_run, 'duplicate', item, error_message='Duplicate source URL')
                continue
            raise
        except Exception as exc:
            result['error_count'] += 1
            logger.exception(f"[Crawler] 항목 처리 실패 ({source.name}): {exc}")
            record_item_fn(crawl_run, 'error', item, error_message=str(exc))

    return result
