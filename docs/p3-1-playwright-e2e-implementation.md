# P3-1 Playwright 기반 핵심 E2E 자동화 구현

## 안건 요약

기존에는 핵심 사용자 흐름이 문서화만 되어 있었고 자동화 회귀 검증이 없었다.  
이번 `P3-1`의 목표는 문서화된 핵심 흐름 중 우선순위가 높은 4개 범주를 Playwright E2E로 구현하는 것이다.

## 구현 결과

### Playwright 인프라 추가

- [frontend/package.json](/C:/project/Codex/Crawler/frontend/package.json)
  - `@playwright/test` devDependency 추가
  - `test:e2e`
  - `test:e2e:headed`

- [frontend/playwright.config.ts](/C:/project/Codex/Crawler/frontend/playwright.config.ts)
  - backend / frontend webServer 설정
  - `globalSetup` 등록
  - output 경로를 `output/playwright/test-results`로 설정

### E2E 시드 추가

- [backend/api/management/commands/seed_e2e_data.py](/C:/project/Codex/Crawler/backend/api/management/commands/seed_e2e_data.py)
  - `qa_author`
  - `qa_staff`
  - `qa_admin`
  - review / draft / published 게시글
  - 댓글
  - CVE 연결 데이터

### Playwright helper

- [frontend/tests/e2e/global.setup.ts](/C:/project/Codex/Crawler/frontend/tests/e2e/global.setup.ts)
  - 로컬 PostgreSQL 시작
  - E2E 시드 실행

- [frontend/tests/e2e/helpers.ts](/C:/project/Codex/Crawler/frontend/tests/e2e/helpers.ts)
  - 시드 재실행 helper
  - UI 로그인 helper
  - 공개 게시글 ID 조회 helper

### 추가한 스펙

- [frontend/tests/e2e/admin-posts.spec.ts](/C:/project/Codex/Crawler/frontend/tests/e2e/admin-posts.spec.ts)
  - staff가 review 게시글 승인 가능

- [frontend/tests/e2e/post-detail.spec.ts](/C:/project/Codex/Crawler/frontend/tests/e2e/post-detail.spec.ts)
  - guest 공개 상세 접근
  - staff 댓글/요약 운영 버튼 노출

- [frontend/tests/e2e/auth-profile.spec.ts](/C:/project/Codex/Crawler/frontend/tests/e2e/auth-profile.spec.ts)
  - author 로그인
  - 프로필에서 draft 게시글 검토 요청

- [frontend/tests/e2e/dashboard-cve.spec.ts](/C:/project/Codex/Crawler/frontend/tests/e2e/dashboard-cve.spec.ts)
  - staff 대시보드 접근
  - guest CVE 목록/상세 접근

## 이슈와 처리

### 1. Playwright webServer readiness 오판

초기 설정에서 backend readiness URL을 `/`로 둬서 Django 404를 readiness 실패로 판단했다.  
`/api/categories/`로 변경해 해결했다.

### 2. 로그인 selector 불안정

로그인 화면의 label 연결이 없어 `getByLabel()`이 실패했다.  
input selector 기반으로 helper를 안정화했다.

### 3. 홈 피드에서 시드 게시글 탐색 불안정

홈 피드에 데이터가 많아 링크 텍스트 탐색이 불안정했다.  
공개 posts API로 제목 기반 ID를 조회한 뒤 상세 페이지에 직접 진입하도록 수정했다.

## 검증 결과

```powershell
cd frontend
npm run test:e2e
npm run lint
npm run build
```

검증 결과:

- `npm run test:e2e`: 6 passed
- `npm run lint`: 통과
- `npm run build`: 통과

## 결론

이번 단계로 문서 기반 QA 시나리오 중 핵심 4개 범주가 실제 브라우저 자동화 테스트로 올라왔다.  
이제 다음 자동화 라운드는 crawler 운영 플로우 또는 더 세밀한 권한 회귀 케이스를 추가하는 방향이 적절하다.
