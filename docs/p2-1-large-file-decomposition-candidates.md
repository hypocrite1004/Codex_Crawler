# P2-1 대형 파일 분해 후보 식별

## 목적

현재 프로젝트는 기능은 확장됐지만, 몇몇 파일이 책임을 너무 많이 떠안고 있다.  
이번 `P2-1`의 목적은 즉시 리팩터링을 시작하는 것이 아니라, `어디를 어떤 경계로 나눌지`를 먼저 고정하는 것이다.

## 우선순위 기준

- 파일 길이
- 서로 다른 책임이 한 파일에 섞여 있는 정도
- 테스트/회귀 리스크
- 다른 작업의 병렬 진행을 막는 정도

## 1순위 후보

### 1. [backend/api/views.py](/C:/project/Codex/Crawler/backend/api/views.py)

- 현재 길이: 약 `1262` lines

#### 섞여 있는 책임

- 인증/유저 프로필
- 카테고리
- 댓글
- 게시글 워크플로
- 요약
- AI 설정/모델
- 크롤러 운영
- CVE 조회
- 대시보드

#### 권장 분해 경계

- `views/auth.py`
  - register, profile
- `views/comments.py`
  - `CommentViewSet`
- `views/posts.py`
  - `PostViewSet`, 게시글 워크플로, summary action
- `views/ai.py`
  - `AIConfigView`, `AIModelsView`, `TestClusteringView`
- `views/crawler.py`
  - `CrawlerSourceViewSet`, `CrawlerRunViewSet`
- `views/cves.py`
  - `CveRecordViewSet`
- `views/dashboard.py`
  - `DashboardView`

#### 주의점

- `is_staff_user`, `is_admin_user`, `IsStaffUser`, `IsSuperUser` 같은 공통 권한 헬퍼는 별도 공통 모듈로 이동하는 편이 낫다.
- summary 관련 helper(`normalize_summary_payload`, `generate_summary_payload`)는 `views.py`에 두지 말고 별도 서비스/utility 모듈로 빼는 것이 맞다.

### 2. [backend/api/crawler.py](/C:/project/Codex/Crawler/backend/api/crawler.py)

- 현재 길이: 약 `1056` lines

#### 섞여 있는 책임

- RSS fetch
- HTML fetch / parsing
- Playwright fallback
- URL 정규화
- crawl item persistence
- run/log aggregation
- Telegram notification
- preview proxy

#### 권장 분해 경계

- `crawler/fetchers.py`
  - `crawl_rss`, `crawl_html`, playwright/httpx fetch
- `crawler/parsing.py`
  - HTML cleaning, markdown 변환, selector parsing
- `crawler/persistence.py`
  - `_record_crawl_item`, `_persist_crawled_items_with_run`, totals
- `crawler/runtime.py`
  - `run_crawl`
- `crawler/preview.py`
  - `_SourceProxy`, `preview_crawl`
- `crawler/notifications.py`
  - Telegram 전송
- `crawler/url_utils.py`
  - `normalize_source_url`

#### 주의점

- fetch/parsing/persistence를 한 번에 분리하면 리스크가 크다.
- 1차 분해는 `runtime`, `preview`, `notifications`, `url_utils`처럼 의존성이 낮은 블록부터 나누는 편이 안전하다.

### 3. [frontend/src/lib/api.ts](/C:/project/Codex/Crawler/frontend/src/lib/api.ts)

- 현재 길이: 약 `1036` lines

#### 섞여 있는 책임

- API URL / fetch wrapper
- 인증/세션
- 게시글
- 댓글
- 요약
- CVE
- 게시글 워크플로
- 프로필
- AI 설정
- 크롤러
- 대시보드

#### 권장 분해 경계

- `lib/api/core.ts`
  - `API_URL`, fetch wrapper, headers, error helper
- `lib/api/auth.ts`
  - login, register, logout, profile, token helpers
- `lib/api/posts.ts`
  - posts, comments, summary, workflow
- `lib/api/cves.ts`
  - cve list/detail/posts
- `lib/api/ai.ts`
  - ai config, models, clustering
- `lib/api/crawler.ts`
  - crawler sources, preview, logs, runs
- `lib/api/dashboard.ts`
  - dashboard

#### 주의점

- 기존 import 경로가 많기 때문에 1차는 re-export index를 유지하는 편이 안전하다.
- `core.ts`와 `auth.ts`를 먼저 빼고, 나머지는 기능 단위로 천천히 나누는 것이 맞다.

## 2순위 후보

### 4. [frontend/src/app/admin/posts/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/admin/posts/page.tsx)

- 현재 길이: 약 `553` lines

#### 권장 분해 경계

- 필터/검색 바
- 상태 badge와 액션 버튼
- 게시글 테이블/리스트
- 승인/반려 dialog

### 5. [frontend/src/components/HomeFeed.tsx](/C:/project/Codex/Crawler/frontend/src/components/HomeFeed.tsx)

- 현재 길이: 약 `346` lines

#### 권장 분해 경계

- 필터 상태 관리 hook
- 무한 스크롤/가상화 hook
- 카드 그리드
- 필터 UI 블록

### 6. [frontend/src/app/profile/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/profile/page.tsx)

- 현재 길이: 약 `322` lines

#### 권장 분해 경계

- 프로필 편집 패널
- 내 게시글 필터/카운트
- 워크플로 액션 버튼

## 우선 실행 순서

1. `backend/api/views.py`
2. `frontend/src/lib/api.ts`
3. `backend/api/crawler.py`
4. `frontend/src/app/admin/posts/page.tsx`
5. `frontend/src/components/HomeFeed.tsx`
6. `frontend/src/app/profile/page.tsx`

## 리팩터링 착수 권장 순서

### 1차

- `views.py`에서 crawler / ai / cve / dashboard 분리
- `api.ts`에서 core / auth 분리

### 2차

- `crawler.py`에서 preview / notifications / url utils 분리
- `admin/posts/page.tsx` UI 블록 분리

### 3차

- `HomeFeed.tsx`, `profile/page.tsx` 분리
- crawler fetch/parsing/persistence 본격 분리

## 결론

가장 먼저 손대야 할 곳은 `backend/api/views.py`와 `frontend/src/lib/api.ts`다.  
이 둘이 현재 기능 확장 속도를 가장 많이 떨어뜨리고 있고, 다른 작업의 병렬성도 가장 크게 제한하고 있다.
