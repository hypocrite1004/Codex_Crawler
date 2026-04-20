# P2-2 프론트 자동화 테스트 필요 범위 정리

## 목적

현재 프론트는 권한, 공개/비공개 정책, 운영자 화면, 대시보드, CVE 흐름이 강하게 연결돼 있다.  
따라서 자동화 테스트도 컴포넌트 단위보다 `사용자 흐름 기반 E2E`를 우선하는 편이 적절하다.

## 현재 상태

- [frontend/package.json](/C:/project/Codex/Crawler/frontend/package.json)에는 테스트 스크립트가 없다.
- 다만 [frontend/package-lock.json](/C:/project/Codex/Crawler/frontend/package-lock.json) 기준으로 `@playwright/test` 해상 흔적이 있어, 도구 선택은 Playwright E2E가 가장 자연스럽다.

## 우선순위 높은 자동화 범위

### 1. 관리자 글 관리

대상:

- [frontend/src/app/admin/posts/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/admin/posts/page.tsx)

검증 포인트:

- review 게시글 목록 노출
- 승인
- 반려
- draft 복원
- 보관(archive)

우선순위:

- `최상`

이유:

- 게시글 워크플로의 핵심 운영 흐름
- 권한/상태 회귀 위험이 큼

### 2. 게시글 상세 / 댓글 / 요약

대상:

- [frontend/src/app/posts/[id]/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/posts/[id]/page.tsx)
- [frontend/src/components/PostComments.tsx](/C:/project/Codex/Crawler/frontend/src/components/PostComments.tsx)
- [frontend/src/components/PostSummary.tsx](/C:/project/Codex/Crawler/frontend/src/components/PostSummary.tsx)

검증 포인트:

- guest 공개 상세 접근
- 비공개 게시글 차단
- 댓글 작성
- staff 댓글 수정/삭제 버튼 노출
- 작성자/staff 요약 생성/수정/삭제

우선순위:

- `최상`

### 3. 로그인 / 프로필

대상:

- [frontend/src/app/login/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/login/page.tsx)
- [frontend/src/app/register/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/register/page.tsx)
- [frontend/src/app/profile/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/profile/page.tsx)

검증 포인트:

- 로그인
- 회원가입 후 자동 로그인
- 프로필 진입
- 내 게시글 필터
- 검토 요청 / draft 복원

우선순위:

- `높음`

### 4. 대시보드 / CVE 흐름

대상:

- [frontend/src/app/dashboard/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/dashboard/page.tsx)
- [frontend/src/app/cves/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/cves/page.tsx)
- [frontend/src/app/cves/[id]/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/cves/[id]/page.tsx)

검증 포인트:

- staff/admin 대시보드 차등 노출
- CVE 목록/상세 진입
- 관련 게시글 링크 이동

우선순위:

- `중간`

## 권장 테스트 도구

### 1차

- Playwright E2E

이유:

- 역할별 로그인/세션 흐름 검증 가능
- 공개/비공개 페이지 이동 검증 가능
- 운영자 UI 버튼 노출/워크플로 검증 가능

### 2차

- 필요 시 컴포넌트 단위 테스트 추가

대상 후보:

- 상태 배지
- 요약 렌더러
- HomeFeed 필터 상태 계산

## 권장 작성 순서

1. 관리자 글 관리
2. 게시글 상세 / 댓글 / 요약
3. 로그인 / 프로필
4. 대시보드 / CVE 흐름

## 결론

프론트 자동화는 `관리자 글 관리`와 `게시글 상세/댓글/요약`부터 시작하는 것이 맞다.  
이 두 영역이 현재 정책 회귀와 운영 회귀를 가장 빠르게 잡아낼 수 있다.
