"""
??鸚룸슚異???釉먯뒭??
- RSS/Atom ?????
- HTML ???袁⑹뵫???얜Ŧ已?
- Playwright ???μ쪠??
- ????덈틖 ???ㅺ컼????⑤베毓?? ????? ?棺??짆????れ삀??쎈뭄?
"""
import asyncio
import logging
import time
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

from django.contrib.auth.models import User
from django.db import IntegrityError, models, transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

from .crawler_security import CrawlerSecurityError, validate_crawler_request_config
from .cve_sync import sync_post_cve_mentions


def crawl_rss(source) -> tuple[list[dict], str]:
    """RSS/Atom ???⑤벚???????????れ삀?節놁쒜?癲ル슢?꾤땟戮⑤뭄???袁⑸즵????筌뤾퍓???"""
    import feedparser
    import httpx

    status = 'success'

    try:
        response = httpx.get(
            source.url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
            },
            follow_redirects=True,
            timeout=20,
        )
        if response.status_code in (401, 403, 406, 429):
            raise PermissionError(f"HTTP {response.status_code}")
        response.raise_for_status()
        feed = feedparser.parse(response.content)
    except PermissionError as exc:
        logger.warning(f"[Crawler] RSS 癲ル슓堉곁땟??????쑩?젆???좊즴??, Playwright??????? {source.url}")
        try:
            xml_text = asyncio.run(_fetch_with_playwright(source.url, as_xml=True))
            feed = feedparser.parse(xml_text)
            status = 'playwright_fallback'
        except Exception as playwright_error:
            raise ValueError(f"Playwright RSS ???μ쪠??????됰꽡 ({exc}): {playwright_error}") from playwright_error
    except Exception as exc:
        feed = feedparser.parse(source.url)
        if not getattr(feed, 'entries', []):
            raise ValueError(f"RSS ?棺??짆?삠궘?????됰꽡: {exc}") from exc

    if not getattr(feed, 'entries', []):
        raise ValueError("RSS ???⑤벚???????????癲ル슓??젆? 癲ル슢履뉑쾮?彛??????")

    items = []
    for entry in feed.entries:
        items.append({
            'title': entry.get('title', '(??筌먯룄肄????⑤챶苡?').strip(),
            'content': (
                entry.get('content', [{}])[0].get('value', '')
                or entry.get('summary', '')
                or entry.get('description', '')
            ),
            'url': entry.get('link', ''),
        })

    if getattr(source, 'fetch_full_content', False):
        selector = getattr(source, 'full_content_selector', '') or ''
        exclude_selectors = getattr(source, 'exclude_selectors', '') or ''
        items = _enrich_rss_items(items, selector, exclude_selectors)

    return items, status


def _clean_soup(soup, exclude_selectors: str = ''):
    """???뱁꺁????낆뒩?? ??釉먯뒠?????癰귙끋源???嶺뚮Ĳ????soup???袁⑸즵????筌뤾퍓???"""
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
    """HTML ?釉뚰??㉱??Markdown ??れ삀??뫢?????몄릇?嶺뚮ㅎ?붷ㅇ??怨뚮뼚?????????덊렡."""
    if not html_text:
        return ''

    try:
        import re

        from markdownify import markdownify as markdownify

        markdown_text = markdownify(html_text, heading_style='ATX', tables=True)
        return re.sub(r'\n{3,}', '\n\n', markdown_text).strip()
    except ImportError:
        import html
        import re

        text = html.unescape(re.sub(r'<[^>]+>', ' ', html_text))
        return re.sub(r'\s+', ' ', text).strip()


def _enrich_rss_items(items: list[dict], content_selector: str, exclude_selectors: str = '') -> list[dict]:
    """????れ삀?節놁쒜?URL??????????怨뚮옖筌?쑜猷???怨뚮옖?????筌뤾퍓???"""
    import concurrent.futures

    import httpx
    from bs4 import BeautifulSoup

    try:
        from newspaper import Article, Config
    except ImportError:
        Article = None
        Config = None
        logger.warning("newspaper3k??좊읈? ????몃???筌뚯슦苑???? ????깅떋 ??? ??⑤베毓????れ삀????癲꾧퀗??????ㅿ폍???")

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
            logger.warning(f"[Crawler] ???ㅳ늾?????쒓낮?꾬┼??넊? 癲ル슓堉곁땟??????쑩?젆???좊즴??, Playwright??????? {url}")
            try:
                html_text = asyncio.run(_fetch_with_playwright(url))
                html_raw = html_text.encode('utf-8', errors='ignore')
            except Exception as playwright_error:
                logger.warning(f"[Crawler] Playwright ???μ쪠??????됰꽡 ({url}): {playwright_error}")
                return item
        except Exception as exc:
            logger.warning(f"[Crawler] ???ㅳ늾?????쒓낮?꾬┼??넊? ??釉먯뒜??????됰꽡 ({url}): {exc}")
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
        except Exception as exc:
            logger.warning(f"[Crawler] ?怨뚮옖筌?쑜猷??????????됰꽡 ({url}): {exc}")

        return item

    enriched_items: list[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(process_single_item, item.copy()) for item in items]
        for future in concurrent.futures.as_completed(futures):
            enriched_items.append(future.result())

    return enriched_items


def _parse_html(html_data, source, base_url: str) -> list[dict]:
    """HTML ???쒓낮?꾬┼??넊???source ???源놁젳??癲ル슢??????????筌뤾퍓???"""
    import concurrent.futures

    from bs4 import BeautifulSoup

    try:
        from newspaper import Article, Config
    except ImportError:
        Article = None
        Config = None
        logger.warning("newspaper3k??좊읈? ????몃???筌뚯슦苑???? ????깅떋 ??? ??⑤베毓????れ삀????癲꾧퀗??????ㅿ폍???")

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

        return [{
            'title': page_title,
            'content': content,
            'content_html': content_html,
            'url': source.url,
            'published_at': published_at,
        }]

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
                except Exception as playwright_error:
                    logger.warning(f"[Crawler] Playwright fallback ????됰꽡 ({full_url}): {playwright_error}")
            except Exception as exc:
                logger.warning(f"[Crawler] ??れ삀?節놁쒜?HTML ??釉먯뒜??????됰꽡 ({full_url}): {exc}")

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
                except Exception as exc:
                    logger.warning(f"[Crawler] newspaper ?????????됰꽡 ({full_url}): {exc}")

        return {
            'title': title,
            'content': content,
            'content_html': content_html,
            'url': full_url,
            'published_at': published_at,
        }

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
    """httpx??HTML????좊읈??嶺뚮ㅎ?닸묾????덊렡. 403?? PermissionError????ш끽維???筌뤾퍓???"""
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
    """Playwright?????쒓낮?꾬┼??넊?????좊읈??嶺뚮ㅎ?닸묾????덊렡."""
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

        if as_xml and response:
            content = await response.text()
        else:
            content = await page.content()

        await browser.close()
        return content


def crawl_html(source) -> tuple[list[dict], str]:
    """HTML ???袁⑹뵫???얜Ŧ已?????얜Ŧ類??筌뤾퍓???"""
    base_url = f"{urlparse(source.url).scheme}://{urlparse(source.url).netloc}"
    status = 'success'

    try:
        html_data, _ = asyncio.run(_fetch_with_httpx(source))
    except PermissionError:
        logger.warning(f"[Crawler] HTML 癲ル슓堉곁땟??????쑩?젆???좊즴??, Playwright??????? {source.url}")
        html_data = asyncio.run(_fetch_with_playwright(source.url))
        status = 'playwright_fallback'

    items = _parse_html(html_data, source, base_url)

    if getattr(source, 'fetch_full_content', False):
        selector = getattr(source, 'full_content_selector', '') or ''
        exclude_selectors = getattr(source, 'exclude_selectors', '') or ''
        items = _enrich_rss_items(items, selector, exclude_selectors)

    return items, status


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
    return {
        key: (value.isoformat() if hasattr(value, 'isoformat') else value)
        for key, value in item.items()
    }


def normalize_source_url(url: str) -> str:
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

    netloc = hostname
    if port:
        netloc = f'{hostname}:{port}'

    path = parsed.path or '/'
    if path != '/' and path.endswith('/'):
        path = path.rstrip('/')

    tracking_keys = {
        'fbclid',
        'gclid',
        'mc_cid',
        'mc_eid',
        'mkt_tok',
        '_hsenc',
        '_hsmi',
    }
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
    normalized_url = normalize_source_url(raw_url)
    CrawlItem.objects.create(
        run=run,
        post=post,
        item_status=item_status,
        source_url=raw_url,
        normalized_url=normalized_url,
        title=(item.get('title') or '')[:255],
        error_message=error_message,
        payload=_serialize_payload(item),
    )


def _get_run_item_totals(run) -> dict:
    status_totals = {
        row['item_status']: row['count']
        for row in run.items.values('item_status').annotate(count=models.Count('id'))
    }
    return {
        'created': status_totals.get('created', 0),
        'duplicate_count': status_totals.get('duplicate', 0),
        'filtered_count': status_totals.get('filtered', 0),
        'error_count': status_totals.get('error', 0),
    }


def _persist_crawled_items(source, items: list[dict], system_user, get_embedding, crawl_run=None) -> int:
    from datetime import timedelta

    from pgvector.django import CosineDistance

    from .models import AIConfig, Post

    result = {
        'created': 0,
        'duplicate_count': 0,
        'filtered_count': 0,
        'error_count': 0,
    }
    is_news_category = bool(source.category and source.category.name.lower() == 'news')
    similarity_threshold = AIConfig.get_config().similarity_threshold if is_news_category else None

    for item in items:
        url = item.get('url', '').strip()
        normalized_url = normalize_source_url(url)
        if not url:
            result['filtered_count'] += 1
            if crawl_run is not None:
                _record_crawl_item(crawl_run, 'filtered', item, error_message='Missing source URL')
            continue

        if Post.objects.filter(
            models.Q(normalized_source_url=normalized_url) | models.Q(source_url=url)
        ).exists():
            result['duplicate_count'] += 1
            if crawl_run is not None:
                _record_crawl_item(crawl_run, 'duplicate', item, error_message='Duplicate source URL')
            continue

        title = item.get('title') or '(??筌먯룄肄????⑤챶苡?'
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
            if Post.objects.filter(
                models.Q(normalized_source_url=normalized_url) | models.Q(source_url=url)
            ).exists():
                result['duplicate_count'] += 1
                if crawl_run is not None:
                    _record_crawl_item(crawl_run, 'duplicate', item, error_message='Duplicate source URL')
                continue
            raise
        result['created'] += 1
        if crawl_run is not None:
            _record_crawl_item(crawl_run, 'created', item, post=new_post)

        if not vector or not is_news_category or similarity_threshold is None:
            continue

        seven_days_ago = timezone.now() - timedelta(days=7)
        closest = Post.objects.filter(
            created_at__gte=seven_days_ago,
            parent_post__isnull=True,
            embedding__isnull=False,
            category__name__iexact='news',
        ).exclude(id=new_post.id).annotate(
            distance=CosineDistance('embedding', vector)
        ).order_by('distance').first()

        if closest and getattr(closest, 'distance', 1.0) < similarity_threshold:
            closest.parent_post = new_post
            closest.save(update_fields=['parent_post'])
            Post.objects.filter(parent_post=closest.id).exclude(id=closest.id).exclude(id=new_post.id).update(parent_post=new_post)

    return result['created']


def _persist_crawled_items_with_run(source, items: list[dict], system_user, get_embedding, crawl_run) -> dict:
    from datetime import timedelta

    from pgvector.django import CosineDistance

    from .models import AIConfig, Post

    result = {
        'created': 0,
        'duplicate_count': 0,
        'filtered_count': 0,
        'error_count': 0,
    }
    is_news_category = bool(source.category and source.category.name.lower() == 'news')
    similarity_threshold = AIConfig.get_config().similarity_threshold if is_news_category else None

    for item in items:
        url = item.get('url', '').strip()
        normalized_url = normalize_source_url(url)
        if not url:
            result['filtered_count'] += 1
            _record_crawl_item(crawl_run, 'filtered', item, error_message='Missing source URL')
            continue

        try:
            duplicate_detected = False
            new_post = None
            with transaction.atomic():
                if Post.objects.filter(
                    models.Q(normalized_source_url=normalized_url) | models.Q(source_url=url)
                ).exists():
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
                        ).exclude(id=new_post.id).annotate(
                            distance=CosineDistance('embedding', vector)
                        ).order_by('distance').first()

                        if closest and getattr(closest, 'distance', 1.0) < similarity_threshold:
                            closest.parent_post = new_post
                            closest.save(update_fields=['parent_post'])
                            Post.objects.filter(parent_post=closest.id).exclude(id=closest.id).exclude(id=new_post.id).update(parent_post=new_post)

                    # created 기록은 Post 생성과 같은 transaction 안에서만 확정합니다.
                    _record_crawl_item(crawl_run, 'created', item, post=new_post)

            if duplicate_detected:
                result['duplicate_count'] += 1
                _record_crawl_item(crawl_run, 'duplicate', item, error_message='Duplicate source URL')
            elif new_post is not None:
                result['created'] += 1
        except IntegrityError:
            if Post.objects.filter(
                models.Q(normalized_source_url=normalized_url) | models.Q(source_url=url)
            ).exists():
                result['duplicate_count'] += 1
                _record_crawl_item(crawl_run, 'duplicate', item, error_message='Duplicate source URL')
                continue
            raise
        except Exception as exc:
            result['error_count'] += 1
            logger.exception(f"[Crawler] 항목 처리 실패 ({source.name}): {exc}")
            _record_crawl_item(crawl_run, 'error', item, error_message=str(exc))

    return result
def _send_telegram_notifications(source, created: int):
    if created <= 0 or not source.category or source.category.name not in ['Guide', 'Advice']:
        return

    try:
        import threading

        import httpx

        from .models import AIConfig, Post

        config = AIConfig.get_config()
        if not config.telegram_bot_token or not config.telegram_chat_id:
            return

        recent_posts = Post.objects.filter(site=source.name, category=source.category).order_by('-created_at')[:created]
        posts_data = [
            {
                'category_name': source.category.name,
                'title': post.title,
                'url': post.source_url,
                'site': post.site,
            }
            for post in recent_posts
        ]

        async def send_telegram_messages(posts, bot_token, chat_id):
            async with httpx.AsyncClient() as client:
                for post in posts:
                    message = f"?怨뚮옖???눀?{post['category_name']} ???쒓낯??n\n"
                    message += f"[{post['title']}]({post['url']})\n\n"
                    message += f"??⑥レ툔?? {post['site']}\n"
                    try:
                        await client.post(
                            f"https://api.telegram.org/bot{bot_token}/sendMessage",
                            data={
                                'chat_id': chat_id,
                                'text': message,
                                'parse_mode': 'Markdown',
                                'disable_web_page_preview': True,
                            },
                            timeout=5.0,
                        )
                    except Exception as exc:
                        logger.error(f"[Crawler] Telegram ??ш끽維뽬땻?????됰꽡: {exc}")

        def run_telegram_async():
            asyncio.run(send_telegram_messages(posts_data, config.telegram_bot_token, config.telegram_chat_id))

        threading.Thread(target=run_telegram_async, daemon=True).start()
    except Exception as exc:
        logger.error(f"[Crawler] Telegram 癲ル슪?ｇ몭??????곸씔: {exc}")


def run_crawl(source, triggered_by: str = 'manual') -> dict:
    """
    ???獒???嚥▲굥猷??????덈틖???寃뗏????ㅺ컼???棺??짆??誘⒲걫???좊즲????筌뤾퍓???
    ?袁⑸즵??? {'created', 'found', 'status', 'error', 'attempt_count', 'duration_seconds'}
    """
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
            'error': '???? ????덈틖 濚욌꼬?댄꺍????鸚???????덊렡.',
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
                logger.exception(f"[Crawler] ????덈틖 ????됰꽡 ({source.name}) attempt={attempt}/{max_attempts}: {exc}")

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
            error_message = f"{last_error} (???Β?ろ떗 ????됰꽡 ??ш낄猷?嚥▲렞????ш끽維?됰‥???????濚밸Ŧ遊???"

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


class _SourceProxy:
    """DB ???⑤챶??dict ??れ삀??뫢????源놁젳??source ??좊즵??꼯???삳읁?嚥?諭?????노젵????ш낄援η뵳???ш끽維곩ㅇ??筌믨퀡?????덊렡."""

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
    """
    DB ???????⑤챶????ш끽維?????源놁젳???⑥????鸚룸슚異??濡ろ뜏???醫듽걫?雅?퍔瑗띰㎖?????껎꼤???
    ?袁⑸즵??? {'items': [...], 'status': str, 'error': str}
    """
    import html as html_lib
    import re

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
