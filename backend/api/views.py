from rest_framework import viewsets, permissions, generics, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.models import User
from django.utils.html import strip_tags
from .models import Post, Category, Comment, AIConfig, CrawlerSource, CrawlerLog
from .serializers import PostSerializer, CategorySerializer, PublicUserSerializer, ProfileSerializer, RegisterSerializer, CommentSerializer, AIConfigSerializer, CrawlerSourceSerializer, CrawlerLogSerializer
import os
import re
import json
import html as html_lib
from urllib.parse import urlparse
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


def html_to_plain(html_content: str) -> str:
    """Convert HTML article content to clean plain text for LLM input."""
    # 1. Unescape HTML entities (&nbsp; &lt; etc.)
    text = html_lib.unescape(html_content)
    # 3. Strip all HTML tags
    text = strip_tags(text)
    # 4. Collapse multiple whitespace / blank lines
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def sanitize_rich_text(html_content: str) -> str:
    """Allow a limited HTML subset for editor content and strip executable payloads."""
    if not html_content:
        return ""

    from bs4 import BeautifulSoup, Comment as BsComment

    allowed_tags = {
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
        'a', 'h1', 'h2', 'h3',
    }
    removable_tags = {'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta'}
    allowed_attrs = {'a': {'href', 'target', 'rel'}}

    soup = BeautifulSoup(html_content, 'html.parser')

    for comment in soup.find_all(string=lambda text: isinstance(text, BsComment)):
        comment.extract()

    for tag_name in removable_tags:
        for tag in soup.find_all(tag_name):
            tag.decompose()

    for tag in soup.find_all(True):
        if tag.name not in allowed_tags:
            tag.unwrap()
            continue

        cleaned_attrs: dict[str, str] = {}
        for attr, value in tag.attrs.items():
            if attr not in allowed_attrs.get(tag.name, set()):
                continue

            value_str = ' '.join(value) if isinstance(value, list) else str(value)
            value_str = value_str.strip()

            if tag.name == 'a' and attr == 'href':
                parsed = urlparse(value_str)
                if value_str.startswith('#') or parsed.scheme in {'http', 'https', 'mailto'}:
                    cleaned_attrs['href'] = value_str
            elif tag.name == 'a' and attr == 'target' and value_str == '_blank':
                cleaned_attrs['target'] = '_blank'

        if tag.name == 'a' and 'href' in cleaned_attrs:
            cleaned_attrs['rel'] = 'noopener noreferrer'

        tag.attrs = cleaned_attrs

    return str(soup).strip()

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all()
    serializer_class = PublicUserSerializer
    permission_classes = [permissions.IsAuthenticated]

class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]

class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_update(self, serializer):
        from rest_framework.exceptions import PermissionDenied
        from rest_framework.exceptions import ValidationError
        if serializer.instance.author.id != self.request.user.id and not self.request.user.is_staff:
            raise PermissionDenied("You do not have permission to edit this comment.")
        sanitized_content = sanitize_rich_text(serializer.validated_data.get('content', serializer.instance.content))
        if not strip_tags(sanitized_content).strip():
            raise ValidationError({"content": "This field may not be blank."})
        serializer.save(content=sanitized_content)

    def perform_destroy(self, instance):
        from rest_framework.exceptions import PermissionDenied
        if instance.author.id != self.request.user.id and not self.request.user.is_staff:
            raise PermissionDenied("You do not have permission to delete this comment.")
        instance.delete()

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_update(self, serializer):
        from rest_framework.exceptions import PermissionDenied
        # 관리자만 포스트 수정 가능
        if not self.request.user.is_staff:
            raise PermissionDenied("You do not have permission to edit this post.")
        serializer.save()

    def perform_destroy(self, instance):
        from rest_framework.exceptions import PermissionDenied
        # 관리자만 포스트 삭제 가능
        if not self.request.user.is_staff:
            raise PermissionDenied("You do not have permission to delete this post.")
        instance.delete()

    def get_queryset(self):
        from django.db.models import Count, Q
        qs = Post.objects.all().order_by('-created_at')
        params = self.request.query_params
        
        # 메인 목록(list) 조회 시 기본적으로 부모가 없는 대표 기사들만 노출
        # (단, 관리자가 is_admin_list=true 파라미터로 요청한 경우 자식 노드까지 전부 반환)
        if getattr(self, 'action', None) == 'list':
            is_admin_list = params.get('is_admin_list') == 'true' and self.request.user.is_authenticated and getattr(self.request.user, 'is_staff', False)
            if not is_admin_list:
                qs = qs.filter(parent_post__isnull=True)
            qs = qs.annotate(related_count=Count('related_posts'))
        else:
            qs = qs.annotate(related_count=Count('related_posts'))

        # 고급 검색 필터 적용
        params = self.request.query_params
        search_query = params.get('search')
        if search_query:
            qs = qs.filter(Q(title__icontains=search_query) | Q(content__icontains=search_query))
        
        site = params.get('site')
        if site:
            qs = qs.filter(site__iexact=site)
            
        start_date = params.get('start_date')
        if start_date:
            qs = qs.filter(created_at__gte=start_date + 'T00:00:00Z')
            
        end_date = params.get('end_date')
        if end_date:
            qs = qs.filter(created_at__lte=end_date + 'T23:59:59Z')
            
        is_summarized = params.get('is_summarized')
        if is_summarized and is_summarized.lower() == 'true':
            qs = qs.filter(is_summarized=True)
            
        is_shared = params.get('is_shared')
        if is_shared and is_shared.lower() == 'true':
            qs = qs.filter(is_shared=True)

        # 권한별 노출 설정 (임시저장)
        if self.request.user.is_authenticated:
            return qs.filter(Q(is_draft=False) | Q(author=self.request.user))
        return qs.filter(is_draft=False)
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def add_comment(self, request, pk=None):
        post = self.get_object()
        content = request.data.get('content')
        if not content:
            return Response({'error': 'Content is required'}, status=status.HTTP_400_BAD_REQUEST)

        sanitized_content = sanitize_rich_text(content)
        if not strip_tags(sanitized_content).strip():
            return Response({'error': 'Content is required'}, status=status.HTTP_400_BAD_REQUEST)

        comment = Comment.objects.create(post=post, author=request.user, content=sanitized_content)
        serializer = CommentSerializer(comment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'put', 'delete'], permission_classes=[permissions.AllowAny])
    def summarize(self, request, pk=None):
        post = self.get_object()
        
        if request.method == 'GET':
            # Already summarized?
            if post.summary:
                return Response({'summary': post.summary}, status=status.HTTP_200_OK)

            config = AIConfig.get_config()
            api_key = os.environ.get('OPENAI_API_KEY', '')

            if not api_key or api_key.startswith('sk-dummy'):
                # Fallback mock when no real key
                sentences = re.split(r'(?<=[.!?]) +', post.content)
                mock_summary = ' '.join(sentences[:2]) if sentences else post.content
                summary_text = f'🤖 [Mock] AI Summary: {mock_summary}...'
            else:
                try:
                    client = OpenAI(api_key=api_key)
                    # Convert HTML to plain text to reduce token usage
                    plain_content = html_to_plain(post.content)
                    response = client.chat.completions.create(
                        model=config.model,
                        messages=[
                            {'role': 'system', 'content': config.system_prompt},
                            {'role': 'user', 'content': f'Article:\n{plain_content}'},
                        ],
                        max_tokens=config.max_tokens,
                        temperature=config.temperature,
                    )
                    raw = response.choices[0].message.content or ''
                    # Strip markdown code fences if present
                    clean = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw.strip(), flags=re.MULTILINE)
                    # Validate JSON; store raw string if parsing fails
                    try:
                        parsed = json.loads(clean)
                        summary_text = json.dumps(parsed, ensure_ascii=False)
                    except json.JSONDecodeError:
                        summary_text = clean
                except Exception as e:
                    return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

            post.summary = summary_text
            post.is_summarized = True
            post.save(update_fields=['summary', 'is_summarized'])
            return Response({'summary': summary_text}, status=status.HTTP_200_OK)
        
        # Authentication required for PUT/DELETE
        if not request.user.is_authenticated or request.user.id != post.author.id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have permission to modify the summary.")

        if request.method == 'PUT':
            summary_content = request.data.get('summary')
            if summary_content is None:
                return Response({'error': 'summary required'}, status=status.HTTP_400_BAD_REQUEST)
            if summary_content.lstrip().startswith('{'):
                try:
                    parsed = json.loads(summary_content)
                    post.summary = json.dumps(parsed, ensure_ascii=False)
                except json.JSONDecodeError:
                    post.summary = sanitize_rich_text(summary_content)
            else:
                post.summary = sanitize_rich_text(summary_content)
            post.is_summarized = True
            post.save(update_fields=['summary', 'is_summarized'])
            return Response({'summary': post.summary}, status=status.HTTP_200_OK)
            
        if request.method == 'DELETE':
            post.summary = ""
            post.is_summarized = False
            post.save(update_fields=['summary', 'is_summarized'])
            return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def toggle_share(self, request, pk=None):
        post = self.get_object()
        post.is_shared = not post.is_shared
        post.save(update_fields=['is_shared'])
        return Response({'is_shared': post.is_shared}, status=status.HTTP_200_OK)


class AIConfigView(APIView):
    """
    GET  /api/ai-config/  -> return current AI config (authenticated)
    PUT  /api/ai-config/  -> update AI config (staff only)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        config = AIConfig.get_config()
        serializer = AIConfigSerializer(config)
        return Response(serializer.data)

    def put(self, request):
        if not request.user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only staff users can update AI configuration.')
        config = AIConfig.get_config()
        serializer = AIConfigSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TestClusteringView(APIView):
    """
    POST /api/ai-config/test_clustering/ 
    -> Simulate clustering of recent 50 posts using provided threshold
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        try:
            threshold = float(request.data.get('threshold', 0.2))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid threshold value'}, status=status.HTTP_400_BAD_REQUEST)

        import numpy as np
        
        # 최근 임베딩이 존재하는 50개 포스트 ('News' 카테고리 한정, 생성 시간 역순으로 가져옴)
        posts_qs = Post.objects.filter(
            embedding__isnull=False, 
            category__name__iexact='news'
        ).order_by('-created_at')[:50]
        posts = list(posts_qs)
        # 시간순 시뮬레이션을 위해 역순(과거->최신)으로 정렬
        posts.reverse()

        if not posts:
            return Response({'clusters': [], 'unclustered_count': 0, 'total_tested': 0})

        def cosine_dist(v1, v2):
            if np.linalg.norm(v1) == 0 or np.linalg.norm(v2) == 0:
                return 1.0
            return 1 - (np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2)))

        virtual_parents = {p.id: None for p in posts}
        
        for i, p in enumerate(posts):
            p_vec = np.array(p.embedding)
            best_dist = 1.0
            best_parent_id = None
            
            # 과거(자신보다 i가 작은) 포스트들과 비교
            for j in range(i):
                prev_p = posts[j]
                # 이미 누군가의 자식이 된 포스트는 대장이 아님
                if virtual_parents[prev_p.id] is None:
                    prev_vec = np.array(prev_p.embedding)
                    dist = cosine_dist(p_vec, prev_vec)
                    
                    if dist < best_dist and dist < threshold:
                        best_dist = dist
                        best_parent_id = prev_p.id
            
            if best_parent_id is not None:
                virtual_parents[p.id] = best_parent_id

        # 그룹화 결과 조립
        clusters = {}
        for p in posts:
            parent_id = virtual_parents[p.id]
            if parent_id is None:
                clusters[p.id] = {'parent': p.title, 'children': []}
            else:
                clusters[parent_id]['children'].append(p.title)

        # 자식이 1개 이상 있는 (실제 이슈 그룹) 클러스터만 추출
        result = [c for c in clusters.values() if len(c['children']) > 0]
        unclustered_count = sum(1 for c in clusters.values() if len(c['children']) == 0)

        return Response({
            'clusters': result,
            'unclustered_count': unclustered_count,
            'total_tested': len(posts)
        })


class AIModelsView(APIView):
    """
    GET /api/ai-models/ -> return list of available OpenAI models
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        api_key = os.environ.get('OPENAI_API_KEY', '')
        if not api_key or api_key.startswith('sk-dummy'):
            # Return curated fallback list when no real key
            fallback = [
                {'id': 'gpt-5', 'category': 'GPT-5'},
                {'id': 'gpt-5-mini', 'category': 'GPT-5'},
                {'id': 'gpt-5-nano', 'category': 'GPT-5'},
                {'id': 'gpt-4.1', 'category': 'GPT-4.1'},
                {'id': 'gpt-4o', 'category': 'GPT-4o'},
                {'id': 'gpt-4o-mini', 'category': 'GPT-4o'},
                {'id': 'o4-mini', 'category': 'o-series'},
                {'id': 'o4-mini-high', 'category': 'o-series'},
                {'id': 'gpt-3.5-turbo', 'category': 'Legacy'},
            ]
            return Response({'models': fallback, 'source': 'fallback'})

        try:
            client = OpenAI(api_key=api_key)
            all_models = client.models.list()

            # Filter to chat-capable models only and sort
            CHAT_PREFIXES = ('gpt-', 'o1', 'o3', 'o4', 'chatgpt-')
            chat_models = sorted(
                [m for m in all_models.data if m.id.startswith(CHAT_PREFIXES)],
                key=lambda m: m.id,
                reverse=True,
            )

            def categorize(model_id):
                if model_id.startswith('gpt-5'):    return 'GPT-5'
                if model_id.startswith('gpt-4.1'):  return 'GPT-4.1'
                if model_id.startswith('gpt-4o'):   return 'GPT-4o'
                if model_id.startswith('gpt-4'):    return 'GPT-4'
                if model_id.startswith('o4'):       return 'o-series'
                if model_id.startswith('o3'):       return 'o-series'
                if model_id.startswith('o1'):       return 'o-series'
                if model_id.startswith('gpt-3'):    return 'Legacy'
                return 'Other'

            result = [
                {'id': m.id, 'category': categorize(m.id)}
                for m in chat_models
            ]
            return Response({'models': result, 'source': 'openai'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)


# ─── Crawler Views ────────────────────────────────────────────────────────────

class CrawlerSourceViewSet(viewsets.ModelViewSet):
    """크롤러 소스 CRUD + 즉시 크롤 실행 + 로그 조회"""
    queryset = CrawlerSource.objects.all().order_by('-created_at')
    serializer_class = CrawlerSourceSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_permissions(self):
        """목록은 누구나 조회, 쓰기 작업 및 크롤 실행은 staff만 허용"""
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        if self.action in ['logs']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    @action(detail=True, methods=['post'])
    def crawl(self, request, pk=None):
        """즉시 크롤링 실행"""
        source = self.get_object()
        if not source.is_active:
            return Response({'error': '비활성화된 소스입니다.'}, status=status.HTTP_400_BAD_REQUEST)
        from .crawler import run_crawl
        result = run_crawl(source, triggered_by='manual')
        if result['status'] == 'running':
            return Response(result, status=status.HTTP_409_CONFLICT)
        if result['status'] == 'error':
            return Response(result, status=status.HTTP_502_BAD_GATEWAY)
        return Response(result)

    @action(detail=True, methods=['get'])
    def logs(self, request, pk=None):
        """크롤 로그 최근 20건 조회"""
        source = self.get_object()
        logs = source.logs.all()[:20]
        return Response(CrawlerLogSerializer(logs, many=True).data)

    @action(detail=False, methods=['post'])
    def preview(self, request):
        """저장 없이 현재 설정으로 크롤 결과를 미리봅니다."""
        from .crawler import preview_crawl
        data = request.data
        if not data.get('url'):
            return Response({'error': 'URL이 필요합니다.'}, status=status.HTTP_400_BAD_REQUEST)
        result = preview_crawl(data, limit=10)
        if result['status'] == 'error':
            return Response(result, status=status.HTTP_502_BAD_GATEWAY)
        return Response(result)


# ─── Dashboard ────────────────────────────────────────────────────────────────

class DashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.utils import timezone
        from django.db.models import Count
        from django.db.models.functions import TruncDate
        from datetime import timedelta
        from collections import Counter
        import re as re_module

        period = request.query_params.get('period', 'week')
        now = timezone.now()
        days = 7 if period == 'week' else 30
        since = now - timedelta(days=days)
        prev_since = since - timedelta(days=days)

        posts_qs = Post.objects.all()
        period_posts = posts_qs.filter(created_at__gte=since)
        prev_period_posts = posts_qs.filter(created_at__gte=prev_since, created_at__lt=since)

        # ── 요약 통계 ──────────────────────────────────────────────────────────
        active_sources = CrawlerSource.objects.filter(is_active=True).count()
        last_log = CrawlerLog.objects.order_by('-crawled_at').first()
        summary = {
            'total_posts': posts_qs.count(),
            'period_posts': period_posts.count(),
            'prev_period_posts': prev_period_posts.count(),
            'active_sources': active_sources,
            'total_sources': CrawlerSource.objects.count(),
            'last_crawled_at': last_log.crawled_at.isoformat() if last_log else None,
        }

        # ── 일별 수집량 트렌드 (최근 days일) ────────────────────────────────────
        daily_qs = (
            posts_qs.filter(created_at__gte=now - timedelta(days=days))
            .annotate(date=TruncDate('created_at'))
            .values('date', 'category__name')
            .annotate(count=Count('id'))
            .order_by('date')
        )

        # 날짜별로 카테고리 수집량 집계
        daily_map: dict = {}
        for row in daily_qs:
            d = str(row['date'])
            cat = row['category__name'] or '미분류'
            cnt = row['count']
            if d not in daily_map:
                daily_map[d] = {'date': d, 'total': 0}
            daily_map[d][cat] = daily_map[d].get(cat, 0) + cnt
            daily_map[d]['total'] += cnt

        # days 범위 전체 날짜 채우기 (데이터 없는 날 = 0)
        daily_trend = []
        for i in range(days):
            d = str((now - timedelta(days=days - 1 - i)).date())
            daily_trend.append(daily_map.get(d, {'date': d, 'total': 0}))

        # ── 카테고리별 분포 (이번 기간 vs 이전 기간) ─────────────────────────────
        cat_this = (
            period_posts.values('category__name')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        cat_prev = (
            prev_period_posts.values('category__name')
            .annotate(count=Count('id'))
        )
        prev_map = {r['category__name']: r['count'] for r in cat_prev}
        category_dist = [
            {
                'name': r['category__name'] or '미분류',
                'current': r['count'],
                'prev': prev_map.get(r['category__name'], 0),
            }
            for r in cat_this
        ]

        # ── 급상승 키워드 ─────────────────────────────────────────────────────
        STOP_WORDS = {
            '이', '그', '저', '것', '수', '등', '및', '또', '더', '의', '를', '이',
            '가', '은', '는', '에', '서', '로', '와', '과', '도', '만', '에서',
            '하는', '하고', '있는', '있다', '했다', '한다', '이다', '되는', '된다',
            'the', 'a', 'an', 'in', 'of', 'to', 'for', 'is', 'on', 'at', 'by',
            '보안', '기사', '뉴스', '관련', '발표', '공개', '업데이트', '통해',
        }
        MIN_WORD_LEN = 2

        def extract_keywords(titles):
            words = []
            for t in titles:
                tokens = re_module.findall(r'[가-힣a-zA-Z]{2,}', t)
                words.extend([w for w in tokens if w not in STOP_WORDS and len(w) >= MIN_WORD_LEN])
            return Counter(words)

        this_titles = list(period_posts.values_list('title', flat=True))
        prev_titles = list(prev_period_posts.values_list('title', flat=True))
        this_kw = extract_keywords(this_titles)
        prev_kw = extract_keywords(prev_titles)

        trending = []
        for word, cnt in this_kw.most_common(50):
            prev_cnt = prev_kw.get(word, 0)
            if cnt < 2:
                continue
            if prev_cnt == 0:
                change_pct = 100
            else:
                change_pct = round((cnt - prev_cnt) / prev_cnt * 100)
            trending.append({'word': word, 'count': cnt, 'prev_count': prev_cnt, 'change_pct': change_pct})

        trending.sort(key=lambda x: x['change_pct'], reverse=True)
        trending_keywords = trending[:20]

        # ── 최신 기사 ─────────────────────────────────────────────────────────
        recent_posts = list(
            period_posts.filter(parent_post__isnull=True)
            .select_related('category')
            .annotate(related_count=Count('related_posts'))
            .order_by('-created_at')[:20]
            .values('id', 'title', 'site', 'source_url', 'created_at', 'category__name', 'related_count')
        )
        for p in recent_posts:
            p['created_at'] = p['created_at'].isoformat()
            p['category'] = p.pop('category__name') or '미분류'

        # ── 시맨틱 트렌드 버블 차트 (PCA 2D 매핑) ──────────────────────────────
        bubble_data = []
        try:
            from sklearn.decomposition import PCA
            import numpy as np
            
            # 이슈 병합이 완료된 대표 기사(parent_post 없는)만 시각화 포인트로 사용
            cluster_posts = list(
                period_posts.filter(parent_post__isnull=True, embedding__isnull=False)
                .annotate(related_count=Count('related_posts'))
                .values('id', 'title', 'embedding', 'related_count', 'category__name')
            )
            
            # 최소 3~4개의 데이터가 모여야 PCA 2차원 축소가 의미 있음
            if len(cluster_posts) >= 2:
                embeddings = np.array([p['embedding'] for p in cluster_posts])
                
                # 데이터 개수보다 작은 차원으로만 축소 가능
                n_components = min(2, len(cluster_posts))
                if n_components >= 1:
                    pca = PCA(n_components=n_components)
                    coords = pca.fit_transform(embeddings)

                    for idx, p in enumerate(cluster_posts):
                        x_coord = round(float(coords[idx][0]), 3) if coords.shape[1] > 0 else 0
                        y_coord = round(float(coords[idx][1]), 3) if coords.shape[1] > 1 else 0
                        
                        bubble_data.append({
                            'id': p['id'],
                            'title': p['title'],
                            'x': x_coord,
                            'y': y_coord,
                            'z': p['related_count'] * 15 + 20, # r 반경: 자식 기사가 많을수록 크게 렌더링
                            'related_count': p['related_count'],
                            'category': p['category__name'] or '미분류'
                        })
        except Exception as e:
            print(f"[Dashboard API] PCA Error: {e}")

        return Response({
            'summary': summary,
            'daily_trend': daily_trend,
            'category_dist': category_dist,
            'trending_keywords': trending_keywords,
            'recent_posts': recent_posts,
            'bubble_data': bubble_data,
        })
