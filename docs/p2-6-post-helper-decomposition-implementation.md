# P2-6 Post helper 분해 1차 구현

## 안건 요약

`PostViewSet`를 분리한 뒤에도 [backend/api/views.py](/C:/project/Codex/Crawler/backend/api/views.py)에는 게시글 전용 helper가 남아 있었다.

대표적으로:

- summary payload 정규화
- AI summary 생성
- 게시글 상태 전이

이번 `P2-6`의 목표는 이 helper를 별도 모듈로 이동해 `views.py`를 더 얇게 만드는 것이다.

## 구현 결과

### 새 모듈

- [backend/api/post_helpers.py](/C:/project/Codex/Crawler/backend/api/post_helpers.py)

포함 기능:

- `html_to_plain`
- `normalize_summary_payload`
- `generate_summary_payload`
- `apply_post_status`

### views.py 정리

- [backend/api/views.py](/C:/project/Codex/Crawler/backend/api/views.py)
  - summary/workflow helper 본문 제거
  - 필요한 함수는 `post_helpers`에서 import
  - 테스트 호환을 위해 `generate_summary_payload`, `normalize_summary_payload`, `_apply_post_status` 이름은 계속 `views.py`에서 노출

### post_views.py 정리

- [backend/api/post_views.py](/C:/project/Codex/Crawler/backend/api/post_views.py)
  - `normalize_summary_payload`, `apply_post_status`는 `post_helpers`에서 직접 참조
  - `generate_summary_payload`는 기존 테스트 mock 경로 호환을 위해 `legacy_views.generate_summary_payload` 경유 호출 유지

## 검증 결과

```powershell
.\venv\Scripts\python.exe backend\manage.py check
.\venv\Scripts\python.exe backend\manage.py test api.tests --keepdb
```

검증 결과:

- `manage.py check`: 통과
- `api.tests --keepdb`: 통과

## 다음 후보

다음 분해 우선순위는 아래가 적절하다.

1. crawler 관련 ViewSet을 `views.py`에서 분리
2. CVE / dashboard 분리
3. 권한 helper 및 sanitize helper 공통 모듈화

## 결론

이번 단계로 `views.py`에서 게시글 전용 helper까지 분리했다.  
이제 남은 `views.py`는 댓글, 인증/프로필, AI, 크롤러, CVE, 대시보드 중심으로 더 명확해졌다.
