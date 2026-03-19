from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PostViewSet, CategoryViewSet, UserViewSet, RegisterView, UserProfileView, CommentViewSet, AIConfigView, TestClusteringView, AIModelsView, CrawlerSourceViewSet, DashboardView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

router = DefaultRouter()
router.register(r'posts', PostViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'users', UserViewSet)
router.register(r'comments', CommentViewSet)
router.register(r'crawler-sources', CrawlerSourceViewSet)

urlpatterns = [
    path('users/me/', UserProfileView.as_view(), name='user_profile'),
    path('', include(router.urls)),
    path('register/', RegisterView.as_view(), name='register'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('ai-config/', AIConfigView.as_view(), name='ai_config'),
    path('ai-config/test_clustering/', TestClusteringView.as_view(), name='ai_config_test'),
    path('ai-models/', AIModelsView.as_view(), name='ai_models'),
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
]
