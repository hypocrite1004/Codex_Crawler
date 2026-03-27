# P0-2 공개/비공개 정책 초안

기준일: 2026-03-27  
상태: 확정

전제:
- P0-1에서 확정된 권한 정책을 기준으로 합니다.
- 이미 확정된 사항:
  - `published` 게시글 상세는 비로그인 사용자에게 공개합니다.
  - 운영 대시보드는 `staff/admin` 전용으로 둡니다.

## 1. 공개 정책 원칙

### 원칙 1. Public 정보와 운영 정보는 명확히 분리합니다
- public 영역은 누구나 읽을 수 있는 정보만 둡니다.
- 운영 영역은 로그인 여부가 아니라 `역할` 기준으로 접근을 제한합니다.

### 원칙 2. 게시글 공개 여부는 `status` 기준으로 판단합니다
- `published`: public
- `draft`, `review`, `rejected`, `archived`: private

### 원칙 3. 댓글은 게시글 공개 정책을 따라갑니다
- 댓글은 독립 public 리소스가 아닙니다.
- 댓글 공개 여부는 상위 게시글의 공개 상태를 따라야 합니다.

### 원칙 4. CVE는 public read 중심으로 유지합니다
- CVE 목록/상세/연관 게시글은 public 정보로 둡니다.
- 단, 연관 게시글은 `published` 게시글만 연결합니다.

### 원칙 5. 운영 화면은 URL이 아니라 역할로 보호합니다
- `/admin/*`, `/dashboard`, 크롤러 운영 화면, AI 설정 화면은 모두 운영 영역입니다.
- 운영 영역은 `staff/admin` 또는 `admin` 기준으로 나눕니다.

### 원칙 6. 프로필은 기본적으로 자기 정보만 공개합니다
- 현재 단계에서는 공개 프로필 개념을 두지 않습니다.
- 프로필은 인증 사용자 자신의 정보 관리 영역으로 둡니다.

## 2. 공개/비공개 매트릭스

### 2-1. 게시글

| 영역 | guest | user | author | staff | admin | 정책 |
|---|---|---|---|---|---|---|
| 게시글 목록(`published`) | 공개 | 공개 | 공개 | 공개 | 공개 | public |
| 게시글 상세(`published`) | 공개 | 공개 | 공개 | 공개 | 공개 | public |
| 비공개 게시글 목록 | 비공개 | 비공개 | 본인만 | 공개 | 공개 | private |
| 비공개 게시글 상세 | 비공개 | 비공개 | 본인만 | 공개 | 공개 | private |
| 관리자 게시글 목록 | 비공개 | 비공개 | 비공개 | 공개 | 공개 | 운영 |
| 검수/승인 메타데이터 | 비공개 | 비공개 | 본인 글 일부만 후속 결정 | 공개 | 공개 | 운영 |

정책 메모:
- `published`는 피드와 상세 모두 public으로 통일합니다.
- 비공개 게시글은 URL을 알아도 guest/user에게 노출되면 안 됩니다.

### 2-2. 댓글

| 영역 | guest | user | author | staff | admin | 정책 |
|---|---|---|---|---|---|---|
| `published` 게시글의 댓글 조회 | 공개 | 공개 | 공개 | 공개 | 공개 | public |
| 비공개 게시글의 댓글 조회 | 비공개 | 비공개 | 본인/운영자만 | 공개 | 공개 | private |
| 댓글 전역 목록 API | 비공개 | 비공개 | 비공개 | 축소 후 제한 공개 여부 검토 | 공개 | 운영/제한 |
| 댓글 작성 | 비공개 | 공개 | 공개 | 공개 | 공개 | authenticated |

정책 메모:
- 댓글은 public 게시글 상세 안에서만 public하게 보여주는 것이 기본안입니다.
- `/api/comments/` 전역 list는 public하지 않으며, 축소 방향이 맞습니다.

### 2-3. CVE

| 영역 | guest | user | author | staff | admin | 정책 |
|---|---|---|---|---|---|---|
| CVE 목록 | 공개 | 공개 | 공개 | 공개 | 공개 | public |
| CVE 상세 | 공개 | 공개 | 공개 | 공개 | 공개 | public |
| CVE 연관 게시글 | 공개 | 공개 | 공개 | 공개 | 공개 | public |
| CVE 운영 메모/추적 상태 | 비공개 | 비공개 | 비공개 | 후속 결정 | 공개 | 운영 |

정책 메모:
- CVE public 페이지는 유지하되, 운영 필드는 별도 분리합니다.
- 연관 게시글은 `published` 게시글만 보여야 합니다.

### 2-4. 대시보드

| 영역 | guest | user | author | staff | admin | 정책 |
|---|---|---|---|---|---|---|
| 운영 대시보드 | 비공개 | 비공개 | 비공개 | 공개 | 공개 | 운영 |
| 운영 통계 API | 비공개 | 비공개 | 비공개 | 공개 | 공개 | 운영 |

정책 메모:
- 현재 대시보드는 개인 기능이 아니라 운영 기능입니다.
- 일반 사용자용 대시보드는 후속 별도 제품 결정으로 분리합니다.

### 2-5. 프로필

| 영역 | guest | user | author | staff | admin | 정책 |
|---|---|---|---|---|---|---|
| 내 프로필 조회 | 비공개 | 공개 | 공개 | 공개 | 공개 | private/self |
| 내 프로필 수정 | 비공개 | 공개 | 공개 | 공개 | 공개 | private/self |
| 타 사용자 프로필 조회 | 비공개 | 비공개 | 비공개 | 후속 결정 | 공개 | 운영/후속 |

정책 메모:
- 현재 단계에서는 public author profile을 제공하지 않습니다.

### 2-6. 관리자/운영 화면

| 영역 | guest | user | author | staff | admin | 정책 |
|---|---|---|---|---|---|---|
| `/admin/posts` | 비공개 | 비공개 | 비공개 | 공개 | 공개 | 운영 |
| `/admin/crawler` | 비공개 | 비공개 | 비공개 | 비공개 | 공개 | 운영 |
| `/admin/ai` | 비공개 | 비공개 | 비공개 | 비공개 | 공개 | 운영 |
| crawler logs/runs/items | 비공개 | 비공개 | 비공개 | 조회 전용 여부 후속 결정 | 공개 | 운영 |

정책 메모:
- `admin/crawler`, `admin/ai`는 `admin` 전용이 맞습니다.
- `admin/posts`는 콘텐츠 운영이므로 `staff/admin`에 열 수 있습니다.

## 3. 현재 코드와 충돌하는 지점

### 3-1. `published` 상세는 정책상 public인데, 프론트는 로그인 가드를 강제합니다
- 백엔드는 `published` 게시글을 비로그인 사용자에게도 조회 가능하게 둡니다. [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py#L426)
- 프론트 상세 페이지는 `ClientPostGuard`로 감싸져 있어 비로그인 사용자를 로그인 페이지로 보냅니다. [frontend/src/app/posts/[id]/page.tsx](/C:/project/Codex/crawler/frontend/src/app/posts/[id]/page.tsx#L46) [frontend/src/components/ClientPostGuard.tsx](/C:/project/Codex/crawler/frontend/src/components/ClientPostGuard.tsx#L13)

### 3-2. 운영 대시보드는 정책상 `staff/admin` 전용인데, 현재는 모든 로그인 사용자에게 열려 있습니다
- 현재 API는 `IsAuthenticated`만 요구합니다. [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py#L1051)
- 프론트도 로그인 사용자에게 대시보드 링크를 보여줍니다. [frontend/src/components/Navbar.tsx](/C:/project/Codex/crawler/frontend/src/components/Navbar.tsx#L66)

### 3-3. 댓글은 게시글 공개 정책을 따라야 하는데, 현재는 전역 queryset으로 직접 노출됩니다
- `CommentViewSet`는 전체 댓글 queryset을 그대로 노출합니다. [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py#L270)
- 이 구조는 비공개 게시글 댓글이 우회 노출될 가능성을 남깁니다.

### 3-4. 운영 화면 경계가 정책과 완전히 맞지 않습니다
- 현재 `admin/crawler`, `admin/ai`는 Django `IsAdminUser` 기반이라 사실상 `is_staff`에게 열려 있습니다. [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py#L758) [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py#L905)
- 정책 초안은 `staff`와 `admin`을 분리하고, 민감 기능은 `admin` 전용으로 두는 방향입니다.

### 3-5. 프로필 공개 범위가 아직 제품적으로 정의되어 있지 않습니다
- 현재는 내 프로필 조회/수정만 명확하고, public author profile 개념은 없습니다. [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py#L258)
- 프론트도 프로필은 개인 화면 성격으로 구현돼 있습니다.

## 4. PM 권장안

### 지금 확정할 범위
- 게시글
  - `published` 목록/상세는 public
  - 비공개 상태 게시글은 private
- 댓글
  - `published` 게시글 하위 댓글만 public
  - 댓글 전역 API는 축소
- CVE
  - 목록/상세/연관 게시글은 public
  - 운영 필드는 private
- 대시보드
  - 운영 대시보드는 `staff/admin` 전용
- 프로필
  - 자기 프로필만 공개 범위 허용
- 관리자/운영 화면
  - `admin/posts`: `staff/admin`
  - `admin/crawler`, `admin/ai`: `admin`

### 지금 미루는 것
- public author profile
- 일반 사용자용 개인 대시보드
- staff용 크롤러 로그 read-only 화면 세부 범위
- CVE 운영 메타데이터 편집 정책

### 제품 관점 권장 이유
- 사용자 경험 측면:
  - public 콘텐츠는 로그인 장벽 없이 읽게 해야 확산성과 검색 유입이 유지됩니다.
- 운영 관점:
  - 운영 화면은 일반 사용자와 명확히 분리해야 데이터 노출과 혼선을 줄일 수 있습니다.
- 구현 관점:
  - 현재 코드 구조상 `status` 기준 공개/비공개 분리가 가장 단순하고 안전합니다.

## 5. 승인 필요 항목

1. 댓글 공개 범위를 `published` 게시글 하위에만 제한하는지
2. `/api/comments/` 전역 조회 API를 사실상 운영/제한 영역으로 줄이는지
3. `admin/posts`를 `staff/admin`에 열고, `admin/crawler`, `admin/ai`는 `admin` 전용으로 분리하는지
4. public author profile을 현재 단계에서 만들지 않고 보류하는지
5. 일반 사용자용 대시보드는 별도 제품 범위로 미루는지
6. 비공개 게시글 URL 직접 접근 시 guest/user에게는 404 또는 동등 수준으로 숨길지

현재 반영 상태:
- `1` 승인 완료: 댓글 공개 범위는 `published` 게시글 하위로 제한
- `2` 승인 완료: `/api/comments/` 전역 조회 API는 축소
- `3` 승인 완료: `admin/posts`는 `staff/admin`, `admin/crawler`, `admin/ai`는 `admin` 전용으로 분리
- `4` 승인 완료: public author profile은 현재 단계에서 보류
- `5` 승인 완료: 일반 사용자용 대시보드는 별도 제품 범위로 보류
- `6` 승인 완료: 비공개 게시글은 guest/user에게 404 또는 동등 수준으로 숨김

최종 승인 결과:
- `admin/posts`: `staff/admin`
- `admin/crawler`: `admin`
- `admin/ai`: `admin`
- public author profile: 보류

## 6. 다음 단계 제안

1. 위 승인 항목 확정
2. [project-todo.md](/C:/project/Codex/crawler/docs/project-todo.md)에서 `P0-2` 세부 항목 체크
3. 그 다음 `P1-1 대시보드 데이터 노출 범위 정리`로 연결
