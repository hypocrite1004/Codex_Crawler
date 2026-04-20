# P1-8 운영자 UI 권한 노출 기준 정리

## 안건 요약

현재 백엔드는 일부 운영 기능을 `staff`에게 허용하고 있지만, 프론트 UI는 여전히 작성자 기준으로만 버튼을 노출하는 곳이 있다.

대표적으로:

- 요약(summary) 생성/수정/삭제
- 댓글 수정/삭제

이번 `P1-8`의 목적은 `백엔드 실제 권한`과 `프론트 버튼 노출`을 일치시키고, 운영자 QA 관점에서 어떤 행동이 가능한지 기준을 문서화하는 것이다.

## 현재 상태

### 백엔드 권한

- [backend/api/views.py](/C:/project/Codex/Crawler/backend/api/views.py)
  - `summarize`: 작성자 또는 `staff`가 수정 가능
  - `CommentViewSet.perform_update`, `perform_destroy`: 작성자 또는 `staff`가 수정/삭제 가능

즉, 정책상 `staff`는 운영자 권한으로 요약과 댓글을 관리할 수 있다.

### 프론트 노출

- [frontend/src/components/PostSummary.tsx](/C:/project/Codex/Crawler/frontend/src/components/PostSummary.tsx)
  - 기존에는 작성자에게만 요약 생성/편집/삭제 버튼 노출

- [frontend/src/components/PostComments.tsx](/C:/project/Codex/Crawler/frontend/src/components/PostComments.tsx)
  - 기존에는 댓글 작성자에게만 편집/삭제 버튼 노출

즉, 프론트가 백엔드보다 더 좁게 막고 있었다.

## 결정 사항

### 1. `staff`는 요약을 운영할 수 있다

- 요약 생성
- 요약 편집
- 요약 삭제

### 2. `staff`는 댓글을 운영할 수 있다

- 댓글 편집
- 댓글 삭제

### 3. 작성자는 기존처럼 자기 리소스 관리 가능

- 작성자는 자기 글 요약 관리 가능
- 댓글 작성자는 자기 댓글 관리 가능

## 구현 결과

### 프론트 정렬

- [frontend/src/components/PostSummary.tsx](/C:/project/Codex/Crawler/frontend/src/components/PostSummary.tsx)
  - `canManageSummary = isAuthor || currentUser.is_staff`
  - `staff`도 요약 생성/편집/삭제 버튼 노출

- [frontend/src/components/PostComments.tsx](/C:/project/Codex/Crawler/frontend/src/components/PostComments.tsx)
  - 댓글 작성자 또는 `staff`일 때 편집/삭제 버튼 노출

### 백엔드 테스트 보강

- [backend/api/tests.py](/C:/project/Codex/Crawler/backend/api/tests.py)
  - `staff`가 다른 작성자의 글에 대해 요약 생성 가능함을 검증하는 테스트 추가

## 운영자 QA 기준

- `staff`로 로그인
- 공개 게시글 상세 진입
- 요약이 없는 글이면 `요약 생성` 버튼 확인
- 요약이 있는 글이면 `편집`, `삭제` 버튼 확인
- 타 사용자의 댓글에 대해서도 `Edit`, `Delete` 버튼 확인
- 실제 실행 시 백엔드 403 없이 동작해야 함

## 검증 결과

아래 명령 기준으로 확인했다.

```powershell
.\venv\Scripts\python.exe backend\manage.py test api.tests --keepdb
npm run lint
npm run build
```

검증 결과:

- `api.tests --keepdb`: 통과
- `npm run lint`: 통과
- `npm run build`: 통과

## PM 결론

`P1-8`은 새로운 운영 기능을 추가한 것이 아니라, 이미 허용된 운영 권한을 UI에 정확히 반영한 작업이다.  
즉, `staff`는 정책상 가능한 행동을 프론트에서도 일관되게 수행할 수 있게 되었다.
