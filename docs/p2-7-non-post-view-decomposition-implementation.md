# P2-7 AI / crawler / analytics view 분리 1차 구현

## 안건 요약

`PostViewSet`와 post helper를 분리한 뒤에도 [backend/api/views.py](/C:/project/Codex/Crawler/backend/api/views.py)에는 아래 블록이 남아 있었다.

- AI 설정 / 모델 / 테스트 클러스터링
- crawler source / run
- CVE 조회
- dashboard

이번 `P2-7`의 목표는 이 블록을 역할별 모듈로 분리해 `views.py`를 인증/유저/카테고리/댓글 중심의 얇은 진입점으로 만드는 것이다.

## 구현 결과

### 공통 helper 분리

- [backend/api/view_helpers.py](/C:/project/Codex/Crawler/backend/api/view_helpers.py)
  - `is_staff_user`
  - `is_admin_user`
  - `IsStaffUser`
  - `IsSuperUser`
  - `sanitize_rich_text`

### AI view 분리

- [backend/api/ai_views.py](/C:/project/Codex/Crawler/backend/api/ai_views.py)
  - `AIConfigView`
  - `TestClusteringView`
  - `AIModelsView`

### crawler view 분리

- [backend/api/crawler_views.py](/C:/project/Codex/Crawler/backend/api/crawler_views.py)
  - `CrawlerSourceViewSet`
  - `CrawlerRunViewSet`

### analytics view 분리

- [backend/api/analytics_views.py](/C:/project/Codex/Crawler/backend/api/analytics_views.py)
  - `CveRecordViewSet`
  - `DashboardView`

### views.py 정리

- [backend/api/views.py](/C:/project/Codex/Crawler/backend/api/views.py)
  - `RegisterView`
  - `UserViewSet`
  - `UserProfileView`
  - `CategoryViewSet`
  - `CommentViewSet`
  - helper / separated view 재-export

즉, `views.py`는 더 이상 대형 운영 뷰 구현을 직접 들고 있지 않는다.

## 이슈와 처리

### 1. `view_helpers.py` 누락

첫 분리 시 공통 helper 모듈이 실제 파일로 추가되지 않아 `ModuleNotFoundError`가 발생했다.  
파일 추가 후 해결했다.

### 2. 테스트 patch 경로 호환성

기존 테스트가 `api.views.validate_crawler_request_config`를 patch하고 있어서,  
[backend/api/views.py](/C:/project/Codex/Crawler/backend/api/views.py)에서 해당 심볼을 계속 import/re-export하도록 유지했다.

## 검증 결과

```powershell
.\venv\Scripts\python.exe backend\manage.py check
.\venv\Scripts\python.exe backend\manage.py test api.tests --keepdb
```

검증 결과:

- `manage.py check`: 통과
- `api.tests --keepdb`: 통과

## 결론

이번 단계로 `backend/api/views.py`의 대형 기능 블록 분리는 사실상 마무리됐다.  
이제 다음 리팩터링은 `crawler.py` 내부 분해 또는 Playwright 자동화 테스트 구현으로 넘어가는 것이 적절하다.
