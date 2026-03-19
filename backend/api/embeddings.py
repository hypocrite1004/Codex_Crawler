import os
import re
from openai import OpenAI
from django.conf import settings

def get_embedding(text: str, model="text-embedding-3-small") -> list[float]:
    """
    텍스트를 받아 OpenAI API를 통해 임베딩 벡터를 반환합니다.
    """
    if not text or not text.strip():
        return []
    
    # 환경 변수에서 API Key 시도
    api_key = os.environ.get('OPENAI_API_KEY', '')
    if not api_key or api_key.startswith('sk-dummy'):
        print("[Embedding] No valid OPENAI_API_KEY found in environment.")
        return []

    try:
        client = OpenAI(api_key=api_key)
        
        # 텍스트 전처리: 불필요한 공백 및 줄바꿈 압축 (토큰 절약 및 품질 향상)
        text = text.replace("\n", " ")
        text = re.sub(r'\s+', ' ', text).strip()
        
        response = client.embeddings.create(
            input=[text],
            model=model
        )
        return response.data[0].embedding
        
    except Exception as e:
        print(f"[Embedding] Error generating embedding: {e}")
        return []
