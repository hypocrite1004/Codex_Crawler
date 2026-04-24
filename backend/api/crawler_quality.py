from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from django.utils.html import strip_tags

from .crawler_persistence import normalize_source_url

MIN_CONTENT_CHARS = 200


@dataclass(frozen=True)
class QualityIssue:
    code: str
    severity: str
    message: str


def _plain_text(value: str | None) -> str:
    return ' '.join(strip_tags(value or '').split())


def analyze_post_quality(post) -> list[QualityIssue]:
    issues: list[QualityIssue] = []
    title = (post.title or '').strip()
    content = _plain_text(post.content)
    source_url = (post.source_url or '').strip()
    normalized_source_url = (post.normalized_source_url or '').strip()

    if not title or title.lower() in {'(no title)', '(제목 없음)'}:
        issues.append(QualityIssue('missing_title', 'error', 'Post title is missing or still uses the crawler fallback title.'))

    if not content:
        issues.append(QualityIssue('missing_content', 'error', 'Post content is empty after HTML stripping.'))
    elif len(content) < MIN_CONTENT_CHARS:
        issues.append(QualityIssue('short_content', 'warning', f'Post content is shorter than {MIN_CONTENT_CHARS} characters.'))

    if not source_url:
        issues.append(QualityIssue('missing_source_url', 'error', 'Crawler-created post has no source URL.'))
    elif not normalized_source_url:
        issues.append(QualityIssue('missing_normalized_source_url', 'warning', 'Post has a source URL but no normalized source URL.'))
    else:
        expected_normalized = normalize_source_url(source_url)
        if expected_normalized and expected_normalized != normalized_source_url:
            issues.append(QualityIssue('normalized_source_url_mismatch', 'warning', 'Stored normalized source URL no longer matches the current normalization rule.'))

    if not post.published_at:
        issues.append(QualityIssue('missing_published_at', 'info', 'Post has no original published date.'))

    cve_count = getattr(post, 'cve_count', None)
    if cve_count is None:
        cve_count = post.cve_mentions.count()
    if not (post.iocs or []) and cve_count == 0:
        issues.append(QualityIssue('missing_security_context', 'info', 'Post has no extracted IOC or CVE context yet.'))

    return issues


def summarize_quality(posts: Iterable) -> dict:
    summary = {
        'posts_checked': 0,
        'error_count': 0,
        'warning_count': 0,
        'info_count': 0,
        'issues': {},
        'posts': [],
    }

    for post in posts:
        summary['posts_checked'] += 1
        issues = analyze_post_quality(post)
        if not issues:
            continue

        post_record = {
            'id': post.id,
            'title': post.title,
            'source_url': post.source_url,
            'issues': [],
        }
        for issue in issues:
            summary[f'{issue.severity}_count'] += 1
            issue_summary = summary['issues'].setdefault(
                issue.code,
                {'code': issue.code, 'severity': issue.severity, 'count': 0, 'message': issue.message},
            )
            issue_summary['count'] += 1
            post_record['issues'].append({
                'code': issue.code,
                'severity': issue.severity,
                'message': issue.message,
            })
        summary['posts'].append(post_record)

    return summary


def summarize_quality_by_source(posts: Iterable) -> dict:
    summary = {
        'posts_checked': 0,
        'sources': [],
    }
    sources: dict[tuple[int | None, str], dict] = {}

    for post in posts:
        source = _post_crawler_source(post)
        if source is None:
            continue

        summary['posts_checked'] += 1
        source_id, source_name = source
        source_summary = sources.setdefault(
            (source_id, source_name),
            {
                'source_id': source_id,
                'source_name': source_name,
                'posts_checked': 0,
                'error_count': 0,
                'warning_count': 0,
                'info_count': 0,
                'issues': {},
            },
        )
        source_summary['posts_checked'] += 1

        for issue in analyze_post_quality(post):
            source_summary[f'{issue.severity}_count'] += 1
            issue_summary = source_summary['issues'].setdefault(
                issue.code,
                {'code': issue.code, 'severity': issue.severity, 'count': 0, 'message': issue.message},
            )
            issue_summary['count'] += 1

    for source_summary in sources.values():
        if source_summary['error_count']:
            quality_status = 'error'
        elif source_summary['warning_count']:
            quality_status = 'warning'
        elif source_summary['info_count']:
            quality_status = 'info'
        else:
            quality_status = 'ok'

        source_summary['quality_status'] = quality_status
        source_summary['issue_count'] = (
            source_summary['error_count']
            + source_summary['warning_count']
            + source_summary['info_count']
        )
        source_summary['issues'] = sorted(
            source_summary['issues'].values(),
            key=lambda item: (-item['count'], item['severity'], item['code']),
        )
        summary['sources'].append(source_summary)

    summary['sources'] = sorted(
        summary['sources'],
        key=lambda item: (-item['error_count'], -item['warning_count'], -item['info_count'], item['source_name']),
    )
    return summary


def _post_crawler_source(post) -> tuple[int | None, str] | None:
    crawl_items = getattr(post, 'crawl_items', None)
    if crawl_items is not None:
        all_items = crawl_items.all()
        for item in all_items:
            run = getattr(item, 'run', None)
            source = getattr(run, 'source', None)
            if source is not None:
                return source.id, source.name

    site = (getattr(post, 'site', '') or '').strip()
    if site:
        return None, site
    return None
