import json
from dataclasses import dataclass
from datetime import date, datetime, time

from django.utils import timezone


@dataclass(frozen=True)
class LegacyContentSpec:
    table_name: str
    category_name: str
    comment_table: str | None
    supports_summary: bool = False
    supports_share_flag: bool = False


LEGACY_CONTENT_SPECS = {
    'myapp_news': LegacyContentSpec(
        table_name='myapp_news',
        category_name='news',
        comment_table='myapp_newscomment',
        supports_summary=True,
        supports_share_flag=True,
    ),
    'myapp_guide': LegacyContentSpec(
        table_name='myapp_guide',
        category_name='guide',
        comment_table='myapp_guidecomment',
    ),
    'myapp_advice': LegacyContentSpec(
        table_name='myapp_advice',
        category_name='advice',
        comment_table='myapp_advicecomment',
    ),
}


LEGACY_STATUS_MAP = {
    'needs_review': 'published',
    'review': 'published',
    'pending': 'published',
    'processing': 'published',
    'draft': 'draft',
    'temp': 'draft',
    'published': 'published',
    'done': 'published',
    'completed': 'published',
    'shared': 'published',
    'archived': 'archived',
    'ignored': 'archived',
    'skip': 'archived',
    'rejected': 'rejected',
}


def get_legacy_content_specs(table_names: list[str] | None = None) -> list[LegacyContentSpec]:
    if not table_names:
        return list(LEGACY_CONTENT_SPECS.values())
    return [LEGACY_CONTENT_SPECS[name] for name in table_names if name in LEGACY_CONTENT_SPECS]


def map_legacy_status(raw_status: str | None) -> str:
    normalized = (raw_status or '').strip().lower()
    if not normalized:
        return 'review'
    return LEGACY_STATUS_MAP.get(normalized, 'review')


def coerce_legacy_datetime(value) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt_value = value
    elif isinstance(value, date):
        dt_value = datetime.combine(value, time.min)
    elif isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        try:
            dt_value = datetime.fromisoformat(raw.replace('Z', '+00:00'))
        except ValueError:
            for fmt in ('%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d'):
                try:
                    dt_value = datetime.strptime(raw, fmt)
                    break
                except ValueError:
                    continue
            else:
                return None
    else:
        return None

    if timezone.is_naive(dt_value):
        return timezone.make_aware(dt_value, timezone.get_current_timezone())
    return timezone.localtime(dt_value, timezone.get_current_timezone())


def extract_legacy_summary(parsed_summary, original_summary) -> str | None:
    parsed = (parsed_summary or '').strip() if isinstance(parsed_summary, str) else ''
    if parsed:
        return parsed

    if isinstance(original_summary, (dict, list)):
        payload = original_summary
    else:
        raw = (original_summary or '').strip() if isinstance(original_summary, str) else ''
        if not raw:
            return None
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            return raw

    if isinstance(payload, dict):
        summary = (payload.get('summary') or '').strip()
        brief = (payload.get('brief') or '').strip()
        title = (payload.get('title') or '').strip()
        parts = [part for part in [title, brief, summary] if part]
        if parts:
            return '\n\n'.join(parts)
        return json.dumps(payload, ensure_ascii=False)

    if isinstance(payload, list):
        parts = [str(item).strip() for item in payload if str(item).strip()]
        return '\n'.join(parts) if parts else None

    return str(payload).strip() or None
