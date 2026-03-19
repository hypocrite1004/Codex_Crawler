import os
import django
import asyncio
from bs4 import BeautifulSoup

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.crawler import _fetch_with_playwright

async def t():
    url = 'https://www.securityweek.com/the-blast-radius-problem-stolen-credentials-are-weaponizing-agentic-ai/'
    print(f"Fetching: {url}")
    html_str = await _fetch_with_playwright(url)
    print(f"HTML Length: {len(html_str)}")
    
    soup = BeautifulSoup(html_str, 'lxml')
    content_el = soup.select_one('.zox-post-body')
    if content_el:
        print("Success! Content length:", len(content_el.text))
        print(content_el.text[:200])
    else:
        print("Failed to find `.zox-post-body`. Full HTML snippet:")
        print(html_str[:1500])

if __name__ == '__main__':
    asyncio.run(t())
