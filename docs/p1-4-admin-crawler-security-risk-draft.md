# P1-4 관리자 크롤러 보안 리스크 정리

## 안건 요약

크롤러 관리 화면과 API는 이미 `admin` 전용으로 제한되어 있다.  
하지만 현재 구조에서는 `preview`와 `manual crawl`이 사용자가 입력한 `url`, `http_method`, `request_headers`, `request_body`를 거의 그대로 외부 요청으로 사용한다.

이 구조는 일반 사용자 노출 문제는 줄였지만, `관리자 계정 탈취` 또는 `운영 실수`가 발생하면 내부망 요청, 메타데이터 접근, 민감 헤더 전달 같은 SSRF 성격의 리스크로 이어질 수 있다.

## 현재 상태

### 접근 권한

- [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)의 `CrawlerSourceViewSet`은 `IsSuperUser`
- [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)의 `AIConfigView`, `AIModelsView`, `TestClusteringView`도 `IsSuperUser`
- [frontend/src/app/admin/crawler/page.tsx](/C:/project/Codex/crawler/frontend/src/app/admin/crawler/page.tsx)는 프론트에서도 `is_superuser`를 확인

즉, 접근 권한 자체는 현재 정책과 일치한다.

### 남아 있는 리스크

- `preview`가 임의 URL을 바로 요청할 수 있다.
- HTML 소스는 `POST`와 임의 `request_headers`, `request_body`를 허용한다.
- 저장된 source도 동일한 필드로 실제 수집 요청을 만든다.
- 현재 코드에는 `http/https` 외 스킴 차단, 내부망 IP 차단, 위험 헤더 차단이 보이지 않는다.

관련 위치:

- [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)
- [backend/api/crawler.py](/C:/project/Codex/crawler/backend/api/crawler.py)
- [backend/api/serializers.py](/C:/project/Codex/crawler/backend/api/serializers.py)

## PM 권장안

### 1. 접근 권한은 그대로 유지

- `admin/crawler`와 관련 API는 계속 `admin` 전용
- `staff`에게도 열지 않음

### 2. URL 정책을 추가

- `http`, `https`만 허용
- `file`, `ftp`, `gopher` 같은 비허용 스킴은 차단
- 직접 입력한 IP 또는 DNS 해석 결과가 아래 대역이면 차단
- `127.0.0.0/8`
- `10.0.0.0/8`
- `172.16.0.0/12`
- `192.168.0.0/16`
- `169.254.0.0/16`
- `::1/128`
- `fc00::/7`
- `fe80::/10`
- 클라우드 메타데이터 주소 같은 예약 대상

적용 위치는 `저장(create/update)`, `preview`, `manual crawl` 모두다.

### 3. 위험 헤더는 차단

아래 헤더는 사용자 입력으로 받지 않는 방향을 권장한다.

- `Host`
- `Authorization`
- `Cookie`
- `Proxy-*`
- `X-Forwarded-*`

이유는 외부 서비스 사칭, 내부 프록시 우회, 민감정보 전달 가능성을 줄이기 위해서다.

### 4. `POST`와 커스텀 body는 유지하되 검증 강화

일부 HTML 소스는 `POST`가 실제로 필요할 수 있으므로 기능 자체는 유지한다.  
대신 URL과 헤더 정책을 먼저 통과한 경우에만 허용하는 편이 현실적이다.

### 5. 오류 메시지는 API 응답에서 축소

- 사용자 응답: 일반화된 오류 메시지
- 서버 로그: 상세 원인 유지

현재는 preview/manual crawl 경로가 예외 문자열을 비교적 직접 돌려주는 구조라, 운영자 화면이라 해도 과도한 내부 정보 노출을 줄이는 편이 안전하다.

## 승인 필요 항목

1. 크롤러 관리 화면과 API를 계속 `admin` 전용으로 고정할지  
권장안: `고정`

2. `preview`, `source 저장`, `manual crawl` 전체에 `http/https` 전용 + 내부망/예약 IP 차단을 넣을지  
권장안: `적용`

3. `Host`, `Authorization`, `Cookie`, `Proxy-*`, `X-Forwarded-*` 헤더를 금지할지  
권장안: `금지`

4. `POST`와 `request_body` 기능은 유지하되 위 검증을 통과한 경우에만 허용할지  
권장안: `유지 + 검증 강화`

5. preview/manual crawl API의 상세 예외 문자열을 축소하고, 상세 원인은 로그에만 남길지  
권장안: `축소`

## PM 결론

이번 안건의 핵심은 `admin만 접근 가능하다`에서 끝나는 것이 아니라,  
`admin이더라도 서버를 임의 outbound proxy처럼 쓰지 못하게 제한한다`는 기준을 코드로 옮기는 것이다.

권장 방향은 `admin-only 유지 + URL/헤더 검증 추가 + 오류 메시지 축소`다.

## 구현 결과

이번 단계에서는 크롤러 보안 검증을 공통 모듈로 묶고, 저장/preview/manual crawl/runtime까지 같은 기준이 적용되도록 정리했다.

### 공통 검증 추가

- [backend/api/crawler_security.py](/C:/project/Codex/crawler/backend/api/crawler_security.py)
  - `http`, `https` 외 스킴 차단
  - `localhost`, 사설망, loopback, link-local, reserved 대역 차단
  - hostname DNS 해석 결과가 비공개 대역인 경우 차단
  - `Host`, `Authorization`, `Cookie`, `Proxy-*`, `X-Forwarded-*` 헤더 차단

### 저장 시점 검증

- [backend/api/serializers.py](/C:/project/Codex/crawler/backend/api/serializers.py)
  - `CrawlerSourceSerializer.validate()`에서 공통 검증 적용
  - 신규 source 생성과 기존 source 수정 모두 동일한 정책 적용

### 실행 시점 검증

- [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)
  - `/api/crawler-sources/preview/` 요청 전 검증
  - `/api/crawler-sources/{id}/crawl/` 요청 전 검증
  - preview/manual crawl 실패 시 API 응답은 `Preview failed.`, `Crawl failed.`로 축소

- [backend/api/crawler.py](/C:/project/Codex/crawler/backend/api/crawler.py)
  - `run_crawl()` 시작 전에 공통 검증 적용
  - 잘못된 source는 실제 outbound fetch 전에 차단

### 테스트 추가

- [backend/api/tests.py](/C:/project/Codex/crawler/backend/api/tests.py)
  - localhost/private IP source 생성 차단
  - 금지 헤더 차단
  - preview private target 차단
  - manual crawl invalid source 차단
  - runtime fetch 전 invalid source 차단
  - preview/manual crawl 내부 오류 메시지 마스킹

## 검증 결과

아래 명령 기준으로 확인했다.

```powershell
.\venv\Scripts\python.exe backend\manage.py check
.\venv\Scripts\python.exe backend\manage.py test api.tests --keepdb
```

검증 결과:

- `manage.py check`: 통과
- `manage.py test api.tests --keepdb`: 통과
