import time

from django.core.management.base import BaseCommand
from django.utils import timezone

from api.crawler import recover_stale_crawler_state, run_crawl
from api.models import CrawlerSource


class Command(BaseCommand):
    help = "활성 크롤러를 주기적으로 실행합니다."

    def add_arguments(self, parser):
        parser.add_argument(
            '--once',
            action='store_true',
            help='지금 시점에 실행 대상인 소스만 한 번 처리하고 종료합니다.',
        )
        parser.add_argument(
            '--poll-seconds',
            type=int,
            default=60,
            help='반복 모드에서 실행 주기를 확인할 간격(초)입니다. 기본값은 60초입니다.',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=0,
            help='한 번에 처리할 최대 소스 수입니다. 0이면 제한이 없습니다.',
        )

    def handle(self, *args, **options):
        once = options['once']
        poll_seconds = max(10, int(options['poll_seconds']))
        limit = max(0, int(options['limit']))

        self.stdout.write(self.style.SUCCESS('크롤러 스케줄러를 시작합니다.'))

        while True:
            processed = self.run_due_sources(limit=limit)
            if once:
                self.stdout.write(self.style.SUCCESS(f'스케줄러 단일 실행 완료: {processed}개 처리'))
                return

            if processed == 0:
                self.stdout.write(f"[{timezone.now():%Y-%m-%d %H:%M:%S}] 실행 대상 없음, {poll_seconds}초 대기")
            time.sleep(poll_seconds)

    def run_due_sources(self, limit: int = 0) -> int:
        now = timezone.now()
        recovered = recover_stale_crawler_state(now=now)
        if recovered:
            self.stdout.write(self.style.WARNING(f'고착된 크롤러 실행 상태 {recovered}개를 복구했습니다.'))

        queryset = CrawlerSource.objects.filter(is_active=True).order_by('last_crawled_at', 'created_at')
        processed = 0

        for source in queryset:
            if not source.is_due(now):
                continue

            result = run_crawl(source, triggered_by='scheduled')
            processed += 1
            self.stdout.write(
                f"[{now:%Y-%m-%d %H:%M:%S}] {source.name}: "
                f"status={result['status']} created={result.get('created', 0)} "
                f"found={result.get('found', 0)} attempts={result.get('attempt_count', 0)}"
            )

            if limit and processed >= limit:
                break

        return processed
