import os
import django
import asyncio
from newspaper import Article, Config
from markdownify import markdownify as md

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.crawler import _fetch_with_playwright

async def t():
    url = 'https://www.securityweek.com/solarwinds-patches-four-critical-serv-u-vulnerabilities/'
    html_str = await _fetch_with_playwright(url)
    
    config = Config()
    config.browser_user_agent = 'Mozilla/5.0'
    config.keep_article_html = True  # 필수!
    
    article = Article(url, config=config)
    article.set_html(html_str)
    article.parse()
    
    if article.article_html:
        md_text = md(article.article_html, heading_style="ATX", tables=True)
        print("--- Table Markdown from Newspaper3k ---")
        print("\n".join(md_text.splitlines()[:50]))
    else:
        print("article_html is still empty!")
    
if __name__ == '__main__':
    asyncio.run(t())
