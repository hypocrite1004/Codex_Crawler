# Frontend Guide

## 개요

이 프론트엔드는 보안 인텔/콘텐츠 운영 플랫폼의 사용자 화면과 운영자 화면을 담당합니다.

주요 역할:

- 공개 게시글 피드와 상세 페이지
- 댓글과 AI 요약 UI
- 작성자 프로필 및 게시글 워크플로
- 운영자 대시보드
- 운영자 게시글 관리
- CVE 목록 및 상세 화면
- 관리자용 크롤러 / AI 설정 화면

## 주요 페이지

- `/`
  - 공개 홈 피드
- `/posts/[id]`
  - 게시글 상세, 댓글, AI 요약
- `/login`, `/register`
  - 인증
- `/profile`
  - 내 프로필, 내 게시글, 검토 요청/복원
- `/dashboard`
  - staff/admin 전용 대시보드
- `/admin/posts`
  - staff/admin 운영 게시글 관리
- `/admin/crawler`
  - admin 전용 크롤러 관리
- `/admin/ai`
  - admin 전용 AI 설정
- `/cves`
  - 공개 CVE 목록
- `/cves/[id]`
  - CVE 상세 및 관련 게시글

## 실행 방법

```powershell
cd frontend
npm install
npm run dev
```

기본 주소:

- [http://localhost:3000](http://localhost:3000)

## 빌드 및 점검

```powershell
npm run lint
npm run build
```

## API 연결

API URL은 [src/lib/api.ts](/C:/project/Codex/Crawler/frontend/src/lib/api.ts)에서 관리합니다.

우선순위:

1. `NEXT_PUBLIC_API_URL`
2. fallback: `http://127.0.0.1:8000/api`

예시:

```powershell
$env:NEXT_PUBLIC_API_URL="http://127.0.0.1:8000/api"
npm run dev
```

## 인증 구조

- JWT access/refresh 토큰 사용
- 토큰 저장은 현재 `localStorage` 기반
- 토큰 helper와 세션 체크는 [src/lib/api.ts](/C:/project/Codex/Crawler/frontend/src/lib/api.ts)에 모여 있음

관련 화면:

- [src/app/login/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/login/page.tsx)
- [src/app/register/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/register/page.tsx)
- [src/app/profile/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/profile/page.tsx)

## 권한 기준

- `guest`
  - 공개 게시글/CVE 조회 가능
- `author`
  - 게시글 작성, 댓글 작성, 자기 게시글 워크플로
- `staff`
  - 대시보드 접근, 운영 게시글 관리, 요약/댓글 운영 권한
- `admin`
  - `staff` 권한 포함
  - 크롤러/AI 설정 접근 가능

## 주요 컴포넌트

- [src/components/HomeFeed.tsx](/C:/project/Codex/Crawler/frontend/src/components/HomeFeed.tsx)
  - 홈 피드
- [src/components/PostComments.tsx](/C:/project/Codex/Crawler/frontend/src/components/PostComments.tsx)
  - 댓글 UI
- [src/components/PostSummary.tsx](/C:/project/Codex/Crawler/frontend/src/components/PostSummary.tsx)
  - AI 요약 UI
- [src/components/Navbar.tsx](/C:/project/Codex/Crawler/frontend/src/components/Navbar.tsx)
  - 전역 네비게이션

## 참고 문서

- [project-todo.md](/C:/project/Codex/Crawler/docs/project-todo.md)
- [local-development.md](/C:/project/Codex/Crawler/docs/local-development.md)
- [p1-10-core-qa-scenarios.md](/C:/project/Codex/Crawler/docs/p1-10-core-qa-scenarios.md)
- [p2-2-frontend-automation-test-scope.md](/C:/project/Codex/Crawler/docs/p2-2-frontend-automation-test-scope.md)
