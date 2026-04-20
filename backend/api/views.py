from django.contrib.auth.models import User
from django.db.models import Q
from django.utils.html import strip_tags
from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response

from .models import Category, Comment
from .crawler_security import CrawlerSecurityError, validate_crawler_request_config
from .post_helpers import apply_post_status as _apply_post_status
from .post_helpers import generate_summary_payload, normalize_summary_payload
from .serializers import CategorySerializer, CommentSerializer, ProfileSerializer, PublicUserSerializer, RegisterSerializer
from .view_helpers import IsStaffUser, IsSuperUser, is_admin_user, is_staff_user, sanitize_rich_text

# Re-export separated views to keep existing import paths stable.
from .post_views import PostViewSet
from .ai_views import AIConfigView, AIModelsView, TestClusteringView
from .crawler_views import CrawlerRunViewSet, CrawlerSourceViewSet
from .analytics_views import CveRecordViewSet, DashboardView


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
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = Comment.objects.select_related('author', 'post', 'post__author')
        if is_staff_user(self.request.user):
            return queryset
        if not self.request.user.is_authenticated:
            return queryset.none()
        return queryset.filter(author=self.request.user)

    def list(self, request, *args, **kwargs):
        if not is_staff_user(request.user):
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return super().list(request, *args, **kwargs)

    def perform_update(self, serializer):
        from rest_framework.exceptions import PermissionDenied, ValidationError

        if serializer.instance.author.id != self.request.user.id and not is_staff_user(self.request.user):
            raise PermissionDenied("You do not have permission to edit this comment.")
        sanitized_content = sanitize_rich_text(serializer.validated_data.get('content', serializer.instance.content))
        if not strip_tags(sanitized_content).strip():
            raise ValidationError({"content": "This field may not be blank."})
        serializer.save(content=sanitized_content)

    def perform_destroy(self, instance):
        from rest_framework.exceptions import PermissionDenied

        if instance.author.id != self.request.user.id and not is_staff_user(self.request.user):
            raise PermissionDenied("You do not have permission to delete this comment.")
        instance.delete()
