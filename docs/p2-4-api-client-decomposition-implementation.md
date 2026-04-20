# P2-4 프론트 API 클라이언트 분해 1차 구현

## 안건 요약

[frontend/src/lib/api.ts](/C:/project/Codex/Crawler/frontend/src/lib/api.ts)는 인증, 게시글, 댓글, CVE, AI, 크롤러, 대시보드 API와 공통 타입까지 한 파일에 몰려 있었다.

이번 `P2-4`의 목표는 외부 import 경로는 유지하면서 내부 구현만 기능별 모듈로 분리하는 것이다.

## 구현 결과

### 분해 방식

- 기존 경로 `@/lib/api`는 유지
- [frontend/src/lib/api.ts](/C:/project/Codex/Crawler/frontend/src/lib/api.ts)는 배럴 파일로 축소
- 실제 구현은 `frontend/src/lib/api/` 아래 기능별 파일로 분리

### 추가된 모듈

- [frontend/src/lib/api/types.ts](/C:/project/Codex/Crawler/frontend/src/lib/api/types.ts)
  - 공통 타입
- [frontend/src/lib/api/core.ts](/C:/project/Codex/Crawler/frontend/src/lib/api/core.ts)
  - `API_URL`, 토큰 helper, `fetchWithAuth`, `getHeaders`, `logout`
- [frontend/src/lib/api/posts.ts](/C:/project/Codex/Crawler/frontend/src/lib/api/posts.ts)
  - 게시글, 댓글, 요약, 워크플로, 카테고리
- [frontend/src/lib/api/auth.ts](/C:/project/Codex/Crawler/frontend/src/lib/api/auth.ts)
  - 로그인, 회원가입, 프로필
- [frontend/src/lib/api/cves.ts](/C:/project/Codex/Crawler/frontend/src/lib/api/cves.ts)
  - CVE API
- [frontend/src/lib/api/ai.ts](/C:/project/Codex/Crawler/frontend/src/lib/api/ai.ts)
  - AI 설정/모델
- [frontend/src/lib/api/crawler.ts](/C:/project/Codex/Crawler/frontend/src/lib/api/crawler.ts)
  - 크롤러 관련 API
- [frontend/src/lib/api/dashboard.ts](/C:/project/Codex/Crawler/frontend/src/lib/api/dashboard.ts)
  - 대시보드 API

## 유지한 기준

- 화면 코드의 import 경로는 변경하지 않음
- 외부 계약면의 export 이름은 유지
- 인증 재시도/로그아웃 흐름은 [core.ts](/C:/project/Codex/Crawler/frontend/src/lib/api/core.ts)에 계속 집중

## 주의점

- 하위 모듈은 배럴 `@/lib/api`를 다시 import하지 않고, leaf 모듈끼리 직접 참조하도록 유지했다.
- `fetchWithAuth`, `logout`, 토큰 helper는 순환 의존을 피하기 위해 `core.ts`에 집중시켰다.

## 검증 결과

```powershell
cd frontend
npm run lint
npm run build
```

검증 결과:

- `npm run lint`: 통과
- `npm run build`: 통과

## 다음 후보

다음 실제 리팩터링 우선순위는 아래 순서가 적절하다.

1. [backend/api/views.py](/C:/project/Codex/Crawler/backend/api/views.py)에서 `PostViewSet` 분리
2. [backend/api/crawler.py](/C:/project/Codex/Crawler/backend/api/crawler.py) 분해
3. [frontend/src/app/admin/posts/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/admin/posts/page.tsx) UI 블록 분리
