import os
import django
import sys

# Django Setup
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.models import Post
from api.embeddings import get_embedding

def run():
    posts = Post.objects.filter(embedding__isnull=True)
    count = posts.count()
    if count == 0:
        print("업데이트할 게시글이 없습니다.")
        return

    print(f"총 {count}개의 게시글에 대해 임베딩(Vector) 추출을 시작합니다...")
    updated = 0
    for i, post in enumerate(posts, start=1):
        embedding_text = f"{post.title}\n{post.content}"
        vector = get_embedding(embedding_text)
        
        if vector:
            post.embedding = vector
            post.save(update_fields=['embedding'])
            updated += 1
            print(f"[{i}/{count}] 성공: {post.title[:30]}...")
        else:
            print(f"[{i}/{count}] 실패: {post.title[:30]}...")

    print(f"작업 완료. 총 {updated}/{count}건 업데이트됨.")

if __name__ == '__main__':
    run()
