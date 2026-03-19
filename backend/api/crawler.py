"""
크롤링 엔진
- RSS/Atom 파싱
- HTML 스크래핑
- Playwright 우회
- 실행 상태 추적, 재시도, 로그 기록
"""
import asyncio
import logging
import time
from urllib.parse import urljoin, urlparse

from django.contrib.auth.models import User
from django.utils import timezone

logger = logging.getLogger(__name__)


def crawl_rss(source) -> tuple[list[dict], str]:
    """RSS/Atom 피드를 파싱해 기사 목록을 반환합니다."""
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
        logger.warning(f"[Crawler] RSS 차단 응답 감지, Playwright로 재시도: {source.url}")
        try:
            xml_text = asyncio.run(_fetch_with_playwright(source.url, as_xml=True))
            feed = feedparser.parse(xml_text)
            status = 'playwright_fallback'
        except Exception as playwright_error:
            raise ValueError(f"Playwright RSS 우회 실패 ({exc}): {playwright_error}") from playwright_error
    except Exception as exc:
        feed = feedparser.parse(source.url)
        if not getattr(feed, 'entries', []):
            raise ValueError(f"RSS 로드 실패: {exc}") from exc

    if not getattr(feed, 'entries', []):
        raise ValueError("RSS 피드에서 항목을 찾지 못했습니다.")

    items = []
    for entry in feed.entries:
        items.append({
            'title': entry.get('title', '(제목 없음)').strip(),
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
    """광고/주변 요소를 제거한 정제된 soup를 반환합니다."""
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
    """HTML 조각을 Markdown 기반 텍스트로 변환합니다."""
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
    """각 기사 URL에 접속해 본문을 보강합니다."""
    import concurrent.futures

    import httpx
    from bs4 import BeautifulSoup

    try:
        from newspaper import Article, Config
    except ImportError:
        Article = None
        Config = None
        logger.warning("newspaper3k가 설치되어 있지 않아 일부 추출 기능을 건너뜁니다.")

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
            logger.warning(f"[Crawler] 상세 페이지 차단 응답 감지, Playwright로 재시도: {url}")
            try:
                html_text = asyncio.run(_fetch_with_playwright(url))
                html_raw = html_text.encode('utf-8', errors='ignore')
            except Exception as playwright_error:
                logger.warning(f"[Crawler] Playwright 우회 실패 ({url}): {playwright_error}")
                return item
        except Exception as exc:
            logger.warning(f"[Crawler] 상세 페이지 요청 실패 ({url}): {exc}")
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
            logger.warning(f"[Crawler] 본문 파싱 실패 ({url}): {exc}")

        return item

    enriched_items: list[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(process_single_item, item.copy()) for item in items]
        for future in concurrent.futures.as_completed(futures):
            enriched_items.append(future.result())

    return enriched_items


def _parse_html(html_data, source, base_url: str) -> list[dict]:
    """HTML 페이지를 source 설정에 맞춰 파싱합니다."""
    import concurrent.futures

    from bs4 import BeautifulSoup

    try:
        from newspaper import Article, Config
    except ImportError:
        Article = None
        Config = None
        logger.warning("newspaper3k가 설치되어 있지 않아 일부 추출 기능을 건너뜁니다.")

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
                    logger.warning(f"[Crawler] Playwright fallback 실패 ({full_url}): {playwright_error}")
            except Exception as exc:
                logger.warning(f"[Crawler] 기사 HTML 요청 실패 ({full_url}): {exc}")

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
                    logger.warning(f"[Crawler] newspaper 파싱 실패 ({full_url}): {exc}")

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
    """httpx로 HTML을 가져옵니다. 403은 PermissionError로 전달합니다."""
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
    """Playwright로 페이지를 가져옵니다."""
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
    """HTML 스크래핑을 수행합니다."""
    base_url = f"{urlparse(source.url).scheme}://{urlparse(source.url).netloc}"
    status = 'success'

    try:
        html_data, _ = asyncio.run(_fetch_with_httpx(source))
    except PermissionError:
        logger.warning(f"[Crawler] HTML 차단 응답 감지, Playwright로 재시도: {source.url}")
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


def _persist_crawled_items(source, items: list[dict], system_user, get_embedding) -> int:
    from datetime import timedelta

    from pgvector.django import CosineDistance

    from .models import AIConfig, Post

    created = 0
    is_news_category = bool(source.category and source.category.name.lower() == 'news')
    similarity_threshold = AIConfig.get_config().similarity_threshold if is_news_category else None

    for item in items:
        url = item.get('url', '').strip()
        if not url or Post.objects.filter(source_url=url).exists():
            continue

        title = item.get('title') or '(제목 없음)'
        content = item.get('content', '')
        vector = get_embedding(f"{title}\n{content}")

        new_post = Post.objects.create(
            title=title,
            content=content,
            source_url=url,
            site=source.name,
            category=source.category,
            author=system_user,
            is_draft=False,
            published_at=item.get('published_at'),
            iocs=_extract_iocs(content),
            embedding=vector if vector else None,
        )
        created += 1

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

    return created


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
                    message = f"보안 {post['category_name']} 수집\n\n"
                    message += f"[{post['title']}]({post['url']})\n\n"
                    message += f"출처: {post['site']}\n"
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
                        logger.error(f"[Crawler] Telegram 전송 실패: {exc}")

        def run_telegram_async():
            asyncio.run(send_telegram_messages(posts_data, config.telegram_bot_token, config.telegram_chat_id))

        threading.Thread(target=run_telegram_async, daemon=True).start()
    except Exception as exc:
        logger.error(f"[Crawler] Telegram 처리 오류: {exc}")


def run_crawl(source, triggered_by: str = 'manual') -> dict:
    """
    소스 하나를 실행하고 상태/로그를 갱신합니다.
    반환: {'created', 'found', 'status', 'error', 'attempt_count', 'duration_seconds'}
    """
    from .embeddings import get_embedding
    from .models import CrawlerLog

    locked = source.__class__.objects.filter(pk=source.pk, is_running=False).update(
        is_running=True,
        last_run_started_at=timezone.now(),
    )
    if not locked:
        return {
            'created': 0,
            'found': 0,
            'status': 'running',
            'error': '이미 실행 중인 크롤러입니다.',
            'attempt_count': 0,
            'duration_seconds': 0,
        }

    source.refresh_from_db()
    started_at = time.monotonic()
    max_attempts = 1 + max(0, int(source.max_retries or 0))
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
                created = _persist_crawled_items(source, items, system_user, get_embedding)

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
                }
            except Exception as exc:
                last_error = str(exc)
                last_status = 'error'
                logger.exception(f"[Crawler] 실행 실패 ({source.name}) attempt={attempt}/{max_attempts}: {exc}")

                if attempt < max_attempts:
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
            error_message = f"{last_error} (연속 실패 임계치 도달로 비활성화됨)"

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

        return {
            'created': created,
            'found': found,
            'status': 'error',
            'error': error_message,
            'attempt_count': attempt_count,
            'duration_seconds': duration_seconds,
        }
    finally:
        source.__class__.objects.filter(pk=source.pk, is_running=True).update(is_running=False)


class _SourceProxy:
    """DB 없이 dict 기반 설정을 source 객체처럼 다루기 위한 프록시입니다."""

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
    DB 저장 없이 현재 설정으로 크롤링 결과를 미리 봅니다.
    반환: {'items': [...], 'status': str, 'error': str}
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
