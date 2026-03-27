import csv
from collections import defaultdict
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from api.legacy_import import get_legacy_content_specs, map_legacy_status
from api.models import Post


class Command(BaseCommand):
    help = 'legacy MySQL의 issue_status를 현재 Post.status로 다시 동기화합니다.'

    def add_arguments(self, parser):
        parser.add_argument('--host', default='127.0.0.1', help='MySQL 호스트')
        parser.add_argument('--port', type=int, default=3306, help='MySQL 포트')
        parser.add_argument('--user', required=True, help='MySQL 사용자')
        parser.add_argument('--password', required=True, help='MySQL 비밀번호')
        parser.add_argument('--database', required=True, help='MySQL 데이터베이스명')
        parser.add_argument(
            '--tables',
            default='myapp_news,myapp_guide,myapp_advice',
            help='동기화할 legacy 테이블 목록(쉼표 구분)',
        )
        parser.add_argument(
            '--map-input',
            default='db/legacy_content_map.csv',
            help='legacy ID와 Post ID 매핑 CSV 경로',
        )
        parser.add_argument(
            '--apply',
            action='store_true',
            help='실제 Post.status를 업데이트합니다.',
        )

    def handle(self, *args, **options):
        try:
            import pymysql
            from pymysql.cursors import DictCursor
        except ImportError as exc:
            raise CommandError('PyMySQL가 필요합니다. 먼저 의존성을 설치해 주세요.') from exc

        table_names = [name.strip() for name in options['tables'].split(',') if name.strip()]
        specs = get_legacy_content_specs(table_names)
        if not specs:
            raise CommandError('동기화할 legacy 테이블이 없습니다.')

        map_path = Path(options['map_input'])
        if not map_path.is_absolute():
            map_path = Path.cwd() / map_path
        if not map_path.exists():
            raise CommandError(f'매핑 파일을 찾을 수 없습니다: {map_path}')

        content_map = self.load_content_map(map_path, {spec.table_name for spec in specs})
        if not content_map:
            raise CommandError('선택한 테이블에 대한 매핑 정보가 없습니다.')

        connection = pymysql.connect(
            host=options['host'],
            port=options['port'],
            user=options['user'],
            password=options['password'],
            database=options['database'],
            charset='utf8mb4',
            cursorclass=DictCursor,
        )

        changes = []
        raw_status_counts = defaultdict(int)
        target_status_counts = defaultdict(int)

        try:
            with connection.cursor() as cursor:
                for spec in specs:
                    table_map = content_map.get(spec.table_name, {})
                    if not table_map:
                        continue
                    legacy_rows = self.fetch_status_rows(cursor, spec.table_name)
                    for row in legacy_rows:
                        new_post_id = table_map.get(row['id'])
                        if not new_post_id:
                            continue

                        raw_status = (row.get('issue_status') or '').strip().lower()
                        target_status = map_legacy_status(raw_status)
                        raw_status_counts[raw_status or '(empty)'] += 1
                        target_status_counts[target_status] += 1

                        current_status = (
                            Post.objects
                            .filter(pk=new_post_id)
                            .values_list('status', flat=True)
                            .first()
                        )
                        if current_status is None or current_status == target_status:
                            continue

                        changes.append({
                            'post_id': new_post_id,
                            'legacy_table': spec.table_name,
                            'legacy_id': row['id'],
                            'from_status': current_status,
                            'to_status': target_status,
                            'raw_status': raw_status or '(empty)',
                        })
        finally:
            connection.close()

        for raw_status, count in sorted(raw_status_counts.items()):
            self.stdout.write(f'legacy issue_status={raw_status}: {count}')
        for status, count in sorted(target_status_counts.items()):
            self.stdout.write(f'목표 status={status}: {count}')

        if not changes:
            self.stdout.write(self.style.SUCCESS('상태 차이가 없어 업데이트할 항목이 없습니다.'))
            return

        for change in changes[:20]:
            self.stdout.write(
                f"post={change['post_id']} legacy={change['legacy_table']}#{change['legacy_id']} "
                f"{change['from_status']} -> {change['to_status']} (raw={change['raw_status']})"
            )
        if len(changes) > 20:
            self.stdout.write(f'... 생략 {len(changes) - 20}건')

        if not options['apply']:
            self.stdout.write(self.style.WARNING(f'dry-run: {len(changes)}건이 변경 대상입니다.'))
            return

        posts = list(Post.objects.filter(pk__in=[change['post_id'] for change in changes]))
        post_map = {post.pk: post for post in posts}
        for change in changes:
            post = post_map.get(change['post_id'])
            if not post:
                continue
            post.status = change['to_status']
            post.sync_legacy_flags()

        Post.objects.bulk_update(posts, ['status', 'is_draft'])
        self.stdout.write(self.style.SUCCESS(f'업데이트 완료: {len(posts)}건'))

    def load_content_map(self, map_path: Path, allowed_tables: set[str]) -> dict[str, dict[int, int]]:
        table_map: dict[str, dict[int, int]] = defaultdict(dict)
        with map_path.open('r', encoding='utf-8', newline='') as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                legacy_table = (row.get('legacy_table') or '').strip()
                if legacy_table not in allowed_tables:
                    continue
                try:
                    legacy_id = int(row['legacy_id'])
                    new_post_id = int(row['new_post_id'])
                except (TypeError, ValueError, KeyError):
                    continue
                table_map[legacy_table][legacy_id] = new_post_id
        return table_map

    def fetch_status_rows(self, cursor, table_name: str):
        cursor.execute(
            f'''
            SELECT id, issue_status
            FROM {table_name}
            ORDER BY id
            '''
        )
        return cursor.fetchall()
