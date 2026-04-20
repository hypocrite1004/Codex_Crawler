import asyncio
import logging
from urllib.parse import urljoin, urlparse

logger = logging.getLogger(__name__)


def crawl_rss(source) -> tuple[list[dict], str]:
    import feedparser
    import httpx

    status = 'success'
    try:
        response = httpx.get(
            source.url,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'},
            follow_redirects=True,
            timeout=20,
        )
        if response.status_code in (401, 403, 406, 429):
            raise PermissionError(f"HTTP {response.status_code}")
        response.raise_for_status()
        feed = feedparser.parse(response.content)
    except PermissionError as exc:
        logger.warning(f"[Crawler] RSS requires browser fallback: {source.url}")
        try:
            xml_text = asyncio.run(_fetch_with_playwright(source.url, as_xml=True))
            feed = feedparser.parse(xml_text)
            status = 'playwright_fallback'
        except Exception as playwright_error:
            raise ValueError(f"Playwright RSS fallback failed ({exc}): {playwright_error}") from playwright_error
    except Exception as exc:
        feed = feedparser.parse(source.url)
        if not getattr(feed, 'entries', []):
            raise ValueError(f"RSS fetch failed: {exc}") from exc

    if not getattr(feed, 'entries', []):
        raise ValueError("RSS feed returned no entries")

    items = [{
        'title': entry.get('title', '(No title)').strip(),
        'content': (
            entry.get('content', [{}])[0].get('value', '')
            or entry.get('summary', '')
            or entry.get('description', '')
        ),
        'url': entry.get('link', ''),
    } for entry in feed.entries]

    if getattr(source, 'fetch_full_content', False):
        items = _enrich_rss_items(
            items,
            getattr(source, 'full_content_selector', '') or '',
            getattr(source, 'exclude_selectors', '') or '',
        )

    return items, status


def _clean_soup(soup, exclude_selectors: str = ''):
    auto_remove_tags = ['script', 'style', 'iframe', 'noscript', 'svg']
    auto_remove_selectors = [
        'header', 'footer', 'nav', 'aside',
        '[class*="ad"]', '[class*="advert"]', '[class*="banner"]',
        '[class*="popup"]', '[class*="modal"]', '[class*="cookie"]',
        '[class*="subscribe"]', '[class*="newsletter"]',
        '[class*="share"]', '[class*="social"]', '[class*="sns"]',
        '[class*="recommend"]', '[class*="related"]',
        '[class*="comment"]', '[id*="comment"]',
        '[class*="sidebar"]', '[id*="sidebar"]',
        '[class*="navigation"]', '[class*="breadcrumb"]',
        '[class*="copyright"]', '[class*="footer"]',
        '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
    ]
    for tag_name in auto_remove_tags:
        for element in soup.find_all(tag_name):
            element.decompose()
    for selector in auto_remove_selectors:
        for element in soup.select(selector):
            element.decompose()
    if exclude_selectors:
        for selector in [item.strip() for item in exclude_selectors.split(',') if item.strip()]:
            for element in soup.select(selector):
                element.decompose()
    return soup


def _html_to_markdown(html_text: str) -> str:
    if not html_text:
        return ''
    try:
        import re
        from markdownify import markdownify as markdownify
        return re.sub(r'\n{3,}', '\n\n', markdownify(html_text, heading_style='ATX', tables=True)).strip()
    except ImportError:
        import html
        import re
        text = html.unescape(re.sub(r'<[^>]+>', ' ', html_text))
        return re.sub(r'\s+', ' ', text).strip()


def _enrich_rss_items(items: list[dict], content_selector: str, exclude_selectors: str = '') -> list[dict]:
    import concurrent.futures
    import httpx
    from bs4 import BeautifulSoup

    try:
        from newspaper import Article, Config
    except ImportError:
        Article = None
        Config = None

    headers = {'User-Agent': 'Mozilla/5.0 (compatible; SecurNetCrawler/1.0)'}

    def process_single_item(item: dict) -> dict:
        url = item.get('url', '')
        if not url:
            return item
        try:
            response = httpx.get(url, headers=headers, follow_redirects=True, timeout=15)
            if response.status_code in (401, 403, 406, 429):
                raise PermissionError(f"HTTP {response.status_code}")
            response.raise_for_status()
            html_raw = response.content
        except PermissionError:
            try:
                html_text = asyncio.run(_fetch_with_playwright(url))
                html_raw = html_text.encode('utf-8', errors='ignore')
            except Exception:
                return item
        except Exception:
            return item

        try:
            raw_html_text = html_raw.decode('utf-8', errors='ignore') if isinstance(html_raw, bytes) else html_raw
            cleaned_soup = _clean_soup(BeautifulSoup(raw_html_text, 'lxml'), exclude_selectors)
            full_text = ''
            content_html = ''
            if content_selector:
                selected = cleaned_soup.select_one(content_selector)
                if selected:
                    content_html = selected.decode_contents()
                    full_text = _html_to_markdown(content_html)
            if not full_text and Article:
                config = Config() if Config else None
                if config:
                    config.browser_user_agent = headers['User-Agent']
                    config.keep_article_html = True
                article = Article(url, config=config)
                article.set_html(raw_html_text)
                article.parse()
                if getattr(article, 'article_html', ''):
                    extracted = _clean_soup(BeautifulSoup(article.article_html, 'lxml'), exclude_selectors)
                    content_html = extracted.decode_contents() or str(extracted)
                    full_text = _html_to_markdown(content_html)
                else:
                    full_text = article.text
                if article.publish_date:
                    item['published_at'] = article.publish_date
            if not full_text:
                for selector in ['article', 'main', '[role="main"]', 'body']:
                    selected = cleaned_soup.select_one(selector)
                    if selected:
                        content_html = selected.decode_contents()
                        full_text = _html_to_markdown(content_html)
                        break
            if full_text:
                item = {**item, 'content': full_text, 'content_html': content_html}
        except Exception:
            return item
        return item

    enriched_items: list[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(process_single_item, item.copy()) for item in items]
        for future in concurrent.futures.as_completed(futures):
            enriched_items.append(future.result())
    return enriched_items


def _parse_html(html_data, source, base_url: str) -> list[dict]:
    import concurrent.futures
    from bs4 import BeautifulSoup

    try:
        from newspaper import Article, Config
    except ImportError:
        Article = None
        Config = None

    raw_html_text = html_data.decode('utf-8', errors='ignore') if isinstance(html_data, bytes) else html_data
    soup = BeautifulSoup(raw_html_text, 'lxml')
    cleaned_soup = _clean_soup(BeautifulSoup(raw_html_text, 'lxml'), source.exclude_selectors)

    newspaper_config = None
    if Config:
        newspaper_config = Config()
        newspaper_config.browser_user_agent = (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
            '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        newspaper_config.request_timeout = 15

    if not source.article_list_selector:
        page_title = cleaned_soup.select_one(source.title_selector).get_text(strip=True) if source.title_selector and cleaned_soup.select_one(source.title_selector) else (soup.title.string if soup.title else '')
        content = ''
        content_html = ''
        published_at = None
        if source.content_selector:
            content_element = cleaned_soup.select_one(source.content_selector)
            if content_element:
                content_html = content_element.decode_contents()
                content = _html_to_markdown(content_html)
        if (not page_title or not content) and Article:
            if newspaper_config:
                newspaper_config.keep_article_html = True
            article = Article(source.url, config=newspaper_config)
            article.set_html(raw_html_text)
            article.parse()
            if not page_title:
                page_title = article.title
            if not content:
                if getattr(article, 'article_html', ''):
                    extracted = _clean_soup(BeautifulSoup(article.article_html, 'lxml'), source.exclude_selectors)
                    content_html = extracted.decode_contents() or str(extracted)
                    content = _html_to_markdown(content_html)
                else:
                    content = article.text
            if article.publish_date:
                published_at = article.publish_date
        return [{'title': page_title, 'content': content, 'content_html': content_html, 'url': source.url, 'published_at': published_at}]

    def process_single_item(item_html: str) -> dict | None:
        import httpx

        item_soup = BeautifulSoup(item_html, 'lxml')
        link_element = item_soup.select_one(source.article_link_selector) if source.article_link_selector else item_soup.find('a')
        if not link_element:
            return None
        href = link_element.get('href', '')
        if not href:
            return None
        full_url = urljoin(base_url, href)
        title_element = item_soup.select_one(source.title_selector) if source.title_selector else link_element
        title = title_element.get_text(strip=True) if title_element else href
        content = ''
        content_html = ''
        published_at = None
        if source.content_selector:
            content_element = item_soup.select_one(source.content_selector)
            if content_element:
                content_html = content_element.decode_contents()
                content = _html_to_markdown(content_html)
        if (not title or not content) and Article:
            html_text = ''
            try:
                headers = {'User-Agent': newspaper_config.browser_user_agent if newspaper_config else 'Mozilla/5.0'}
                response = httpx.get(full_url, headers=headers, follow_redirects=True, timeout=15)
                if response.status_code in (401, 403, 406, 429):
                    raise PermissionError(f"HTTP {response.status_code}")
                response.raise_for_status()
                html_text = response.text
            except PermissionError:
                try:
                    html_text = asyncio.run(_fetch_with_playwright(full_url))
                except Exception:
                    html_text = ''
            except Exception:
                html_text = ''
            if html_text:
                try:
                    if newspaper_config:
                        newspaper_config.keep_article_html = True
                    article = Article(full_url, config=newspaper_config)
                    article.set_html(html_text)
                    article.parse()
                    if not title:
                        title = article.title
                    if not content:
                        if getattr(article, 'article_html', ''):
                            extracted = _clean_soup(BeautifulSoup(article.article_html, 'lxml'), source.exclude_selectors)
                            content_html = extracted.decode_contents() or str(extracted)
                            content = _html_to_markdown(content_html)
                        else:
                            content = article.text
                    if article.publish_date:
                        published_at = article.publish_date
                except Exception:
                    pass
        return {'title': title, 'content': content, 'content_html': content_html, 'url': full_url, 'published_at': published_at}

    items: list[dict] = []
    raw_items = [str(item) for item in soup.select(source.article_list_selector)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(process_single_item, item_html) for item_html in raw_items]
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            if result:
                items.append(result)
    return items


async def _fetch_with_httpx(source) -> tuple[bytes, str]:
    import httpx

    headers = source.request_headers or {}
    if 'User-Agent' not in headers:
        headers['User-Agent'] = 'Mozilla/5.0 (compatible; SecurNetCrawler/1.0)'
    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        if source.http_method == 'POST':
            response = await client.post(source.url, headers=headers, json=source.request_body or None)
        else:
            response = await client.get(source.url, headers=headers)
    if response.status_code == 403:
        raise PermissionError(f"403 Forbidden: {source.url}")
    response.raise_for_status()
    return response.content, 'success'


async def _fetch_with_playwright(url: str, as_xml: bool = False) -> str:
    from playwright.async_api import async_playwright

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
        )
        context = await browser.new_context(
            user_agent=(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                '(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            ),
            viewport={'width': 1920, 'height': 1080},
            device_scale_factor=1,
            has_touch=False,
            is_mobile=False,
        )
        await context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        page = await context.new_page()
        response = await page.goto(url, wait_until='domcontentloaded', timeout=30000)
        if not as_xml:
            await page.wait_for_timeout(4000)
        content = await response.text() if as_xml and response else await page.content()
        await browser.close()
        return content


def crawl_html(source) -> tuple[list[dict], str]:
    base_url = f"{urlparse(source.url).scheme}://{urlparse(source.url).netloc}"
    status = 'success'
    try:
        html_data, _ = asyncio.run(_fetch_with_httpx(source))
    except PermissionError:
        logger.warning(f"[Crawler] HTML requires browser fallback: {source.url}")
        html_data = asyncio.run(_fetch_with_playwright(source.url))
        status = 'playwright_fallback'
    items = _parse_html(html_data, source, base_url)
    if getattr(source, 'fetch_full_content', False):
        items = _enrich_rss_items(
            items,
            getattr(source, 'full_content_selector', '') or '',
            getattr(source, 'exclude_selectors', '') or '',
        )
    return items, status
