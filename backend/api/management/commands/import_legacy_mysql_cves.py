import csv
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from api.cve_sync import refresh_cve_metrics
from api.legacy_import import coerce_legacy_datetime
from api.models import CveRecord, PostCveMention


def merge_mentioned_in(current_value: str, next_value: str) -> str:
    current = (current_value or 'content').strip().lower()
    incoming = (next_value or 'content').strip().lower()
    allowed = {'title', 'content', 'both'}

    if current not in allowed:
        current = 'content'
    if incoming not in allowed:
        incoming = 'content'
    if current == incoming:
        return current
    if 'both' in {current, incoming}:
        return 'both'
    return 'both'


class Command(BaseCommand):
    help = 'legacy MySQL의 CVE 데이터를 현재 PostgreSQL 스키마로 이관합니다.'

    def add_arguments(self, parser):
        parser.add_argument('--host', default='127.0.0.1', help='MySQL 호스트')
        parser.add_argument('--port', type=int, default=3306, help='MySQL 포트')
        parser.add_argument('--user', required=True, help='MySQL 사용자')
        parser.add_argument('--password', required=True, help='MySQL 비밀번호')
        parser.add_argument('--database', required=True, help='MySQL 데이터베이스명')
        parser.add_argument(
            '--map-input',
            default='db/legacy_content_map.csv',
            help='legacy 콘텐츠와 Post ID 매핑 CSV 경로',
        )
        parser.add_argument(
            '--legacy-table',
            default='myapp_news',
            help='CVE를 연결할 legacy 콘텐츠 테이블명',
        )
        parser.add_argument(
            '--content-type',
            default='news',
            help='legacy myapp_contentcve.content_type 값',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='실제 저장 없이 예상 결과만 출력합니다.',
        )

    def handle(self, *args, **options):
        try:
            import pymysql
            from pymysql.cursors import DictCursor
        except ImportError as exc:
            raise CommandError('PyMySQL가 필요합니다. 먼저 의존성을 설치해 주세요.') from exc

        map_path = Path(options['map_input'])
        if not map_path.is_absolute():
            map_path = Path.cwd() / map_path
        if not map_path.exists():
            raise CommandError(f'매핑 파일을 찾을 수 없습니다: {map_path}')

        content_map = self.load_content_map(map_path, options['legacy_table'])
        if not content_map:
            raise CommandError('선택한 legacy 테이블에 대한 매핑 정보가 없습니다.')

        connection = pymysql.connect(
            host=options['host'],
            port=options['port'],
            user=options['user'],
            password=options['password'],
            database=options['database'],
            charset='utf8mb4',
            cursorclass=DictCursor,
        )

        stats = {
            'cves_created': 0,
            'cves_updated': 0,
            'mentions_created': 0,
            'mentions_updated': 0,
            'skipped_missing_post': 0,
        }
        dry_run = bool(options['dry_run'])

        try:
            with connection.cursor() as cursor:
                cve_map = self.import_cves(cursor, dry_run=dry_run, stats=stats)
                self.import_mentions(
                    cursor,
                    cve_map=cve_map,
                    content_map=content_map,
                    content_type=options['content_type'],
                    dry_run=dry_run,
                    stats=stats,
                )
        finally:
            connection.close()

        summary = (
            f"완료: cves(created={stats['cves_created']}, updated={stats['cves_updated']}), "
            f"mentions(created={stats['mentions_created']}, updated={stats['mentions_updated']}), "
            f"missing_post={stats['skipped_missing_post']}"
        )
        self.stdout.write(self.style.SUCCESS(summary))

    def load_content_map(self, map_path: Path, legacy_table: str) -> dict[int, int]:
        result: dict[int, int] = {}
        with map_path.open('r', encoding='utf-8', newline='') as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                if (row.get('legacy_table') or '').strip() != legacy_table:
                    continue
                try:
                    result[int(row['legacy_id'])] = int(row['new_post_id'])
                except (KeyError, TypeError, ValueError):
                    continue
        return result

    def import_cves(self, cursor, dry_run: bool, stats: dict) -> dict[int, str]:
        cursor.execute(
            '''
            SELECT
                id,
                cve_id,
                first_seen,
                last_seen,
                mention_count,
                description,
                severity,
                cvss_score,
                published_date,
                vendor,
                product,
                is_tracked,
                notes
            FROM myapp_cvemention
            ORDER BY id
            '''
        )

        legacy_to_cve_id: dict[int, str] = {}
        for row in cursor.fetchall():
            legacy_to_cve_id[row['id']] = row['cve_id']
            defaults = {
                'description': row.get('description') or '',
                'severity': row.get('severity') or '',
                'cvss_score': row.get('cvss_score'),
                'published_date': row.get('published_date'),
                'vendor': row.get('vendor') or '',
                'product': row.get('product') or '',
                'is_tracked': bool(row.get('is_tracked')),
                'notes': row.get('notes') or '',
                'mention_count': 0,
                'legacy_mention_count': int(row.get('mention_count') or 0),
                'first_seen': coerce_legacy_datetime(row.get('first_seen')),
                'last_seen': coerce_legacy_datetime(row.get('last_seen')),
            }

            if dry_run:
                exists = CveRecord.objects.filter(cve_id=row['cve_id']).exists()
                stats['cves_updated' if exists else 'cves_created'] += 1
                continue

            _, created = CveRecord.objects.update_or_create(
                cve_id=row['cve_id'],
                defaults=defaults,
            )
            stats['cves_created' if created else 'cves_updated'] += 1

        return legacy_to_cve_id

    def import_mentions(self, cursor, cve_map: dict[int, str], content_map: dict[int, int], content_type: str, dry_run: bool, stats: dict):
        cursor.execute(
            '''
            SELECT id, object_id, mentioned_in, cve_id
            FROM myapp_contentcve
            WHERE content_type = %s
            ORDER BY id
            ''',
            [content_type],
        )

        affected_cve_ids: set[str] = set()
        for row in cursor.fetchall():
            post_id = content_map.get(int(row['object_id']))
            if not post_id:
                stats['skipped_missing_post'] += 1
                continue

            cve_id = cve_map.get(int(row['cve_id']))
            if not cve_id:
                continue
            affected_cve_ids.add(cve_id)

            if dry_run:
                existing = (
                    PostCveMention.objects
                    .select_related('cve')
                    .filter(post_id=post_id, cve__cve_id=cve_id)
                    .first()
                )
                if existing is None:
                    stats['mentions_created'] += 1
                elif merge_mentioned_in(existing.mentioned_in, row.get('mentioned_in')) != existing.mentioned_in:
                    stats['mentions_updated'] += 1
                continue

            cve = CveRecord.objects.only('id', 'cve_id').get(cve_id=cve_id)
            mention, created = PostCveMention.objects.get_or_create(
                post_id=post_id,
                cve=cve,
                defaults={
                    'source': 'legacy_import',
                    'mentioned_in': row.get('mentioned_in') or 'content',
                    'legacy_reference_ids': [int(row['id'])],
                },
            )
            if created:
                stats['mentions_created'] += 1
                continue

            merged_value = merge_mentioned_in(mention.mentioned_in, row.get('mentioned_in'))
            legacy_reference_ids = list(mention.legacy_reference_ids or [])
            if int(row['id']) not in legacy_reference_ids:
                legacy_reference_ids.append(int(row['id']))

            if merged_value != mention.mentioned_in or legacy_reference_ids != list(mention.legacy_reference_ids or []):
                mention.mentioned_in = merged_value
                mention.legacy_reference_ids = legacy_reference_ids
                mention.save(update_fields=['mentioned_in', 'legacy_reference_ids'])
                stats['mentions_updated'] += 1

        if not dry_run and affected_cve_ids:
            refresh_cve_metrics(affected_cve_ids)
