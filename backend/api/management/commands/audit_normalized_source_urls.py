from django.core.management.base import BaseCommand
from django.db.models import Count

from api.models import Post


class Command(BaseCommand):
    help = 'normalized_source_url 기준 중복 게시글 후보를 점검합니다.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=20,
            help='출력할 중복 키 최대 개수입니다.',
        )
        parser.add_argument(
            '--sample-size',
            type=int,
            default=5,
            help='각 중복 키마다 출력할 샘플 게시글 수입니다.',
        )

    def handle(self, *args, **options):
        limit = max(1, int(options['limit']))
        sample_size = max(1, int(options['sample_size']))

        duplicates = list(
            Post.objects.exclude(normalized_source_url__isnull=True)
            .exclude(normalized_source_url='')
            .values('normalized_source_url')
            .annotate(post_count=Count('id'))
            .filter(post_count__gt=1)
            .order_by('-post_count', 'normalized_source_url')[:limit]
        )

        if not duplicates:
            self.stdout.write(self.style.SUCCESS('중복 normalized_source_url이 없습니다.'))
            return

        self.stdout.write(self.style.WARNING(f'중복 normalized_source_url {len(duplicates)}건 발견'))

        for entry in duplicates:
            normalized_url = entry['normalized_source_url']
            samples = list(
                Post.objects.filter(normalized_source_url=normalized_url)
                .order_by('id')
                .values_list('id', 'source_url')[:sample_size]
            )
            sample_text = ', '.join(f'#{post_id} {source_url}' for post_id, source_url in samples)
            self.stdout.write(f'- {normalized_url} ({entry["post_count"]}건) {sample_text}')
