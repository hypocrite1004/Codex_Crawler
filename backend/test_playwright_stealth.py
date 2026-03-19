import asyncio
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

async def t():
    url = 'https://www.securityweek.com/the-blast-radius-problem-stolen-credentials-are-weaponizing-agentic-ai/'
    print(f"Fetching: {url}")
    
    async with async_playwright() as p:
        # User-Agent 및 각종 회피 옵션 추가
        # navigator.webdriver = false 우회를 위해 인자 추가
        browser = await p.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        )
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            viewport={'width': 1920, 'height': 1080},
            device_scale_factor=1,
            has_touch=False,
            is_mobile=False
        )
        
        # 추가 Stealth 스크립트 삽입 (navigator.webdriver 속성 삭제 등)
        await context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        page = await context.new_page()
        
        res = await page.goto(url, wait_until='domcontentloaded', timeout=30000)
        # Cloudflare 챌린지 통과를 위한 약간의 대기
        await page.wait_for_timeout(5000)
        html_str = await page.content()
        await browser.close()
    
    print(f"HTML Length: {len(html_str)}")
    
    soup = BeautifulSoup(html_str, 'lxml')
    content_el = soup.select_one('.zox-post-body')
    if content_el:
        print("Success! Content length:", len(content_el.text))
        print(content_el.text[:200])
    else:
        print("Failed to find `.zox-post-body`. Title:", soup.title.text if soup.title else "No Title")

if __name__ == '__main__':
    asyncio.run(t())
