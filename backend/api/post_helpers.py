import json
import os
import re
import html as html_lib

from django.utils import timezone
from django.utils.html import strip_tags

from .models import AIConfig, Post

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


def html_to_plain(html_content: str) -> str:
    """Convert HTML article content to clean plain text for LLM input."""
    text = html_lib.unescape(html_content)
    text = strip_tags(text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _normalize_summary_text(value, field_name: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f'{field_name} must be a string.')

    normalized = strip_tags(value).strip()
    if not normalized:
        raise ValueError(f'{field_name} may not be blank.')
    return normalized


def _normalize_summary_section(section: dict) -> dict:
    if not isinstance(section, dict):
        raise ValueError('Each section must be an object.')

    caption = _normalize_summary_text(section.get('caption'), 'caption')
    content = section.get('content')
    if not isinstance(content, list) or not content:
        raise ValueError('Each section must include a non-empty content list.')

    normalized_content = []
    for item in content:
        if isinstance(item, str):
            normalized_content.append(_normalize_summary_text(item, 'content item'))
        elif isinstance(item, dict):
            normalized_content.append(_normalize_summary_section(item))
        else:
            raise ValueError('Section content items must be strings or nested sections.')

    return {
        'caption': caption,
        'content': normalized_content,
    }


def normalize_summary_payload(payload) -> dict:
    if not isinstance(payload, dict):
        raise ValueError('Summary payload must be a JSON object.')

    allowed_keys = {'title', 'brief', 'summary', 'hashtag', 'sections'}
    unknown_keys = set(payload) - allowed_keys
    if unknown_keys:
        raise ValueError(f'Unsupported summary keys: {", ".join(sorted(unknown_keys))}.')

    normalized: dict = {}
    for field in ('title', 'brief', 'summary'):
        if field in payload and payload[field] not in (None, ''):
            normalized[field] = _normalize_summary_text(payload[field], field)

    hashtags = payload.get('hashtag')
    if hashtags is not None:
        if not isinstance(hashtags, list):
            raise ValueError('hashtag must be a list of strings.')
        normalized_tags = []
        for tag in hashtags:
            normalized_tags.append(_normalize_summary_text(tag, 'hashtag'))
        if normalized_tags:
            normalized['hashtag'] = normalized_tags

    sections = payload.get('sections')
    if sections is not None:
        if not isinstance(sections, list):
            raise ValueError('sections must be a list.')
        normalized_sections = [_normalize_summary_section(section) for section in sections]
        if normalized_sections:
            normalized['sections'] = normalized_sections

    if not normalized:
        raise ValueError('Summary payload must contain at least one supported field.')

    return normalized


def generate_summary_payload(post: Post) -> dict:
    config = AIConfig.get_config()
    api_key = os.environ.get('OPENAI_API_KEY', '')

    if not OPENAI_AVAILABLE:
        raise RuntimeError('OpenAI client is not installed.')
    if not api_key or api_key.startswith('sk-dummy'):
        raise RuntimeError('AI summary generation is not configured.')

    client = OpenAI(api_key=api_key)
    plain_content = html_to_plain(post.content)
    response = client.chat.completions.create(
        model=config.model,
        messages=[
            {'role': 'system', 'content': config.system_prompt},
            {'role': 'user', 'content': f'Article:\n{plain_content}'},
        ],
        max_tokens=config.max_tokens,
        temperature=config.temperature,
    )
    raw = response.choices[0].message.content or ''
    clean = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw.strip(), flags=re.MULTILINE)
    parsed = json.loads(clean)
    return normalize_summary_payload(parsed)


def apply_post_status(post: Post, next_status: str, actor=None, rejection_reason: str = ''):
    now = timezone.now()
    post.status = next_status
    post.is_draft = next_status != 'published'

    if next_status == 'draft':
        post.approval_requested_at = None
        post.approved_by = None
        post.approved_at = None
        post.rejected_by = None
        post.rejected_at = None
        post.rejection_reason = ''
        post.archived_at = None
    elif next_status == 'review':
        post.approval_requested_at = now
        post.approved_by = None
        post.approved_at = None
        post.rejected_by = None
        post.rejected_at = None
        post.rejection_reason = ''
        post.archived_at = None
    elif next_status == 'rejected':
        post.rejected_by = actor if getattr(actor, 'is_authenticated', False) else None
        post.rejected_at = now
        post.rejection_reason = rejection_reason
        post.archived_at = None
    elif next_status == 'published':
        post.approved_by = actor if getattr(actor, 'is_authenticated', False) else post.approved_by
        post.approved_at = now
        post.rejected_by = None
        post.rejected_at = None
        post.rejection_reason = ''
        post.archived_at = None
    elif next_status == 'archived':
        post.archived_at = now
