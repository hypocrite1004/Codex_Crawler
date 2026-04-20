import html as html_lib
import re

from .crawler_fetchers import crawl_html, crawl_rss


class _SourceProxy:
    def __init__(self, data: dict):
        self.url = data.get('url', '')
        self.source_type = data.get('source_type', 'rss')
        self.http_method = data.get('http_method', 'GET')
        self.request_headers = data.get('request_headers') or {}
        self.request_body = data.get('request_body') or {}
        self.article_list_selector = data.get('article_list_selector', '')
        self.article_link_selector = data.get('article_link_selector', '')
        self.title_selector = data.get('title_selector', '')
        self.content_selector = data.get('content_selector', '')
        self.date_selector = data.get('date_selector', '')
        self.fetch_full_content = data.get('fetch_full_content', False)
        self.full_content_selector = data.get('full_content_selector', '')
        self.exclude_selectors = data.get('exclude_selectors', '')


def preview_crawl(data: dict, limit: int = 10) -> dict:
    proxy = _SourceProxy(data)

    try:
        if proxy.source_type == 'rss':
            items, status = crawl_rss(proxy)
        else:
            items, status = crawl_html(proxy)
    except Exception as exc:
        return {'items': [], 'status': 'error', 'error': str(exc)}

    preview_items = []
    for item in items[:limit]:
        raw_content = item.get('content', '')
        content_text = html_lib.unescape(re.sub(r'<[^>]+>', ' ', raw_content))
        content_text = re.sub(r'\s+', ' ', content_text).strip()
        preview_items.append({
            'title': item.get('title', ''),
            'url': item.get('url', ''),
            'content_preview': content_text[:200] + ('...' if len(content_text) > 200 else ''),
            'content': raw_content,
            'content_html': item.get('content_html', ''),
        })

    return {'items': preview_items, 'status': status, 'error': ''}
