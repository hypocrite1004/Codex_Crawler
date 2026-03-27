# P1-6 `/api/posts/` 응답 계약 표준화

## 안건 요약

현재 `/api/posts/` list endpoint는 조건에 따라 응답 모양이 달라진다.

- public list + `page/page_size` 없음: 배열 반환
- public list + `page/page_size` 있음: 페이지 객체 반환
- admin list: 페이지 객체 반환
- `mine=true`: 보통 배열로 소비

이 구조는 프론트에서 endpoint별 예외 처리를 늘리고, 새 화면을 붙일 때 회귀 가능성을 높인다.

## 현재 문제

### 백엔드

- [views.py](/C:/project/Codex/crawler/backend/api/views.py)의 `PostViewSet.list()`
  - public list는 `page`가 없으면 배열
  - public list는 `page`가 있으면 `{ count, next, previous, page, page_size, site_options, results }`
  - admin list는 항상 페이지 객체

### 프론트

- [api.ts](/C:/project/Codex/crawler/frontend/src/lib/api.ts)
  - `fetchPosts()`는 배열 기대
  - `fetchPostFeed()`는 페이지 객체 기대
  - `fetchMyPosts()`는 배열 기대

즉, 같은 `/api/posts/`를 두고도 호출마다 계약이 다르다.

## PM 권장안

### 1. 백엔드 list 응답은 항상 페이지 객체로 통일

권장 표준:

```json
{
  "count": 123,
  "next": null,
  "previous": null,
  "page": 1,
  "page_size": 24,
  "site_options": [],
  "results": []
}
```

이 형식을 public/admin/mine list 모두에 동일하게 적용한다.

### 2. `limit`는 제거보다 호환 모드로 흡수

기존 `limit` 사용 가능성 때문에 바로 제거하지 않고:

- `limit`가 오면 `page=1`
- `page_size=min(limit, 200)`처럼 해석

즉, 응답은 페이지 객체로 통일하되 query 호환성은 한 단계 남겨둔다.

### 3. 프론트 wrapper는 필요에 따라 변환 가능

- `fetchPostFeed()`와 `fetchAdminPosts()`는 페이지 객체 그대로 유지
- `fetchPosts()`와 `fetchMyPosts()`는 내부적으로 `results`만 꺼내 배열로 반환 가능

이렇게 하면 백엔드 계약은 단일화되고, 프론트 소비 코드는 큰 화면 변경 없이 유지할 수 있다.

### 4. `site_options`는 list 응답에 계속 포함

필터 UI가 이미 이것에 의존하므로 유지하는 편이 맞다.

## 승인 필요 항목

1. `/api/posts/` list 응답을 public/admin/mine 모두 `페이지 객체`로 통일할지  
권장안: `통일`

2. 기존 `limit` 파라미터는 제거하지 않고 `page_size` 호환 alias로 처리할지  
권장안: `그렇게 진행`

3. 프론트에서는 `fetchPosts()`와 `fetchMyPosts()`가 내부적으로만 `results`를 꺼내 배열 반환하도록 둘지  
권장안: `유지`

## PM 결론

이번 안건은 화면을 바꾸는 작업이 아니라,  
`같은 endpoint는 항상 같은 모양으로 응답한다`는 기준을 회복하는 작업이다.

권장 방향은:

- 백엔드: 항상 페이지 객체
- 프론트: 필요한 wrapper만 배열로 unwrap
- `limit`는 호환 alias로 유지

## 구현 결과

이번 단계에서는 `/api/posts/` list 응답을 백엔드에서 항상 페이지 객체로 통일하고, 프론트 wrapper는 필요한 경우만 `results`를 꺼내 배열로 반환하도록 정리했다.

### 백엔드

- [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)
  - `PostViewSet._list_response()` 공통 응답 helper 추가
  - public/admin list 모두 동일한 페이지 객체 형식으로 응답
  - `limit`는 제거하지 않고 `page_size` 호환 alias로 처리
  - `page`, `page_size`, `limit`가 없을 때도 배열 대신 페이지 객체 반환

### 프론트

- [frontend/src/lib/api.ts](/C:/project/Codex/crawler/frontend/src/lib/api.ts)
  - `fetchPostsListResponse()` helper 추가
  - `fetchPostFeed()`는 페이지 객체 그대로 사용
  - `fetchPosts()`는 `results`만 꺼내 배열 반환
  - `fetchMyPosts()`도 내부적으로 페이지 객체를 받은 뒤 `results`만 반환

### 테스트

- [backend/api/tests.py](/C:/project/Codex/crawler/backend/api/tests.py)
  - public list 기본 응답이 페이지 객체인지 검증
  - `mine=true` 응답이 페이지 객체인지 검증
  - `cve` 필터 응답이 페이지 객체인지 검증
  - `limit` alias가 페이지 객체 + `page_size`로 동작하는지 검증

## 검증 결과

아래 명령 기준으로 확인했다.

```powershell
.\venv\Scripts\python.exe backend\manage.py check
.\venv\Scripts\python.exe backend\manage.py test api.tests --keepdb
npm run lint
npm run build
```

검증 결과:

- `manage.py check`: 통과
- `manage.py test api.tests --keepdb`: 통과
- `npm run lint`: 통과
- `npm run build`: 통과
