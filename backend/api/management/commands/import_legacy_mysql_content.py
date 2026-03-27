import csv
from pathlib import Path

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError, transaction

from api.crawler import normalize_source_url
from api.legacy_import import (
    extract_legacy_summary,
    get_legacy_content_specs,
    map_legacy_status,
    coerce_legacy_datetime,
)
from api.models import Category, Comment, Post


class Command(BaseCommand):
    help = 'legacy MySQL의 news/guide/advice 콘텐츠를 현재 Post 모델로 이관합니다.'

    def add_arguments(self, parser):
        parser.add_argument('--host', default='127.0.0.1', help='MySQL 호스트')
        parser.add_argument('--port', type=int, default=3306, help='MySQL 포트')
        parser.add_argument('--user', required=True, help='MySQL 사용자')
        parser.add_argument('--password', required=True, help='MySQL 비밀번호')
        parser.add_argument('--database', required=True, help='MySQL 데이터베이스명')
        parser.add_argument(
            '--tables',
            default='myapp_news,myapp_guide,myapp_advice',
            help='이관할 legacy 테이블 목록(쉼표 구분)',
        )
        parser.add_argument(
            '--author-username',
            default='securnet_admin',
            help='이관 게시글과 댓글에 사용할 현재 시스템 사용자명',
        )
        parser.add_argument(
            '--include-comments',
            action='store_true',
            help='legacy 댓글 테이블도 함께 이관합니다.',
        )
        parser.add_argument(
            '--map-output',
            default='db/legacy_content_map.csv',
            help='legacy 콘텐츠 ID와 새 Post ID 매핑을 저장할 CSV 경로',
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
            raise CommandError('PyMySQL가 필요합니다. backend/requirements.txt 기준으로 설치해 주세요.') from exc

        table_names = [name.strip() for name in options['tables'].split(',') if name.strip()]
        specs = get_legacy_content_specs(table_names)
        if not specs:
            raise CommandError('이관 대상 테이블이 없습니다.')

        user = User.objects.filter(username=options['author_username']).first()
        if user is None:
            raise CommandError(f"사용자 '{options['author_username']}'를 찾을 수 없습니다.")

        category_map = {}
        for spec in specs:
            category, _ = Category.objects.get_or_create(
                name=spec.category_name,
                defaults={'description': f'Legacy import category: {spec.category_name}'},
            )
            category_map[spec.category_name] = category

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
            'created_posts': 0,
            'skipped_posts': 0,
            'created_comments': 0,
            'skipped_comments': 0,
        }
        content_map_rows = []
        content_id_map = {}
        dry_run = bool(options['dry_run'])

        try:
            with connection.cursor() as cursor:
                for spec in specs:
                    self.stdout.write(f'[{spec.table_name}] 콘텐츠 이관 시작')
                    content_id_map[spec.table_name] = self.import_posts(
                        cursor=cursor,
                        spec=spec,
                        category=category_map[spec.category_name],
                        author=user,
                        dry_run=dry_run,
                        stats=stats,
                        content_map_rows=content_map_rows,
                    )

                if options['include_comments']:
                    for spec in specs:
                        if not spec.comment_table:
                            continue
                        self.stdout.write(f'[{spec.comment_table}] 댓글 이관 시작')
                        self.import_comments(
                            cursor=cursor,
                            spec=spec,
                            content_id_map=content_id_map.get(spec.table_name, {}),
                            author=user,
                            dry_run=dry_run,
                            stats=stats,
                        )
        finally:
            connection.close()

        if not dry_run:
            self.write_mapping_file(options['map_output'], content_map_rows)

        self.stdout.write(self.style.SUCCESS(
            f"완료: posts(created={stats['created_posts']}, skipped={stats['skipped_posts']}), "
            f"comments(created={stats['created_comments']}, skipped={stats['skipped_comments']})"
        ))

    def import_posts(self, cursor, spec, category, author, dry_run, stats, content_map_rows):
        rows = self.fetch_post_rows(cursor, spec)
        id_map = {}

        for row in rows:
            normalized_url = normalize_source_url(row.get('link', ''))
            existing = None
            if normalized_url:
                existing = Post.objects.filter(normalized_source_url=normalized_url).only('id').first()
            if existing is None and row.get('link'):
                existing = Post.objects.filter(source_url=row['link']).only('id').first()

            if existing is not None:
                stats['skipped_posts'] += 1
                id_map[row['id']] = existing.id
                content_map_rows.append({
                    'legacy_table': spec.table_name,
                    'legacy_id': row['id'],
                    'new_post_id': existing.id,
                    'source_url': row.get('link', ''),
                    'status': 'skipped_existing',
                })
                continue

            summary = extract_legacy_summary(
                row.get('parsed_summary') if spec.supports_summary else None,
                row.get('original_summary') if spec.supports_summary else None,
            )
            status = map_legacy_status(row.get('issue_status'))
            published_at = coerce_legacy_datetime(row.get('date'))
            created_at = coerce_legacy_datetime(
                row.get('issue_processed_date') or row.get('check_date') or row.get('date')
            )
            update_fields = {}

            if dry_run:
                pseudo_id = -(len(id_map) + 1)
                stats['created_posts'] += 1
                id_map[row['id']] = pseudo_id
                content_map_rows.append({
                    'legacy_table': spec.table_name,
                    'legacy_id': row['id'],
                    'new_post_id': pseudo_id,
                    'source_url': row.get('link', ''),
                    'status': 'dry_run',
                })
                continue

            post = Post(
                title=(row.get('title') or '').strip() or '(제목 없음)',
                content=row.get('content') or '',
                summary=summary,
                site=(row.get('site') or '').strip() or None,
                source_url=row.get('link') or None,
                normalized_source_url=normalized_url or None,
                category=category,
                author=author,
                status=status,
                is_shared=bool(row.get('swit_share_check')) if spec.supports_share_flag else False,
                is_summarized=bool(summary),
                published_at=published_at,
            )
            post.sync_legacy_flags()

            try:
                with transaction.atomic():
                    post.save()
                    if created_at is not None:
                        update_fields['created_at'] = created_at
                        update_fields['updated_at'] = created_at
                    if update_fields:
                        Post.objects.filter(pk=post.pk).update(**update_fields)
            except IntegrityError:
                stats['skipped_posts'] += 1
                existing = Post.objects.filter(normalized_source_url=normalized_url).only('id').first()
                if existing is not None:
                    id_map[row['id']] = existing.id
                    content_map_rows.append({
                        'legacy_table': spec.table_name,
                        'legacy_id': row['id'],
                        'new_post_id': existing.id,
                        'source_url': row.get('link', ''),
                        'status': 'skipped_integrity_conflict',
                    })
                    continue
                raise

            stats['created_posts'] += 1
            id_map[row['id']] = post.id
            content_map_rows.append({
                'legacy_table': spec.table_name,
                'legacy_id': row['id'],
                'new_post_id': post.id,
                'source_url': row.get('link', ''),
                'status': 'created',
            })

        return id_map

    def import_comments(self, cursor, spec, content_id_map, author, dry_run, stats):
        if not content_id_map:
            return

        cursor.execute(
            f"""
            SELECT id, comment, write_date, content_id
            FROM {spec.comment_table}
            ORDER BY id
            """
        )
        rows = cursor.fetchall()
        for row in rows:
            post_id = content_id_map.get(row['content_id'])
            if not post_id:
                stats['skipped_comments'] += 1
                continue

            if dry_run:
                stats['created_comments'] += 1
                continue

            if Comment.objects.filter(
                post_id=post_id,
                content=row.get('comment') or '',
            ).exists():
                stats['skipped_comments'] += 1
                continue

            comment = Comment.objects.create(
                post_id=post_id,
                author=author,
                content=row.get('comment') or '',
            )
            created_at = coerce_legacy_datetime(row.get('write_date'))
            if created_at is not None:
                Comment.objects.filter(pk=comment.pk).update(created_at=created_at)
            stats['created_comments'] += 1

    def fetch_post_rows(self, cursor, spec):
        if spec.supports_summary:
            cursor.execute(
                f"""
                SELECT
                    id,
                    site,
                    title,
                    link,
                    content,
                    issue_status,
                    date,
                    check_date,
                    issue_processed_date,
                    parsed_summary,
                    original_summary,
                    swit_share_check
                FROM {spec.table_name}
                ORDER BY id
                """
            )
        else:
            cursor.execute(
                f"""
                SELECT
                    id,
                    site,
                    title,
                    link,
                    content,
                    issue_status,
                    date,
                    check_date,
                    issue_processed_date
                FROM {spec.table_name}
                ORDER BY id
                """
            )
        return cursor.fetchall()

    def write_mapping_file(self, map_output, rows):
        output_path = Path(map_output)
        if not output_path.is_absolute():
            output_path = Path.cwd() / output_path
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with output_path.open('w', newline='', encoding='utf-8') as handle:
            writer = csv.DictWriter(
                handle,
                fieldnames=['legacy_table', 'legacy_id', 'new_post_id', 'source_url', 'status'],
            )
            writer.writeheader()
            writer.writerows(rows)
