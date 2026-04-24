from rest_framework import serializers
from django.contrib.auth.models import User
from django.utils.html import strip_tags
from .crawler_diagnostics import categorize_item, categorize_run, diagnostic_detail
from .crawler_security import CrawlerSecurityError, validate_crawler_request_config
from .models import (
    Post,
    Category,
    Comment,
    AIConfig,
    CrawlerSource,
    CrawlerLog,
    CrawlRun,
    CrawlItem,
    CveRecord,
    PostCveMention,
)

class PublicUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username']


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'is_staff', 'is_superuser']
        read_only_fields = ['id', 'is_staff', 'is_superuser']

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, min_length=4)
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class CommentSerializer(serializers.ModelSerializer):
    author = PublicUserSerializer(read_only=True)
    
    class Meta:
        model = Comment
        fields = '__all__'
        read_only_fields = ['post', 'author']


class PostCveMentionSerializer(serializers.ModelSerializer):
    cve_id = serializers.CharField(source='cve.cve_id', read_only=True)
    severity = serializers.CharField(source='cve.severity', read_only=True)
    cvss_score = serializers.FloatField(source='cve.cvss_score', read_only=True)
    mention_count = serializers.IntegerField(source='cve.mention_count', read_only=True)
    vendor = serializers.CharField(source='cve.vendor', read_only=True)
    product = serializers.CharField(source='cve.product', read_only=True)

    class Meta:
        model = PostCveMention
        fields = [
            'id',
            'cve',
            'cve_id',
            'severity',
            'cvss_score',
            'mention_count',
            'vendor',
            'product',
            'source',
            'mentioned_in',
            'legacy_reference_ids',
            'created_at',
        ]
        read_only_fields = fields


class CveRecordSerializer(serializers.ModelSerializer):
    post_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = CveRecord
        fields = [
            'id',
            'cve_id',
            'description',
            'severity',
            'cvss_score',
            'published_date',
            'vendor',
            'product',
            'mention_count',
            'first_seen',
            'last_seen',
            'post_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class AdminCveRecordSerializer(serializers.ModelSerializer):
    post_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = CveRecord
        fields = [
            'id',
            'cve_id',
            'description',
            'severity',
            'cvss_score',
            'published_date',
            'vendor',
            'product',
            'is_tracked',
            'notes',
            'mention_count',
            'legacy_mention_count',
            'first_seen',
            'last_seen',
            'post_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class PostSerializer(serializers.ModelSerializer):
    author = PublicUserSerializer(read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    cve_mentions = PostCveMentionSerializer(many=True, read_only=True)
    related_count = serializers.IntegerField(read_only=True, default=0)
    related_posts_list = serializers.SerializerMethodField()
    approved_by_name = serializers.CharField(source='approved_by.username', read_only=True)
    rejected_by_name = serializers.CharField(source='rejected_by.username', read_only=True)
    
    class Meta:
        model = Post
        fields = '__all__'
        read_only_fields = [
            'author',
            'status',
            'approval_requested_at',
            'approved_by',
            'approved_at',
            'rejected_by',
            'rejected_at',
            'rejection_reason',
            'archived_at',
            'approved_by_name',
            'rejected_by_name',
        ]

    def get_related_posts_list(self, obj):
        children = obj.related_posts.all().order_by('-created_at')
        return [
            {
                'id': child.id,
                'title': child.title,
                'site': child.site,
                'source_url': child.source_url,
                'created_at': child.created_at.isoformat() if child.created_at else None,
            } for child in children
        ]


class PostListSerializer(serializers.ModelSerializer):
    author = PublicUserSerializer(read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    related_count = serializers.IntegerField(read_only=True, default=0)
    cve_count = serializers.IntegerField(read_only=True, default=0)
    content_preview = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id',
            'title',
            'site',
            'source_url',
            'category',
            'category_name',
            'author',
            'is_shared',
            'is_summarized',
            'status',
            'created_at',
            'related_count',
            'cve_count',
            'content_preview',
        ]
        read_only_fields = fields

    def get_content_preview(self, obj):
        preview = strip_tags(obj.content or '').strip()
        preview = ' '.join(preview.split())
        if len(preview) > 160:
            return f'{preview[:160].rstrip()}...'
        return preview


class AdminPostListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.username', read_only=True)
    rejected_by_name = serializers.CharField(source='rejected_by.username', read_only=True)
    related_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Post
        fields = [
            'id',
            'title',
            'site',
            'source_url',
            'category',
            'category_name',
            'status',
            'is_summarized',
            'created_at',
            'related_count',
            'approval_requested_at',
            'approved_by_name',
            'approved_at',
            'rejected_by_name',
            'rejected_at',
            'rejection_reason',
            'archived_at',
        ]
        read_only_fields = fields


class AIConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIConfig
        fields = [
            'id',
            'model',
            'system_prompt',
            'max_tokens',
            'temperature',
            'similarity_threshold',
            'telegram_bot_token',
            'telegram_chat_id',
            'updated_at',
        ]
        read_only_fields = ['id', 'updated_at']


class CrawlerLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrawlerLog
        fields = [
            'id',
            'status',
            'articles_found',
            'articles_created',
            'error_message',
            'triggered_by',
            'attempt_count',
            'duration_seconds',
            'crawled_at',
        ]
        read_only_fields = fields


class CrawlItemSerializer(serializers.ModelSerializer):
    post_id = serializers.IntegerField(source='post.id', read_only=True)
    diagnostic_category = serializers.SerializerMethodField()
    diagnostic_label = serializers.SerializerMethodField()
    diagnostic_hint = serializers.SerializerMethodField()

    class Meta:
        model = CrawlItem
        fields = [
            'id',
            'item_status',
            'source_url',
            'normalized_url',
            'title',
            'error_message',
            'payload',
            'post_id',
            'created_at',
            'diagnostic_category',
            'diagnostic_label',
            'diagnostic_hint',
        ]
        read_only_fields = fields

    def _diagnostic(self, obj):
        return diagnostic_detail(categorize_item(obj))

    def get_diagnostic_category(self, obj):
        return self._diagnostic(obj)['diagnostic_category']

    def get_diagnostic_label(self, obj):
        return self._diagnostic(obj)['diagnostic_label']

    def get_diagnostic_hint(self, obj):
        return self._diagnostic(obj)['diagnostic_hint']


class CrawlRunSerializer(serializers.ModelSerializer):
    source_name = serializers.CharField(source='source.name', read_only=True)
    item_count = serializers.SerializerMethodField()
    diagnostic_category = serializers.SerializerMethodField()
    diagnostic_label = serializers.SerializerMethodField()
    diagnostic_hint = serializers.SerializerMethodField()

    class Meta:
        model = CrawlRun
        fields = [
            'id',
            'source',
            'source_name',
            'triggered_by',
            'status',
            'started_at',
            'finished_at',
            'attempt_count',
            'articles_found',
            'articles_created',
            'duplicate_count',
            'filtered_count',
            'error_count',
            'duration_seconds',
            'error_message',
            'item_count',
            'diagnostic_category',
            'diagnostic_label',
            'diagnostic_hint',
        ]
        read_only_fields = fields

    def get_item_count(self, obj):
        annotated_count = getattr(obj, 'item_count', None)
        if annotated_count is not None:
            return annotated_count
        return obj.items.count()

    def _diagnostic(self, obj):
        return diagnostic_detail(categorize_run(obj))

    def get_diagnostic_category(self, obj):
        return self._diagnostic(obj)['diagnostic_category']

    def get_diagnostic_label(self, obj):
        return self._diagnostic(obj)['diagnostic_label']

    def get_diagnostic_hint(self, obj):
        return self._diagnostic(obj)['diagnostic_hint']


class CrawlerSourceSerializer(serializers.ModelSerializer):
    logs = CrawlerLogSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    next_crawl_at = serializers.SerializerMethodField()
    health_status = serializers.SerializerMethodField()

    class Meta:
        model = CrawlerSource
        fields = [
            'id', 'name', 'url', 'source_type', 'is_active', 'category', 'category_name',
            'crawl_interval', 'last_crawled_at', 'last_success_at', 'last_run_started_at',
            'is_running', 'last_status', 'last_error_message', 'consecutive_failures',
            'max_retries', 'retry_backoff_minutes', 'auto_disable_after_failures',
            'next_crawl_at', 'health_status',
            'http_method', 'request_headers', 'request_body',
            'article_list_selector', 'article_link_selector',
            'title_selector', 'content_selector', 'date_selector',
            'fetch_full_content', 'full_content_selector', 'exclude_selectors',
            'created_at', 'logs',
        ]
        read_only_fields = [
            'id',
            'last_crawled_at',
            'last_success_at',
            'last_run_started_at',
            'is_running',
            'last_status',
            'last_error_message',
            'consecutive_failures',
            'next_crawl_at',
            'health_status',
            'created_at',
            'logs',
        ]

    def get_next_crawl_at(self, obj):
        next_crawl_at = obj.next_crawl_at()
        return next_crawl_at.isoformat() if next_crawl_at else None

    def get_health_status(self, obj):
        return obj.health_status()

    def validate(self, attrs):
        candidate = {}
        for key in ['url', 'request_headers']:
            if key in attrs:
                candidate[key] = attrs[key]
            elif self.instance is not None:
                candidate[key] = getattr(self.instance, key)

        try:
            validate_crawler_request_config(candidate)
        except CrawlerSecurityError as exc:
            raise serializers.ValidationError(exc.detail) from exc

        return attrs
