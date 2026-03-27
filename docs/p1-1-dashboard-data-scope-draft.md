# P1-1 대시보드 데이터 노출 범위 정리

## 안건 요약

`P0`에서 대시보드 접근 권한은 `staff/admin`으로 제한했다.  
`P1-1`에서는 그 다음 단계로, 대시보드 안에서 어떤 데이터를 `staff`까지 볼 수 있고 어떤 데이터는 `admin` 전용이어야 하는지 정리한다.

## 현재 동작

현재 대시보드는 [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py) 의 `DashboardView`가 데이터를 만들고, [frontend/src/app/dashboard/page.tsx](/C:/project/Codex/crawler/frontend/src/app/dashboard/page.tsx) 가 그대로 렌더링한다.

현재 포함 데이터는 아래와 같다.

- 요약 카드
  - 전체 게시글 수
  - 기간 내 게시글 수
  - 직전 기간 대비 증감
  - 활성 소스 수
  - 전체 소스 수
  - 마지막 크롤링 시각
- 시계열/분포
  - 일별 추이
  - 카테고리 분포
  - 급상승 키워드
- 리스트/운영 보조
  - 최근 수집 게시글
  - Top CVEs
  - AI 유사도 버블 맵

## 현재 리스크

1. `staff`와 `admin`이 같은 대시보드를 본다.  
   운영 보조 지표와 시스템 운영 지표가 한 화면에 섞여 있다.

2. `Top CVEs`에 `legacy_mention_count`가 포함된다.  
   이 값은 공개 CVE 응답에서는 숨긴 운영성 지표와 결이 비슷해서, 대시보드에서도 재검토가 필요하다.

3. `최근 수집 게시글`이 외부 `source_url`까지 바로 노출한다.  
   staff에게 허용할지, 아니면 내부 게시글 링크 중심으로 줄일지 결정이 필요하다.

4. `AI 유사도 버블 맵`은 임베딩 기반 내부 분석 화면에 가깝다.  
   콘텐츠 운영자에게 꼭 필요한지, `admin` 전용으로 둘지 판단이 필요하다.

## PM 권장안

### 기본 원칙

- `staff` 대시보드: 콘텐츠 운영과 검수에 필요한 지표만 노출
- `admin` 대시보드: 위 지표 + 시스템 운영 보조 지표 노출

### 권장 범위

#### `staff`에게 허용

- 전체 게시글 수
- 기간 내 게시글 수
- 직전 기간 대비 증감
- 일별 추이
- 카테고리 분포
- 급상승 키워드
- 최근 수집 게시글
- Top CVEs
- 마지막 크롤링 시각

#### `admin` 전용

- 활성 소스 수 / 전체 소스 수
- AI 유사도 버블 맵

### 필드 단위 권장안

#### 최근 수집 게시글

`staff`에게는 아래만 노출 권장:

- 내부 게시글 `id`
- `title`
- `category`
- `created_at`
- `related_count`

`source_url`은 `admin` 전용 또는 대시보드에서 제거 권장.

이유:
- 운영자에게 최근 게시글 맥락은 필요하지만, 대시보드에서 바로 외부 원문 링크까지 노출할 필요성은 낮다.
- 외부 링크는 게시글 상세/관리 화면으로 한 단계 들어가서 보는 쪽이 통제가 쉽다.

#### Top CVEs

`staff` 대시보드에서는 아래만 유지 권장:

- `cve_id`
- `severity`
- `cvss_score`
- `mention_count`
- `post_count`
- `last_seen`

`legacy_mention_count`는 제거 권장.

이유:
- 공개 API에서도 감춘 운영성 보조 지표와 결이 겹친다.
- staff 운영에 실질적으로 필요한 우선순위 판단은 `mention_count`, `post_count`, `severity`, `last_seen` 정도면 충분하다.

#### 마지막 크롤링 시각

`staff`에게 유지 권장.

이유:
- “지금 피드가 살아 있는지”를 보는 최소 운영 신호다.
- 소스별 상세 현황은 이미 `admin/crawler`가 담당하므로, 대시보드에는 요약 수준만 두는 게 맞다.

## 승인 필요 항목

1. `staff` 대시보드에서 `source_url`을 제거할지
   - 권장안: 제거

2. `Top CVEs`에서 `legacy_mention_count`를 제거할지
   - 권장안: 제거

3. `AI 유사도 버블 맵`을 `admin` 전용으로 돌릴지
   - 권장안: `admin` 전용

4. `활성 소스 수 / 전체 소스 수`를 `admin` 전용으로 돌릴지
   - 권장안: `admin` 전용

5. `마지막 크롤링 시각`은 `staff`에게 유지할지
   - 권장안: 유지

## 승인 후 구현 범위

- [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)
  - `DashboardView` 응답을 역할별로 분기
- [frontend/src/lib/api.ts](/C:/project/Codex/crawler/frontend/src/lib/api.ts)
  - 대시보드 타입 정렬
- [frontend/src/app/dashboard/page.tsx](/C:/project/Codex/crawler/frontend/src/app/dashboard/page.tsx)
  - 역할별 카드/섹션 노출 정렬

## PM 결론

`P1-1`의 목표는 “대시보드를 더 열어주는 것”이 아니라, 이미 열린 운영 화면의 데이터 범위를 역할 기준으로 재정렬하는 것이다.  
권장 방향은 `staff = 콘텐츠 운영`, `admin = 시스템 운영` 원칙을 대시보드에도 그대로 적용하는 것이다.

## 2026-03-27 구현 결과

- [x] `source_url` 제거
- [x] `Top CVEs.legacy_mention_count` 제거
- [x] `AI 유사도 버블 맵`을 `admin` 전용으로 제한
- [x] `활성 소스 수 / 전체 소스 수`를 `admin` 전용으로 제한
- [x] `마지막 크롤링 시각`은 `staff`에게 유지

### 반영 위치

- 백엔드: [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py)
- 프론트 타입: [frontend/src/lib/api.ts](/C:/project/Codex/crawler/frontend/src/lib/api.ts)
- 프론트 화면: [frontend/src/app/dashboard/page.tsx](/C:/project/Codex/crawler/frontend/src/app/dashboard/page.tsx)

### 검증 결과

- [x] `python backend/manage.py check`
- [x] `npm run lint`
- [x] `npm run build`
- [x] dashboard API smoke
  - `staff`: `active_sources`, `total_sources`, `bubble_data`, `source_url`, `legacy_mention_count` 비노출 확인
  - `admin`: `active_sources`, `total_sources` 노출 확인

### 메모

- `admin` 응답의 `bubble_data`는 현재 기간 내 임베딩 데이터가 없으면 빈 배열일 수 있다.
- 최근 수집 게시글 카드는 외부 원문 링크 대신 내부 게시글 상세 링크로 정렬했다.
