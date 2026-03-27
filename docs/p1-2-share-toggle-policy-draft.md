# P1-2 공유 토글 권한 정리

## 안건 요약

`P0`에서 `published` 게시글은 이미 공개로 정리됐다.  
따라서 `is_shared`는 더 이상 공개/비공개를 결정하는 권한이 아니라, 운영상 별도 표시를 위한 플래그로 해석하는 게 맞다.

이번 안건의 목적은 아래 두 가지다.

- `is_shared`의 의미를 정책적으로 확정
- 누가 이 값을 바꿀 수 있는지 정리

## 현재 동작

### 백엔드

[backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py) 의 `toggle_share`는 현재 아래 조건으로 동작한다.

- 작성자 본인: 가능
- `staff/admin`: 가능
- 그 외: 불가

즉 현재는 `author + staff/admin` 구조다.

### 프론트

[frontend/src/components/PostSidebar.tsx](/C:/project/Codex/crawler/frontend/src/components/PostSidebar.tsx) 에서 공유 버튼이 게시글 상세 사이드바에 항상 렌더링된다.  
실제 API 호출은 로그인 필요라서, 비로그인 사용자는 버튼을 눌러도 실패한다.

또 [frontend/src/components/HomeFeed.tsx](/C:/project/Codex/crawler/frontend/src/components/HomeFeed.tsx) 에서 `is_shared=true` 필터를 통해 “공유 글만” 볼 수 있다.

## 현재 리스크

1. `is_shared`의 의미가 불분명하다.  
   지금 정책에선 `published`만으로 공개 여부가 결정되는데, UI에서는 여전히 `share`가 공개와 비슷한 뉘앙스로 보일 수 있다.

2. 작성자가 자기 글을 직접 `shared`로 올릴 수 있다.  
   이 값이 피드 필터나 운영상 큐레이션에 쓰인다면, 작성자 자기결정과 운영자 큐레이션이 섞이게 된다.

3. guest/user에게도 공유 버튼이 보인다.  
   실제 권한과 버튼 노출이 어긋난다.

## PM 권장안

### 기본 해석

`is_shared`는 더 이상 공개 여부가 아니라 `운영 큐레이션 플래그`로 본다.

즉:

- `published`: 공개 여부
- `is_shared`: 운영자가 “공유 가치가 높다”고 표시한 상태

### 권한 권장안

- `staff/admin`: 토글 가능
- `author`: 토글 불가
- `guest/user`: 토글 불가

이유:

- 공개 여부는 이미 `published`가 담당한다.
- `share`는 운영 큐레이션/추천에 가까운 값이라서 작성자 자기선언보다는 운영자 판단이 맞다.
- `staff`는 콘텐츠 운영 역할이므로 권한을 갖는 것이 자연스럽다.

### UI 권장안

- 공유 버튼은 `staff/admin`에게만 노출
- 일반 작성자와 guest/user에게는 버튼 비노출
- 상태 배지(`Shared`)는 계속 표시 가능

### 필터 권장안

홈 피드의 `공유 글만` 필터는 유지 권장.

다만 의미는 아래처럼 해석한다.

- 공개 글 중에서
- 운영자가 별도 큐레이션한 글만 보기

## 승인 필요 항목

1. `is_shared`를 `공개 여부`가 아니라 `운영 큐레이션 플래그`로 고정할지
   - 권장안: 고정

2. 공유 토글 권한을 `staff/admin` 전용으로 바꿀지
   - 권장안: 변경

3. 일반 작성자에게 공유 버튼을 숨길지
   - 권장안: 숨김

4. guest/user에게 공유 버튼을 숨길지
   - 권장안: 숨김

5. 홈 피드의 `공유 글만` 필터는 유지할지
   - 권장안: 유지

## 승인 후 구현 범위

- [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)
  - `toggle_share` 권한을 `staff/admin` 전용으로 정리
- [frontend/src/components/PostSidebar.tsx](/C:/project/Codex/crawler/frontend/src/components/PostSidebar.tsx)
  - 공유 버튼 노출 조건 정리
- 필요 시 [frontend/src/lib/api.ts](/C:/project/Codex/crawler/frontend/src/lib/api.ts)
  - 권한 실패 메시지 정리

## PM 결론

`P1-2`의 핵심은 “share를 누가 누를 수 있느냐”보다 “share가 무슨 뜻이냐”를 먼저 닫는 것이다.  
권장 방향은 `share = 운영 큐레이션`, `publish = 공개 상태`로 역할을 분리하는 것이다.

## 2026-03-27 구현 결과

- [x] `is_shared`를 운영 큐레이션 플래그로 유지
- [x] 공유 토글 권한을 `staff/admin` 전용으로 변경
- [x] 일반 작성자 및 guest/user에게 공유 버튼 비노출
- [x] 홈 피드의 `공유 글만` 필터 유지

### 반영 위치

- 백엔드: [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)
- 백엔드 테스트: [backend/api/tests.py](/C:/project/Codex/crawler/backend/api/tests.py)
- 프론트 UI: [frontend/src/components/PostSidebar.tsx](/C:/project/Codex/crawler/frontend/src/components/PostSidebar.tsx)

### 구현 메모

- `toggle_share`는 이제 작성자 본인이라도 직접 실행할 수 없다.
- 공유 버튼은 로그인 사용자 중 `is_staff=true`일 때만 보인다.
- 버튼 문구는 공개/비공개 의미를 피하기 위해 `Curated / Mark as Curated`로 정리했다.

### 검증 결과

- [x] `python backend/manage.py check`
- [x] `python backend/manage.py test api.tests --keepdb`
- [x] `npm run lint`
- [x] `npm run build`
- [x] 백엔드 테스트에 `작성자 403 / staff 200` 케이스 추가
