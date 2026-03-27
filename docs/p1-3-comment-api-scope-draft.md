# P1-3 댓글 API 노출 범위 정리

## 안건 요약

`P0`에서 댓글의 공개 노출 범위를 크게 축소했다.  
이번 `P1-3`의 목적은 댓글을 게시글 하위 리소스로 해석하고, 전역 댓글 API는 공개 조회 기능이 아니라 `소유자/staff 관리용 endpoint`로 고정하는 것이다.

## 확정 정책

- 댓글 공개 읽기는 `published` 게시글 상세 하위에서만 허용
- `/api/comments/` 전역 list는 `staff/admin` 운영용으로만 유지
- `/api/comments/{id}/` 전역 retrieve/update/delete는 `소유자/staff` 관리 endpoint로 해석
- 댓글 생성은 계속 `/api/posts/{id}/add_comment/`를 사용

## 구현 판단

이번 단계에서는 구조를 뒤엎는 리팩터링보다 현재 동작을 정책 기준으로 명확히 고정하는 쪽이 적절했다.

- [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)의 `CommentViewSet`은 이미 아래 정책과 일치한다.
- `list()`: non-staff 요청은 `404`
- `get_queryset()`: `staff`는 전체 댓글, 일반 로그인 사용자는 자기 댓글만, guest는 빈 queryset
- `update/destroy`: 소유자 또는 `staff`만 허용
- 댓글 생성은 계속 게시글 하위 action `/api/posts/{id}/add_comment/`를 사용한다.

즉, 이번 `P1-3`은 대규모 API 변경보다 `현재 권한 모델을 테스트와 문서로 고정`하는 작업으로 처리했다.

## 구현 결과

### 백엔드 테스트 추가

[backend/api/tests.py](/C:/project/Codex/crawler/backend/api/tests.py)에 아래 정책 검증 테스트를 추가했다.

- guest는 `/api/comments/` 조회 시 `404`
- 일반 로그인 사용자는 `/api/comments/` 조회 시 `404`
- `staff`는 `/api/comments/` 조회 가능
- guest는 `/api/comments/{id}/` 조회 시 `404`
- 타 일반 사용자는 다른 사람 댓글 `/api/comments/{id}/` 조회 시 `404`
- 댓글 작성자 본인은 `/api/comments/{id}/` 조회 가능
- `staff`는 `/api/comments/{id}/` 조회 가능

## 검증 결과

아래 명령 기준으로 확인했다.

```powershell
.\venv\Scripts\python.exe backend\manage.py check
.\venv\Scripts\python.exe backend\manage.py test api.tests --keepdb
```

검증 결과:

- `manage.py check`: 통과
- `manage.py test api.tests --keepdb`: 통과

## PM 결론

`P1-3`은 별도 구조 변경 없이 현재 댓글 API를 `게시글 하위 공개 읽기 + 전역 관리 endpoint` 모델로 확정했다.  
다음 단계에서는 이 기준 위에서 후속 정책 항목을 계속 정리하면 된다.
