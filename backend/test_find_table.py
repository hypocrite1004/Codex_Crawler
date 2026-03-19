import os
import django
import asyncio
from bs4 import BeautifulSoup

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.crawler import _fetch_with_playwright

async def t():
    url = 'https://www.securityweek.com/solarwinds-patches-four-critical-serv-u-vulnerabilities/'
    print(f"Fetching: {url}")
    html_str = await _fetch_with_playwright(url)
    
    # "CVE"가 포함된 부분 찾기
    idx = html_str.find("CVE ID")
    if idx != -1:
        print("Found 'CVE ID'! Surrounding HTML:")
        print(html_str[max(0, idx-300) : min(len(html_str), idx+800)])
    else:
        print("Not found 'CVE ID' anywhere in HTML.")
    
if __name__ == '__main__':
    asyncio.run(t())
