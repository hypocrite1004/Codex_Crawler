import os
import sys
import django

# Django Setup
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.models import Post
from pgvector.django import CosineDistance

def run():
    # 병합 관계 초기화
    Post.objects.update(parent_post=None)
    
    # 시간순 정렬 (오래된 것 -> 최신 것)
    posts = Post.objects.filter(embedding__isnull=False).order_by('created_at')
    count = posts.count()
    if count == 0:
        print("임베딩된 게시글이 없습니다.")
        return

    print(f"총 {count}개의 게시글에 대해 [최신 기사 중심] 역전 병합(Clustering)을 다시 적용합니다...")
    updated = 0
    for new_post in posts:
        # 나보다 먼저 저장된 과거 기사 중 최상위(부모가 없는) 대표 기사 탐색
        closest = Post.objects.filter(
            id__lt=new_post.id,
            parent_post__isnull=True,
            embedding__isnull=False
        ).annotate(
            distance=CosineDistance('embedding', new_post.embedding)
        ).order_by('distance').first()

        # 코사인 거리 0.30 미만이면 병합 (테스트 목적 0.30 유지)
        if closest and getattr(closest, 'distance', 1.0) < 0.30:
            # 1. 과거 기사를 최신 기사에 종속
            closest.parent_post = new_post
            closest.save(update_fields=['parent_post'])
            
            # 2. 과거 기사가 갖고 있던 손자 기사들을 모두 최신 기사로 이동
            Post.objects.filter(parent_post=closest.id).exclude(id=closest.id).exclude(id=new_post.id).update(parent_post=new_post)
            
            updated += 1
            print(f"✅ 역전 병합: 과거 '{closest.title}' -> 최신 '{new_post.title}'에 종속 (거리: {closest.distance:.3f})")
        elif closest:
            print(f"➖ 패스: '{new_post.title}' (가장 유사한 과거 기사: '{closest.title}' / 거리: {closest.distance:.3f})")

    print(f"작업 완료. 총 {updated}개의 과거 기사가 최신 기사에 종속됨.")

if __name__ == '__main__':
    run()
