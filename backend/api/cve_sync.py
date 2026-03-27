import json
import re
from html import unescape
from typing import Any

from django.db import transaction
from django.db.models import Count
from django.utils.html import strip_tags

from api.models import CveRecord, Post, PostCveMention

CVE_PATTERN = re.compile(r'\bCVE[-\s]?(\d{4})[-\s]?(\d{4,})\b', re.IGNORECASE)


def normalize_cve_id(raw_value: str) -> str | None:
    match = CVE_PATTERN.search(raw_value or '')
    if not match:
        return None
    return f'CVE-{match.group(1)}-{match.group(2)}'.upper()


def extract_cve_ids(text: str) -> set[str]:
    normalized: set[str] = set()
    for match in CVE_PATTERN.finditer(text or ''):
        normalized.add(f'CVE-{match.group(1)}-{match.group(2)}'.upper())
    return normalized


def _summary_to_text(summary_value: str | None) -> str:
    if not summary_value:
        return ''
    raw = summary_value.strip()
    if not raw:
        return ''
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return strip_tags(unescape(raw))

    parts: list[str] = []

    def walk(node):
        if isinstance(node, dict):
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)
        elif node is not None:
            parts.append(str(node))

    walk(payload)
    return '\n'.join(parts)


def build_post_cve_map(post: Post) -> dict[str, str]:
    title_text = strip_tags(unescape(post.title or ''))
    content_text = strip_tags(unescape(post.content or ''))
    summary_text = _summary_to_text(post.summary)

    title_matches = extract_cve_ids(title_text)
    content_matches = extract_cve_ids('\n'.join([content_text, summary_text]))
    all_matches = title_matches | content_matches

    result: dict[str, str] = {}
    for cve_id in all_matches:
        in_title = cve_id in title_matches
        in_content = cve_id in content_matches
        if in_title and in_content:
            result[cve_id] = 'both'
        elif in_title:
            result[cve_id] = 'title'
        else:
            result[cve_id] = 'content'
    return result


def refresh_cve_metrics(cve_ids: set[str] | list[str], dry_run: bool = False) -> dict[str, dict[str, Any]]:
    normalized_ids = sorted({cve_id for cve_id in cve_ids if cve_id})
    if not normalized_ids:
        return {}

    aggregated = {
        row['cve_id']: row
        for row in (
            CveRecord.objects
            .filter(cve_id__in=normalized_ids)
            .annotate(current_mention_count=Count('post_mentions', distinct=True))
            .values('id', 'cve_id', 'current_mention_count')
        )
    }

    stats: dict[str, dict[str, Any]] = {}
    update_fields = ['mention_count']
    records_to_update: list[CveRecord] = []

    for cve_id in normalized_ids:
        row = aggregated.get(cve_id)
        if row is None:
            continue

        current_count = int(row['current_mention_count'] or 0)

        stats[cve_id] = {
            'mention_count': current_count,
        }

        if dry_run:
            continue

        records_to_update.append(
            CveRecord(
                id=row['id'],
                cve_id=cve_id,
                mention_count=current_count,
            )
        )

    if records_to_update and not dry_run:
        CveRecord.objects.bulk_update(records_to_update, fields=update_fields)

    return stats


def sync_post_cve_mentions(post: Post, source: str = 'auto_extract', dry_run: bool = False) -> dict[str, Any]:
    extracted = build_post_cve_map(post)
    stats = {
        'post_id': post.id,
        'extracted_count': len(extracted),
        'created': 0,
        'updated': 0,
        'removed': 0,
        'noop': 0,
        'skipped_existing': 0,
        'refreshed_cves': 0,
    }

    with transaction.atomic():
        affected_cve_ids: set[str] = set(extracted)
        existing_mentions = {
            mention.cve.cve_id: mention
            for mention in (
                PostCveMention.objects
                .select_related('cve')
                .filter(post=post, source=source)
            )
        }
        all_mentions = {
            mention.cve.cve_id: mention
            for mention in (
                PostCveMention.objects
                .select_related('cve')
                .filter(post=post)
            )
        }

        stale_ids = set(existing_mentions) - set(extracted)
        if stale_ids:
            affected_cve_ids.update(stale_ids)
            stats['removed'] += len(stale_ids)
            if not dry_run:
                PostCveMention.objects.filter(
                    post=post,
                    source=source,
                    cve__cve_id__in=stale_ids,
                ).delete()

        for cve_id, mentioned_in in extracted.items():
            existing_mention = all_mentions.get(cve_id)
            if existing_mention is not None and existing_mention.source != source:
                stats['skipped_existing'] += 1
                continue

            cve_defaults = {
                'mention_count': 0,
                'legacy_mention_count': 0,
                'first_seen': post.published_at or post.created_at,
                'last_seen': post.published_at or post.created_at,
            }
            if dry_run:
                cve = CveRecord.objects.filter(cve_id=cve_id).first()
                if cve is None:
                    cve = CveRecord(cve_id=cve_id, **cve_defaults)
            else:
                cve, _ = CveRecord.objects.get_or_create(
                    cve_id=cve_id,
                    defaults=cve_defaults,
                )

            mention = existing_mentions.get(cve_id)
            update_fields: list[str] = []
            if mention is None:
                stats['created'] += 1
                if dry_run:
                    mention = PostCveMention(
                        post=post,
                        cve=cve,
                        source=source,
                        mentioned_in=mentioned_in,
                        legacy_reference_ids=[],
                    )
                else:
                    PostCveMention.objects.create(
                        post=post,
                        cve=cve,
                        source=source,
                        mentioned_in=mentioned_in,
                        legacy_reference_ids=[],
                    )
                    mention = PostCveMention(
                        post=post,
                        cve=cve,
                        source=source,
                        mentioned_in=mentioned_in,
                        legacy_reference_ids=[],
                    )
            else:
                if mention.mentioned_in != mentioned_in:
                    mention.mentioned_in = mentioned_in
                    update_fields.append('mentioned_in')
                if update_fields:
                    stats['updated'] += 1
                    if not dry_run:
                        mention.save(update_fields=update_fields)
                else:
                    stats['noop'] += 1
                if cve_id not in existing_mentions:
                    existing_mentions[cve_id] = mention

            observed_at = post.published_at or post.created_at
            cve_updates: list[str] = []
            if observed_at and (cve.first_seen is None or observed_at < cve.first_seen):
                cve.first_seen = observed_at
                cve_updates.append('first_seen')
            if observed_at and (cve.last_seen is None or observed_at > cve.last_seen):
                cve.last_seen = observed_at
                cve_updates.append('last_seen')
            if cve_updates and not dry_run:
                cve.save(update_fields=cve_updates)

        refresh_stats = refresh_cve_metrics(affected_cve_ids, dry_run=dry_run)
        stats['refreshed_cves'] = len(refresh_stats)

        if dry_run:
            transaction.set_rollback(True)

    return stats
