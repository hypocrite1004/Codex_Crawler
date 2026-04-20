# P3-6 인증 구조 고도화 검토

## 목적

현재 프론트는 JWT access/refresh 토큰을 `localStorage`에 저장한다.  
이번 문서는 `현재 방식 유지`와 `httpOnly cookie 전환`의 차이를 비교하고, 다음 결정 포인트를 정리한다.

## 현재 방식: JWT + localStorage

### 장점

- 구현 단순
- 현재 코드와 호환
- 프론트에서 토큰 상태 제어가 쉬움

### 단점

- XSS 발생 시 토큰 탈취 위험
- 브라우저 저장소에 장기 refresh token 노출
- 세션 보안이 프론트 코드 품질에 더 크게 의존

## 대안: httpOnly cookie

### 장점

- JS에서 토큰 직접 접근 불가
- XSS 시 토큰 탈취 위험 감소
- 브라우저 세션 모델과 더 자연스럽게 결합 가능

### 단점

- 백엔드 인증 처리 변경 필요
- CSRF 전략 추가 필요
- 현재 프론트 API wrapper와 인증 흐름을 전면 수정해야 함

## 영향 범위

전환 시 영향 받는 주요 파일:

- [frontend/src/lib/api/core.ts](/C:/project/Codex/Crawler/frontend/src/lib/api/core.ts)
- [frontend/src/lib/api/auth.ts](/C:/project/Codex/Crawler/frontend/src/lib/api/auth.ts)
- [frontend/src/app/login/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/login/page.tsx)
- [frontend/src/app/register/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/register/page.tsx)
- [backend/api/urls.py](/C:/project/Codex/Crawler/backend/api/urls.py)
- [backend/config/settings.py](/C:/project/Codex/Crawler/backend/config/settings.py)

## 현재 권장 판단

- 단기: 현재 JWT + localStorage 유지
- 중기: 운영 환경에서 XSS 방어 강화
- 장기: httpOnly cookie 전환을 별도 마이그레이션 과제로 분리

## 결론

지금 시점에서 cookie 전환은 가능하지만, `인증 구조 개편`에 해당하는 별도 프로젝트로 보는 것이 맞다.  
현재 백로그 기준으로는 localStorage 구조를 유지하되, 운영 하드닝과 회귀 테스트를 먼저 강화하는 쪽이 우선이다.
