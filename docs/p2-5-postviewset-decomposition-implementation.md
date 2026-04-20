# P2-5 PostViewSet 분해 1차 구현

## 안건 요약

[backend/api/views.py](/C:/project/Codex/Crawler/backend/api/views.py)는 게시글, 댓글, AI, 크롤러, CVE, 대시보드까지 모두 포함하고 있었다.  
이번 `P2-5`의 목표는 가장 큰 책임 덩어리인 `PostViewSet`을 별도 모듈로 분리하는 것이다.

## 구현 결과

### 분리 방식

- [backend/api/post_views.py](/C:/project/Codex/Crawler/backend/api/post_views.py) 추가
- `PostViewSet` 본체를 새 모듈로 이동
- [backend/api/views.py](/C:/project/Codex/Crawler/backend/api/views.py)에서는 `from .post_views import PostViewSet`로 연결
- URL 경로와 라우터는 그대로 유지

### 같이 유지한 helper

이번 1차에서는 아래 helper는 기존 [views.py](/C:/project/Codex/Crawler/backend/api/views.py)에 유지했다.

- `sanitize_rich_text`
- `normalize_summary_payload`
- `generate_summary_payload`
- `_apply_post_status`
- 권한 helper (`is_staff_user`, `is_admin_user`, `IsStaffUser`)

즉, 첫 단계는 `ViewSet 분리`까지만 하고, helper/service 완전 분리는 다음 라운드로 남겼다.

### 테스트 호환성 조정

- summary 생성 테스트는 기존 `api.views.generate_summary_payload` patch 경로를 사용하고 있었다.
- 이를 유지하기 위해 [post_views.py](/C:/project/Codex/Crawler/backend/api/post_views.py)에서는 runtime 시점에 `legacy_views.generate_summary_payload`를 참조하도록 맞췄다.

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

1. summary / post workflow helper를 `views.py`에서 분리
2. crawler 관련 ViewSet을 별도 모듈로 분리
3. CVE / dashboard 분리

## 결론

이번 단계로 `views.py`에서 가장 큰 책임 블록 하나를 안전하게 떼어냈다.  
다음 리팩터링은 helper/service 계층을 분리해 `views.py`를 더 얇게 만드는 방향이 맞다.
