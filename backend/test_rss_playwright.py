import asyncio
import feedparser
from playwright.async_api import async_playwright

async def t():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        res = await page.goto('https://www.securityweek.com/feed/')
        text = await res.text()
        print(f"Content length: {len(text)}")
        print(text[:100])
        feed = feedparser.parse(text)
        print(f"entries: {len(feed.entries)}")
        await browser.close()

if __name__ == '__main__':
    asyncio.run(t())
