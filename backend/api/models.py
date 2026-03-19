from datetime import timedelta

from django.contrib.auth.models import User
from django.contrib.postgres.indexes import GinIndex
from django.db import models
from django.utils import timezone
from pgvector.django import VectorField

class Category(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name

class Post(models.Model):
    title = models.CharField(max_length=255)
    content = models.TextField()
    summary = models.TextField(blank=True, null=True)
    site = models.CharField(max_length=100, blank=True, null=True)
    source_url = models.URLField(max_length=500, blank=True, null=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='posts')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    is_shared = models.BooleanField(default=False)
    is_summarized = models.BooleanField(default=False)
    is_draft = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True, help_text="실제 기사 발행일")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    views = models.PositiveIntegerField(default=0)
    embedding = VectorField(dimensions=1536, null=True, blank=True)
    iocs = models.JSONField(default=list, blank=True, help_text="추출된 외부 링크/IP/도메인 목록")
    parent_post = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='related_posts', help_text="동일한 이슈로 판단된 대표 기사")

    class Meta:
        indexes = [
            GinIndex(fields=['title'], opclasses=['gin_trgm_ops'], name='api_post_title_gin'),
            GinIndex(fields=['content'], opclasses=['gin_trgm_ops'], name='api_post_content_gin'),
        ]

    def __str__(self):
        return self.title

class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comments')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Comment by {self.author.username} on {self.post.title}'



class CrawlerSource(models.Model):
    SOURCE_TYPES = [('rss', 'RSS/Atom'), ('html', 'HTML Scraping')]
    HTTP_METHODS = [('GET', 'GET'), ('POST', 'POST')]
    LAST_STATUS_CHOICES = [
        ('idle', 'Idle'),
        ('success', 'Success'),
        ('playwright_fallback', 'Playwright Fallback'),
        ('error', 'Error'),
    ]

    name = models.CharField(max_length=200)
    url = models.URLField(max_length=500)
    source_type = models.CharField(max_length=10, choices=SOURCE_TYPES, default='rss')
    is_active = models.BooleanField(default=True)
    category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.SET_NULL, related_name='crawler_sources')
    crawl_interval = models.PositiveIntegerField(default=60, help_text='분 단위 크롤 주기')
    last_crawled_at = models.DateTimeField(null=True, blank=True)
    last_success_at = models.DateTimeField(null=True, blank=True)
    last_run_started_at = models.DateTimeField(null=True, blank=True)
    is_running = models.BooleanField(default=False)
    last_status = models.CharField(max_length=30, choices=LAST_STATUS_CHOICES, default='idle')
    last_error_message = models.TextField(blank=True, default='')
    consecutive_failures = models.PositiveIntegerField(default=0)
    max_retries = models.PositiveSmallIntegerField(default=2)
    retry_backoff_minutes = models.PositiveIntegerField(default=10)
    auto_disable_after_failures = models.PositiveIntegerField(default=5)

    # HTTP 요청 설정 (HTML 타입)
    http_method = models.CharField(max_length=10, choices=HTTP_METHODS, default='GET')
    request_headers = models.JSONField(default=dict, blank=True, help_text='{"User-Agent": "..."}')
    request_body = models.JSONField(default=dict, blank=True, help_text='POST body JSON')

    # 파싱 설정 (HTML 타입)
    article_list_selector = models.CharField(max_length=300, blank=True, help_text='기사 목록 CSS 선택자')
    article_link_selector = models.CharField(max_length=300, blank=True, help_text='링크 CSS 선택자')
    title_selector = models.CharField(max_length=300, blank=True, help_text='제목 CSS 선택자')
    content_selector = models.CharField(max_length=300, blank=True, help_text='본문 CSS 선택자')
    date_selector = models.CharField(max_length=300, blank=True, help_text='날짜 CSS 선택자 (선택)')

    # 전문 수집 (RSS/HTML 공통)
    fetch_full_content = models.BooleanField(default=False, help_text='각 기사 URL에 접속하여 전문 수집')
    full_content_selector = models.CharField(max_length=300, blank=True, help_text='전문 수집 시 본문 CSS 선택자')
    exclude_selectors = models.TextField(
        blank=True,
        help_text='제거할 CSS 선택자 목록 (쉼표 구분, 예: .ad, #sidebar, .related-articles)'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'[{self.get_source_type_display()}] {self.name}'

    def next_crawl_at(self):
        if not self.is_active:
            return None

        reference_time = self.last_crawled_at or self.created_at
        if not reference_time:
            return timezone.now()

        return reference_time + timedelta(minutes=self.crawl_interval)

    def is_due(self, now=None):
        if not self.is_active or self.is_running:
            return False

        now = now or timezone.now()
        next_run_at = self.next_crawl_at()
        return next_run_at is None or next_run_at <= now

    def health_status(self):
        if self.is_running:
            return 'running'
        if not self.is_active:
            if self.consecutive_failures and self.auto_disable_after_failures and self.consecutive_failures >= self.auto_disable_after_failures:
                return 'disabled'
            return 'paused'
        if self.last_status == 'error':
            return 'error'
        if self.last_status == 'playwright_fallback':
            return 'warning'
        if self.last_status == 'success':
            return 'healthy'
        if self.last_crawled_at:
            return 'idle'
        return 'pending'


class CrawlerLog(models.Model):
    STATUS_CHOICES = [
        ('success', 'Success'),
        ('playwright_fallback', 'Playwright Fallback'),
        ('error', 'Error'),
    ]
    TRIGGER_CHOICES = [
        ('manual', 'Manual'),
        ('scheduled', 'Scheduled'),
    ]
    source = models.ForeignKey(CrawlerSource, on_delete=models.CASCADE, related_name='logs')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES)
    articles_found = models.PositiveIntegerField(default=0)
    articles_created = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True)
    triggered_by = models.CharField(max_length=20, choices=TRIGGER_CHOICES, default='manual')
    attempt_count = models.PositiveSmallIntegerField(default=1)
    duration_seconds = models.PositiveIntegerField(default=0)
    crawled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-crawled_at']

    def __str__(self):
        return f'{self.source.name} @ {self.crawled_at:%Y-%m-%d %H:%M} [{self.status}]'


class AIConfig(models.Model):
    model = models.CharField(max_length=100, default='gpt-4o-mini')
    system_prompt = models.TextField(default=(
        '당신은 사이버 보안 전문 분석가입니다. '
        '사용자가 제공하는 보안 관련 뉴스/아티클을 분석하여, '
        '반드시 아래 JSON 스키마에 맞는 유효한 JSON만 출력하세요. '
        '마크다운 코드블록(```), 추가 설명, 서문 없이 JSON 객체 그 자체만 반환해야 합니다.\n\n'
        '⚠️ 중요: 아래 스키마의 큰따옴표 안 값들은 모두 형식 예시입니다. '
        '실제 출력 시에는 아티클 내용을 분석하여 의미 있는 텍스트로 반드시 대체해야 합니다. '
        '"하위소제목", "소제목", "요점", "세부내용" 등의 예시 텍스트를 그대로 사용하지 마세요.\n\n'
        '스키마:\n'
        '{\n'
        '  "title": "<아티클 내용을 가장 잘 나타내는 한국어 제목>",\n'
        '  "brief": "<핵심을 1-2줄로 요약한 문장>",\n'
        '  "summary": "<최소 200자 최대 500자 / 1~3개 문단 분량 전체 요약>",\n'
        '  "hashtag": ["<#영어키워드1>", "<#영어키워드2>"],\n'
        '  "sections": [\n'
        '    {\n'
        '      "caption": "<해당 섹션 주제를 나타내는 실제 소제목>",\n'
        '      "content": [\n'
        '        "<실제 요점 1>",\n'
        '        "<실제 요점 2>",\n'
        '        {\n'
        '          "caption": "<필요시에만 사용할 실제 하위 소제목>",\n'
        '          "content": ["<실제 세부 내용 1>", "<실제 세부 내용 2>"]\n'
        '        }\n'
        '      ]\n'
        '    }\n'
        '  ]\n'
        '}\n\n'
        '요구사항:\n'
        '1. sections는 위협 개요 / 영향받는 시스템 / 공격 방법 / 권고 조치 등 실제 내용에 맞게 구성하세요.\n'
        '2. 중첩 섹션(content 내 객체)은 상위 섹션을 세분화할 필요가 있을 때만 사용하세요.\n'
        '3. 내용이 부족한 섹션은 생략하세요.\n'
        '4. hashtag는 CVE 번호, 위협 유형, 제품명 등 5개 이상 영어로 나열하세요.\n'
        '5. 답변은 한국어로 합니다(hashtag 제외).\n'
        '6. 모든 문장의 어미는 반드시 \'~니다\' 형식의 한국어 격식체(합쇼체)로 통일합니다. '
        '예: ~됩니다, ~있습니다, ~합니다, ~나타납니다. ~함., ~됨. 등의 비격식체는 절대 사용하지 마세요.'
    ))
    max_tokens = models.PositiveIntegerField(default=1500)
    temperature = models.FloatField(default=0.3)
    similarity_threshold = models.FloatField(default=0.20, help_text="이슈 그룹화 코사인 거리 임계값 (작을수록 엄격함)")
    
    # 텔레그램 연동
    telegram_bot_token = models.CharField(max_length=255, blank=True, help_text="텔레그램 봇 토큰 (가이드/권고문 알림용)")
    telegram_chat_id = models.CharField(max_length=100, blank=True, help_text="알림을 받을 채팅방 ID")

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'AI Configuration'

    @classmethod
    def get_config(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f'AI Config ({self.model})'
