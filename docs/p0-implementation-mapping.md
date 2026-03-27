# P0 정책-구현 매핑

이 문서는 `P0-1`, `P0-2`에서 확정한 정책이 `P0-3` 코드 반영에 어떻게 연결되는지 추적하기 위한 기준 문서다.

## 해석 기준

- `P0-1`: 권한 정책 확정
- `P0-2`: 공개/비공개 정책 확정
- `P0-3`: 위 정책의 실제 코드 반영
- `P0-4`: 반영 결과 검증

즉, `P0-1`, `P0-2`의 구현은 별도 미착수 상태가 아니라 `P0-3`에서 수행된 것으로 본다.

## P0-1 권한 정책표 작성 -> P0-3 구현 반영

- [x] `published` 게시글 상세를 비로그인 사용자에게 공개
  - 백엔드: [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)
  - 프론트: [frontend/src/app/posts/[id]/page.tsx](/C:/project/Codex/crawler/frontend/src/app/posts/[id]/page.tsx)

- [x] 운영 대시보드를 `staff/admin` 전용으로 제한
  - 백엔드: [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)
  - 프론트: [frontend/src/app/dashboard/page.tsx](/C:/project/Codex/crawler/frontend/src/app/dashboard/page.tsx)
  - 보조 UI: [frontend/src/components/Navbar.tsx](/C:/project/Codex/crawler/frontend/src/components/Navbar.tsx)

- [x] `staff`와 `admin`을 실제 코드에서도 분리
  - 백엔드: [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py), [backend/api/serializers.py](/C:/project/Codex/crawler/backend/api/serializers.py)
  - 프론트: [frontend/src/lib/api.ts](/C:/project/Codex/crawler/frontend/src/lib/api.ts), [frontend/src/app/admin/posts/page.tsx](/C:/project/Codex/crawler/frontend/src/app/admin/posts/page.tsx), [frontend/src/app/admin/ai/page.tsx](/C:/project/Codex/crawler/frontend/src/app/admin/ai/page.tsx), [frontend/src/app/admin/crawler/page.tsx](/C:/project/Codex/crawler/frontend/src/app/admin/crawler/page.tsx)

- [x] 댓글 전역 API를 축소
  - 백엔드: [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)

- [x] 게시글 삭제를 `admin` 전용으로 제한
  - 백엔드: [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)
  - 프론트: [frontend/src/app/admin/posts/page.tsx](/C:/project/Codex/crawler/frontend/src/app/admin/posts/page.tsx)

- [x] 크롤러 `preview/manual crawl`을 `admin` 전용으로 제한
  - 백엔드: [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)
  - 프론트: [frontend/src/app/admin/crawler/page.tsx](/C:/project/Codex/crawler/frontend/src/app/admin/crawler/page.tsx)

## P0-2 공개/비공개 정책 확정 -> P0-3 구현 반영

- [x] `published` 게시글 목록/상세를 공개
  - 백엔드: [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)
  - 프론트: [frontend/src/app/posts/[id]/page.tsx](/C:/project/Codex/crawler/frontend/src/app/posts/[id]/page.tsx)

- [x] 비공개 게시글 URL 직접 접근 시 guest/user에게 `404` 또는 동등 수준으로 숨김
  - 백엔드: [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)
  - 프론트: [frontend/src/app/posts/[id]/page.tsx](/C:/project/Codex/crawler/frontend/src/app/posts/[id]/page.tsx)

- [x] 댓글 공개 범위를 `published` 게시글 하위로 제한
  - 백엔드: [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)
  - 프론트: [frontend/src/components/PostComments.tsx](/C:/project/Codex/crawler/frontend/src/components/PostComments.tsx)

- [x] `/api/comments/` 전역 조회 API를 운영/제한 영역으로 축소
  - 백엔드: [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)

- [x] `admin/posts`는 `staff/admin`, `admin/crawler`, `admin/ai`는 `admin` 전용으로 분리
  - 백엔드: [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)
  - 프론트: [frontend/src/app/admin/posts/page.tsx](/C:/project/Codex/crawler/frontend/src/app/admin/posts/page.tsx), [frontend/src/app/admin/crawler/page.tsx](/C:/project/Codex/crawler/frontend/src/app/admin/crawler/page.tsx), [frontend/src/app/admin/ai/page.tsx](/C:/project/Codex/crawler/frontend/src/app/admin/ai/page.tsx)

- [x] public author profile은 보류
  - 구현 상태: 신규 공개 작성자 프로필 라우트 추가 없음

- [x] 일반 사용자용 대시보드는 보류
  - 구현 상태: [frontend/src/app/dashboard/page.tsx](/C:/project/Codex/crawler/frontend/src/app/dashboard/page.tsx)는 `staff/admin` 전용으로 유지

- [x] 공개 CVE 응답에서 운영 필드를 제외
  - 백엔드: [backend/api/serializers.py](/C:/project/Codex/crawler/backend/api/serializers.py), [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)

## 남은 작업

- [ ] `P0-4` 검증에서 정책 반영 결과를 수동 QA로 확인
- [x] `venv` 기준 `python manage.py check` 통과
- [x] DRF router 차단 이슈 수정
  - 수정 위치: [backend/api/urls.py](/C:/project/Codex/crawler/backend/api/urls.py)
  - 내용: `CommentViewSet` 등록에 `basename='comment'` 명시
- [ ] PostgreSQL `127.0.0.1:5433` 실행 상태 확인 및 테스트 DB 연결 복구
- [ ] 관리자 사이드바 링크 노출과 CVE 상세의 운영 필드 잔여 노출 여부를 추가 확인

## 2026-03-27 P0-4 검증 업데이트

- [x] 로컬 PostgreSQL `127.0.0.1:5433` 복구 및 연결 확인
- [x] `venv` 기준 `python backend/manage.py check` 통과
- [x] `venv` 기준 `python backend/manage.py test api.tests --keepdb` 통과
- [x] `frontend` 기준 `npm run lint` 통과
- [x] `frontend` 기준 `npm run build` 통과

### API smoke 결과

- [x] guest가 `published` 게시글 상세를 조회하면 `200`
- [x] guest가 비공개 게시글 상세를 조회하면 `404`
- [x] guest가 `/api/comments/` 전역 조회를 시도하면 `404`
- [x] 공개 CVE 응답에서 `notes`, `is_tracked`, `legacy_mention_count` 미노출 확인
- [x] `staff`는 `/api/dashboard/`, `admin/posts` 접근 가능
- [x] `staff`는 `/api/ai-config/`, `/api/crawler-sources/` 접근 불가(`403`)
- [x] `admin`은 `/api/ai-config/`, `/api/crawler-sources/` 접근 가능

### 브라우저 QA 결과

- [x] guest가 공개 게시글 상세 페이지를 실제로 열 수 있음
- [x] guest는 댓글 입력창 대신 로그인 유도 문구를 봄
- [x] `staff`는 `/admin/posts` 접근 가능
- [x] `staff`가 `/admin/crawler`로 이동하면 홈으로 우회되어 관리자 전용 화면에 남지 않음
- [x] `admin`은 `/admin/crawler` 접근 가능

### 검증 중 수정한 회귀

- [x] [frontend/src/lib/api.ts](/C:/project/Codex/crawler/frontend/src/lib/api.ts)
  - guest의 `fetchProfile()` 401 응답이 `/login?expired=1` 강제 이동으로 이어지던 문제 수정
  - 토큰이 전혀 없는 비로그인 상태는 단순 401 처리로 남기고 강제 로그아웃하지 않도록 수정
- [x] [frontend/src/app/admin/layout.tsx](/C:/project/Codex/crawler/frontend/src/app/admin/layout.tsx)
  - `staff`에게 `admin/crawler`, `admin/ai` 사이드바 링크가 보이던 노출 문제 수정

### 상태 결론

- [x] `P0-4` 정책 반영 검증 완료
- [x] `P0` 단계 완료
- [ ] 다음 단계: `P1` 착수

### 참고

- 로컬 QA용 계정과 데이터는 검증을 위해 생성함
  - `qa_author`
  - `qa_staff`
  - `qa_admin`
- 개발 환경에서 JWT 서명 키 길이 경고가 출력되지만, 이는 현재 로컬 `SECRET_KEY=change-me` 설정에 따른 경고로 `P0` 차단 이슈로 보지는 않음
