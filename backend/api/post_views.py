import json

from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from django.utils.html import strip_tags
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .cve_sync import sync_post_cve_mentions
from .models import Comment, Post, PostCveMention
from .post_helpers import apply_post_status as _apply_post_status
from .post_helpers import normalize_summary_payload
from .serializers import AdminPostListSerializer, CommentSerializer, PostListSerializer, PostSerializer
from . import views as legacy_views
from .views import (
    IsStaffUser,
    is_admin_user,
    is_staff_user,
    sanitize_rich_text,
)


class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def _list_response(self, request, queryset, *, default_page_size: int, max_page_size: int):
        raw_limit = request.query_params.get('limit')
        raw_page = request.query_params.get('page')
        raw_page_size = request.query_params.get('page_size')

        paginator = PageNumberPagination()

        if raw_limit is not None:
            try:
                requested_size = int(raw_limit)
            except ValueError:
                requested_size = default_page_size
            requested_size = min(max(requested_size, 1), max_page_size)
        elif raw_page_size is not None:
            try:
                requested_size = int(raw_page_size)
            except ValueError:
                requested_size = default_page_size
            requested_size = min(max(requested_size, 1), max_page_size)
        elif raw_page is not None:
            requested_size = default_page_size
        else:
            requested_size = min(max(queryset.count(), 1), max_page_size)

        paginator.page_size = requested_size
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = self.get_serializer(page, many=True)
        site_options = list(
            queryset.exclude(site__isnull=True)
            .exclude(site='')
            .order_by()
            .values_list('site', flat=True)
            .distinct()
        )
        return Response({
            'count': paginator.page.paginator.count,
            'next': paginator.get_next_link(),
            'previous': paginator.get_previous_link(),
            'page': paginator.page.number,
            'page_size': paginator.page.paginator.per_page,
            'site_options': site_options,
            'results': serializer.data,
        })

    def get_serializer_class(self):
        if getattr(self, 'action', None) == 'list':
            is_admin_list = (
                self.request.query_params.get('is_admin_list') == 'true'
                and self.request.user.is_authenticated
                and is_staff_user(self.request.user)
            )
            return AdminPostListSerializer if is_admin_list else PostListSerializer
        return PostSerializer

    def get_queryset(self):
        params = self.request.query_params
        is_admin_list = (
            getattr(self, 'action', None) == 'list'
            and params.get('is_admin_list') == 'true'
            and self.request.user.is_authenticated
            and is_staff_user(self.request.user)
        )

        if is_admin_list:
            base_queryset = Post.objects.all().select_related('category', 'approved_by', 'rejected_by')
        else:
            base_queryset = Post.objects.all().select_related('author', 'category')
        if is_admin_list:
            qs = (
                base_queryset
                .only(
                    'id',
                    'title',
                    'site',
                    'source_url',
                    'category_id',
                    'category__name',
                    'status',
                    'is_summarized',
                    'created_at',
                    'approval_requested_at',
                    'approved_at',
                    'approved_by__username',
                    'rejected_at',
                    'rejected_by__username',
                    'rejection_reason',
                    'archived_at',
                )
                .order_by('-created_at')
            )
        else:
            qs = (
                base_queryset
                .only(
                    'id',
                    'title',
                    'content',
                    'site',
                    'source_url',
                    'category_id',
                    'author__username',
                    'is_shared',
                    'is_summarized',
                    'status',
                    'created_at',
                )
                .order_by('-created_at')
            )

        if getattr(self, 'action', None) == 'list':
            if not is_admin_list:
                qs = qs.filter(parent_post__isnull=True)
                qs = qs.annotate(
                    related_count=Count('related_posts', distinct=True),
                    cve_count=Count('cve_mentions', distinct=True),
                )
            else:
                qs = qs.annotate(related_count=Count('related_posts', distinct=True))
        else:
            qs = (
                qs
                .prefetch_related(
                    'comments__author',
                    Prefetch(
                        'cve_mentions',
                        queryset=PostCveMention.objects.select_related('cve').all(),
                    ),
                    'related_posts',
                )
                .annotate(related_count=Count('related_posts'))
            )

        search_query = params.get('search')
        if search_query:
            qs = qs.filter(Q(title__icontains=search_query) | Q(content__icontains=search_query))

        site = params.get('site')
        if site:
            qs = qs.filter(site__iexact=site)

        category = params.get('category')
        if category:
            qs = qs.filter(category_id=category)

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

        post_status = params.get('status')
        if post_status:
            qs = qs.filter(status=post_status)

        cve_id = params.get('cve')
        if cve_id:
            qs = qs.filter(cve_mentions__cve__cve_id__iexact=cve_id)

        mine_only = params.get('mine') == 'true'
        if mine_only and self.request.user.is_authenticated:
            qs = qs.filter(author=self.request.user)

        if self.request.user.is_authenticated:
            if is_staff_user(self.request.user):
                return qs.distinct()
            return qs.filter(Q(status='published') | Q(author=self.request.user)).distinct()
        return qs.filter(status='published').distinct()

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        is_admin_list = (
            request.query_params.get('is_admin_list') == 'true'
            and request.user.is_authenticated
            and is_staff_user(request.user)
        )
        if not is_admin_list:
            return self._list_response(request, queryset, default_page_size=24, max_page_size=200)

        return self._list_response(request, queryset, default_page_size=50, max_page_size=200)

    def perform_update(self, serializer):
        from rest_framework.exceptions import PermissionDenied
        from rest_framework.exceptions import ValidationError

        post = serializer.instance
        is_owner = post.author_id == self.request.user.id

        if not is_staff_user(self.request.user):
            if not is_owner:
                raise PermissionDenied("You do not have permission to edit this post.")
            if post.status not in ['draft', 'rejected']:
                raise PermissionDenied("Only draft or rejected posts can be edited.")

        content = serializer.validated_data.get('content', post.content)
        sanitized_content = sanitize_rich_text(content)
        if not strip_tags(sanitized_content).strip():
            raise ValidationError({"content": "This field may not be blank."})

        save_kwargs = {'content': sanitized_content}
        requested_is_draft = serializer.validated_data.get('is_draft')
        if requested_is_draft is not None and not is_staff_user(self.request.user) and is_owner:
            _apply_post_status(post, 'draft' if requested_is_draft else 'review', actor=self.request.user)
            save_kwargs.update({
                'status': post.status,
                'approval_requested_at': post.approval_requested_at,
                'approved_by': post.approved_by,
                'approved_at': post.approved_at,
                'rejected_by': post.rejected_by,
                'rejected_at': post.rejected_at,
                'rejection_reason': post.rejection_reason,
                'archived_at': post.archived_at,
                'is_draft': post.is_draft,
            })

        updated_post = serializer.save(**save_kwargs)
        sync_post_cve_mentions(updated_post)

    def perform_destroy(self, instance):
        from rest_framework.exceptions import PermissionDenied
        if not is_admin_user(self.request.user):
            raise PermissionDenied("You do not have permission to delete this post.")
        instance.delete()

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError

        sanitized_content = sanitize_rich_text(serializer.validated_data.get('content', ''))
        if not strip_tags(sanitized_content).strip():
            raise ValidationError({"content": "This field may not be blank."})

        requested_is_draft = bool(serializer.validated_data.get('is_draft', False))
        if is_staff_user(self.request.user):
            initial_status = 'draft' if requested_is_draft else 'published'
        else:
            initial_status = 'draft' if requested_is_draft else 'review'

        save_kwargs = {
            'author': self.request.user,
            'content': sanitized_content,
            'status': initial_status,
            'is_draft': initial_status != 'published',
        }

        if initial_status == 'review':
            save_kwargs['approval_requested_at'] = timezone.now()
        elif initial_status == 'published':
            save_kwargs['approved_by'] = self.request.user
            save_kwargs['approved_at'] = timezone.now()

        created_post = serializer.save(**save_kwargs)
        sync_post_cve_mentions(created_post)

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

    @action(detail=True, methods=['get', 'post', 'put', 'delete'], permission_classes=[permissions.IsAuthenticatedOrReadOnly])
    def summarize(self, request, pk=None):
        from rest_framework.exceptions import PermissionDenied

        post = self.get_object()

        if request.method == 'GET':
            if not post.summary:
                return Response({'error': 'Summary not found.'}, status=status.HTTP_404_NOT_FOUND)
            return Response({'summary': post.summary}, status=status.HTTP_200_OK)

        if not request.user.is_authenticated or (request.user.id != post.author_id and not request.user.is_staff):
            raise PermissionDenied("You do not have permission to modify the summary.")

        if request.method == 'POST':
            if post.summary:
                return Response({'summary': post.summary}, status=status.HTTP_200_OK)

            try:
                summary_payload = legacy_views.generate_summary_payload(post)
            except RuntimeError as exc:
                return Response({'error': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            except (json.JSONDecodeError, ValueError) as exc:
                return Response({'error': f'Invalid AI summary output: {exc}'}, status=status.HTTP_502_BAD_GATEWAY)
            except Exception as exc:
                return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

            post.summary = json.dumps(summary_payload, ensure_ascii=False)
            post.is_summarized = True
            post.save(update_fields=['summary', 'is_summarized'])
            sync_post_cve_mentions(post)
            return Response({'summary': post.summary}, status=status.HTTP_200_OK)

        if request.method == 'PUT':
            summary_content = request.data.get('summary')
            if summary_content is None:
                return Response({'error': 'summary required'}, status=status.HTTP_400_BAD_REQUEST)

            if isinstance(summary_content, dict):
                try:
                    normalized = normalize_summary_payload(summary_content)
                    post.summary = json.dumps(normalized, ensure_ascii=False)
                except ValueError as exc:
                    return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            else:
                summary_text = str(summary_content).strip()
                if summary_text.startswith('{'):
                    try:
                        parsed = json.loads(summary_text)
                        normalized = normalize_summary_payload(parsed)
                        post.summary = json.dumps(normalized, ensure_ascii=False)
                    except (json.JSONDecodeError, ValueError) as exc:
                        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
                else:
                    clean_summary = strip_tags(summary_text).strip()
                    if not clean_summary:
                        return Response({'error': 'summary required'}, status=status.HTTP_400_BAD_REQUEST)
                    post.summary = clean_summary

            post.is_summarized = True
            post.save(update_fields=['summary', 'is_summarized'])
            sync_post_cve_mentions(post)
            return Response({'summary': post.summary}, status=status.HTTP_200_OK)

        if request.method == 'DELETE':
            post.summary = ''
            post.is_summarized = False
            post.save(update_fields=['summary', 'is_summarized'])
            sync_post_cve_mentions(post)
            return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def toggle_share(self, request, pk=None):
        from rest_framework.exceptions import PermissionDenied

        post = self.get_object()
        if not is_staff_user(request.user):
            raise PermissionDenied("Only staff can curate this post.")
        post.is_shared = not post.is_shared
        post.save(update_fields=['is_shared'])
        return Response({'is_shared': post.is_shared}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def submit_for_review(self, request, pk=None):
        from rest_framework.exceptions import PermissionDenied

        post = self.get_object()
        if post.author_id != request.user.id and not is_staff_user(request.user):
            raise PermissionDenied("You do not have permission to submit this post.")
        if post.status not in ['draft', 'rejected']:
            return Response({'error': 'Only draft or rejected posts can be submitted for review.'}, status=status.HTTP_400_BAD_REQUEST)

        _apply_post_status(post, 'review', actor=request.user)
        post.save(update_fields=[
            'status',
            'is_draft',
            'approval_requested_at',
            'approved_by',
            'approved_at',
            'rejected_by',
            'rejected_at',
            'rejection_reason',
            'archived_at',
        ])
        return Response({'status': post.status}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsStaffUser])
    def approve(self, request, pk=None):
        post = self.get_object()
        if post.status != 'review':
            return Response({'error': 'Only posts in review can be approved.'}, status=status.HTTP_400_BAD_REQUEST)

        _apply_post_status(post, 'published', actor=request.user)
        post.save(update_fields=[
            'status',
            'is_draft',
            'approved_by',
            'approved_at',
            'rejected_by',
            'rejected_at',
            'rejection_reason',
            'archived_at',
        ])
        return Response({'status': post.status}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsStaffUser])
    def reject(self, request, pk=None):
        post = self.get_object()
        if post.status != 'review':
            return Response({'error': 'Only posts in review can be rejected.'}, status=status.HTTP_400_BAD_REQUEST)

        reason = (request.data.get('reason') or '').strip()
        _apply_post_status(post, 'rejected', actor=request.user, rejection_reason=reason)
        post.save(update_fields=[
            'status',
            'is_draft',
            'rejected_by',
            'rejected_at',
            'rejection_reason',
            'archived_at',
        ])
        return Response({'status': post.status, 'rejection_reason': post.rejection_reason}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsStaffUser])
    def archive(self, request, pk=None):
        post = self.get_object()
        if post.status == 'archived':
            return Response({'error': 'Post is already archived.'}, status=status.HTTP_400_BAD_REQUEST)

        _apply_post_status(post, 'archived', actor=request.user)
        post.save(update_fields=['status', 'is_draft', 'archived_at'])
        return Response({'status': post.status}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def restore_to_draft(self, request, pk=None):
        from rest_framework.exceptions import PermissionDenied

        post = self.get_object()
        if post.author_id != request.user.id and not is_staff_user(request.user):
            raise PermissionDenied("You do not have permission to restore this post.")
        if post.status not in ['rejected', 'review', 'archived']:
            return Response({'error': 'Only rejected, review, or archived posts can be restored.'}, status=status.HTTP_400_BAD_REQUEST)

        _apply_post_status(post, 'draft', actor=request.user)
        post.save(update_fields=[
            'status',
            'is_draft',
            'approval_requested_at',
            'approved_by',
            'approved_at',
            'rejected_by',
            'rejected_at',
            'rejection_reason',
            'archived_at',
        ])
        return Response({'status': post.status}, status=status.HTTP_200_OK)
