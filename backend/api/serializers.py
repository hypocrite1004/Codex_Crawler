from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Post, Category, Comment, AIConfig, CrawlerSource, CrawlerLog

class PublicUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username']


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'is_staff']
        read_only_fields = ['id', 'is_staff']

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

class PostSerializer(serializers.ModelSerializer):
    author = PublicUserSerializer(read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    related_count = serializers.IntegerField(read_only=True, default=0)
    related_posts_list = serializers.SerializerMethodField()
    
    class Meta:
        model = Post
        fields = '__all__'

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
