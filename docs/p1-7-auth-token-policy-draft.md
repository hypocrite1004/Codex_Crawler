# P1-7 프론트 인증/토큰 관리 정책 정리

## 안건 요약

현재 프론트는 JWT access/refresh 토큰을 `localStorage`에 저장하고, 여러 화면과 컴포넌트가 `localStorage`를 직접 읽어 로그인 상태를 판단한다.

이 구조는 동작은 단순하지만 아래 문제가 있다.

- 토큰 저장/조회 경로가 분산돼 있다.
- 세션 체크 기준이 화면마다 조금씩 다르다.
- `API_URL`이 코드에 하드코딩돼 배포 환경 전환에 취약하다.

이번 `P1-7`의 목표는 인증 구조를 전면 교체하는 것이 아니라, `현재 JWT + localStorage 구조를 유지하면서도 관리 지점을 한 곳으로 모으는 것`이다.

## 결정 사항

### 1. 토큰 저장 방식

- 현재 단계에서는 `localStorage` 유지
- 다만 직접 접근을 줄이고 공통 helper를 통해서만 다룸

판단 이유:

- 백엔드가 이미 JWT access/refresh 플로우로 맞춰져 있다.
- 이번 단계 목표는 인증 방식 교체가 아니라 운영 기준 정리다.
- httpOnly cookie 전환은 후속 대형 변경으로 분리하는 것이 안전하다.

### 2. 세션 판단 기준

- 로그인 여부는 `access_token` 단독이 아니라 `access_token || refresh_token` 기준으로 판단
- 단, 실제 인증 헤더는 여전히 `access_token`으로만 전송

### 3. API URL 관리

- `API_URL` 하드코딩을 유지하지 않고 `NEXT_PUBLIC_API_URL` 우선 사용
- 환경변수가 없으면 기존 로컬 기본값 `http://127.0.0.1:8000/api`로 fallback

## 구현 결과

### 공통 인증 helper 추가

- [frontend/src/lib/api.ts](/C:/project/Codex/Crawler/frontend/src/lib/api.ts)
  - `getStoredAccessToken()`
  - `getStoredRefreshToken()`
  - `hasClientSession()`
  - `storeAuthTokens()`

### API URL 환경변수화

- [frontend/src/lib/api.ts](/C:/project/Codex/Crawler/frontend/src/lib/api.ts)
  - `NEXT_PUBLIC_API_URL` 우선 사용
  - trailing slash 정규화
  - 미설정 시 기존 로컬 기본값 fallback

### 직접 localStorage 참조 축소

- [frontend/src/app/login/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/login/page.tsx)
- [frontend/src/app/register/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/register/page.tsx)
- [frontend/src/app/create-post/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/create-post/page.tsx)
- [frontend/src/app/profile/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/profile/page.tsx)
- [frontend/src/app/posts/[id]/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/posts/[id]/page.tsx)
- [frontend/src/components/ClientPostGuard.tsx](/C:/project/Codex/Crawler/frontend/src/components/ClientPostGuard.tsx)
- [frontend/src/components/Navbar.tsx](/C:/project/Codex/Crawler/frontend/src/components/Navbar.tsx)

이제 토큰 저장과 세션 체크는 공통 helper 기준으로 정렬된다.

## 검증 결과

아래 명령 기준으로 확인했다.

```powershell
npm run lint
npm run build
```

검증 결과:

- `npm run lint`: 통과
- `npm run build`: 통과

## 후속 메모

- `localStorage` 자체의 XSS 리스크는 남아 있다.
- 이를 줄이려면 장기적으로는 httpOnly cookie 기반 세션 구조 검토가 필요하다.
- 하지만 현재 단계에서는 `직접 참조 축소 + 환경변수화 + 세션 판단 일관화`까지를 완료 기준으로 본다.
