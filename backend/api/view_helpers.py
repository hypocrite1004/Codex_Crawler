from urllib.parse import urlparse

from bs4 import BeautifulSoup, Comment as BsComment
from rest_framework import permissions


def is_staff_user(user) -> bool:
    return bool(getattr(user, 'is_authenticated', False) and getattr(user, 'is_staff', False))


def is_admin_user(user) -> bool:
    return bool(getattr(user, 'is_authenticated', False) and getattr(user, 'is_superuser', False))


class IsStaffUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_staff_user(request.user)


class IsSuperUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_admin_user(request.user)


def sanitize_rich_text(html_content: str) -> str:
    """Allow a limited HTML subset for editor content and strip executable payloads."""
    if not html_content:
        return ""

    allowed_tags = {
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
        'a', 'h1', 'h2', 'h3',
    }
    removable_tags = {'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta'}
    allowed_attrs = {'a': {'href', 'target', 'rel'}}

    soup = BeautifulSoup(html_content, 'html.parser')

    for comment in soup.find_all(string=lambda text: isinstance(text, BsComment)):
        comment.extract()

    for tag_name in removable_tags:
        for tag in soup.find_all(tag_name):
            tag.decompose()

    for tag in soup.find_all(True):
        if tag.name not in allowed_tags:
            tag.unwrap()
            continue

        cleaned_attrs: dict[str, str] = {}
        for attr, value in tag.attrs.items():
            if attr not in allowed_attrs.get(tag.name, set()):
                continue

            value_str = ' '.join(value) if isinstance(value, list) else str(value)
            value_str = value_str.strip()

            if tag.name == 'a' and attr == 'href':
                parsed = urlparse(value_str)
                if value_str.startswith('#') or parsed.scheme in {'http', 'https', 'mailto'}:
                    cleaned_attrs['href'] = value_str
            elif tag.name == 'a' and attr == 'target' and value_str == '_blank':
                cleaned_attrs['target'] = '_blank'

        if tag.name == 'a' and 'href' in cleaned_attrs:
            cleaned_attrs['rel'] = 'noopener noreferrer'

        tag.attrs = cleaned_attrs

    return str(soup).strip()
