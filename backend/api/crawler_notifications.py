import asyncio
import logging

logger = logging.getLogger(__name__)


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
        posts_data = [{'category_name': source.category.name, 'title': post.title, 'url': post.source_url, 'site': post.site} for post in recent_posts]

        async def send_telegram_messages(posts, bot_token, chat_id):
            async with httpx.AsyncClient() as client:
                for post in posts:
                    message = f"[{post['category_name']}] 새 게시글\n\n[{post['title']}]({post['url']})\n\n출처: {post['site']}\n"
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
                        logger.error(f"[Crawler] Telegram notification failed: {exc}")

        def run_telegram_async():
            asyncio.run(send_telegram_messages(posts_data, config.telegram_bot_token, config.telegram_chat_id))

        threading.Thread(target=run_telegram_async, daemon=True).start()
    except Exception as exc:
        logger.error(f"[Crawler] Telegram dispatch failed: {exc}")
