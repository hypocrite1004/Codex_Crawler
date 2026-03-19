import os
import django
import asyncio
from bs4 import BeautifulSoup
from newspaper import Article, Config

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.crawler import _fetch_with_playwright, _clean_soup

async def t():
    url = 'https://www.securityweek.com/solarwinds-patches-four-critical-serv-u-vulnerabilities/'
    html_str = await _fetch_with_playwright(url)
    
    soup = BeautifulSoup(html_str, 'lxml')
    soup = _clean_soup(soup, "") # Clean soup as in our new code
    cleaned_html = str(soup)
    
    config = Config()
    config.browser_user_agent = 'Mozilla/5.0'
    config.keep_article_html = True  
    
    article = Article(url, config=config)
    article.set_html(cleaned_html)
    article.parse()
    
    print("article_html:::", article.article_html)
        
if __name__ == '__main__':
    asyncio.run(t())
