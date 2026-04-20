import os

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AIConfig, Post
from .serializers import AIConfigSerializer
from .view_helpers import IsSuperUser

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None


class AIConfigView(APIView):
    permission_classes = [IsSuperUser]

    def get(self, request):
        config = AIConfig.get_config()
        serializer = AIConfigSerializer(config)
        return Response(serializer.data)

    def put(self, request):
        config = AIConfig.get_config()
        serializer = AIConfigSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TestClusteringView(APIView):
    permission_classes = [IsSuperUser]

    def post(self, request):
        try:
            threshold = float(request.data.get('threshold', 0.2))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid threshold value'}, status=status.HTTP_400_BAD_REQUEST)

        import numpy as np

        posts_qs = Post.objects.filter(
            embedding__isnull=False,
            category__name__iexact='news',
        ).order_by('-created_at')[:50]
        posts = list(posts_qs)
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
            for j in range(i):
                prev_p = posts[j]
                if virtual_parents[prev_p.id] is None:
                    prev_vec = np.array(prev_p.embedding)
                    dist = cosine_dist(p_vec, prev_vec)
                    if dist < best_dist and dist < threshold:
                        best_dist = dist
                        best_parent_id = prev_p.id
            if best_parent_id is not None:
                virtual_parents[p.id] = best_parent_id

        clusters = {}
        for p in posts:
            parent_id = virtual_parents[p.id]
            if parent_id is None:
                clusters[p.id] = {'parent': p.title, 'children': []}
            else:
                clusters[parent_id]['children'].append(p.title)

        result = [c for c in clusters.values() if len(c['children']) > 0]
        unclustered_count = sum(1 for c in clusters.values() if len(c['children']) == 0)
        return Response({
            'clusters': result,
            'unclustered_count': unclustered_count,
            'total_tested': len(posts),
        })


class AIModelsView(APIView):
    permission_classes = [IsSuperUser]

    def get(self, request):
        api_key = os.environ.get('OPENAI_API_KEY', '')
        if not api_key or api_key.startswith('sk-dummy'):
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
            chat_models = sorted(
                [m for m in all_models.data if m.id.startswith(('gpt-', 'o1', 'o3', 'o4', 'chatgpt-'))],
                key=lambda m: m.id,
                reverse=True,
            )

            def categorize(model_id):
                if model_id.startswith('gpt-5'):
                    return 'GPT-5'
                if model_id.startswith('gpt-4.1'):
                    return 'GPT-4.1'
                if model_id.startswith('gpt-4o'):
                    return 'GPT-4o'
                if model_id.startswith('gpt-4'):
                    return 'GPT-4'
                if model_id.startswith(('o4', 'o3', 'o1')):
                    return 'o-series'
                if model_id.startswith('gpt-3'):
                    return 'Legacy'
                return 'Other'

            return Response({
                'models': [{'id': m.id, 'category': categorize(m.id)} for m in chat_models],
                'source': 'openai',
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)
