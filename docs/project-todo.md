# 프로젝트 Todo Task

기준일: 2026-03-27

## 목적
- 현재 프로젝트의 분석 결과를 실행 가능한 Todo Task로 관리합니다.
- 이후 작업은 이 문서를 기준으로 진행 상태를 갱신하는 방식으로 운영합니다.

## 운영 규칙
- 새 작업을 시작하기 전에 관련 Task 상태를 먼저 갱신합니다.
- 작업 완료 후에는 결과와 남은 이슈를 같은 문서에 반영합니다.
- 큰 항목이 완료되면 문서화와 커밋을 함께 진행합니다.
- 큰 항목 완료 후에는 현재 진행 현황을 사용자에게 보고합니다.
- PM 역할은 기본적으로 `product-manager` 에이전트가 담당합니다.
- 문서화 역할은 기본적으로 `documentation-engineer` 에이전트가 담당합니다.
- 새 안건은 `product-manager`가 먼저 정리하고, 필요한 전문 에이전트 의견을 수집한 뒤 종합 보고합니다.
- 안건 승인 또는 상태 변경이 발생하면 `documentation-engineer`가 이 문서를 갱신합니다.
- 상태 표기는 아래 기준을 사용합니다.
  - `[ ]` 미착수
  - `[-]` 진행 중
  - `[x]` 완료
  - `[!]` 차단됨
- 우선순위는 `P0 > P1 > P2` 순서로 처리합니다.

## 에이전트 운영 기준
- 메인 PM: `product-manager`
- 문서 담당: `documentation-engineer`
- P0 단계 기본 참여 후보:
  - `architect-reviewer`
  - `security-auditor`
  - `reviewer`
  - `qa-expert`
- 상시 보조 후보:
  - `documentation-engineer`
- 필요 시 추가:
  - 요구사항 정제가 부족하면 `business-analyst`
  - 일정/의존성 관리가 필요하면 `project-manager`
  - 대외 공유용 보고서가 필요하면 `technical-writer`

## 기본 팀 구성
- `product-manager`
  - 안건 정리, 회의 진행, 쟁점 도출, 권장안 제시, 최종 보고
- `documentation-engineer`
  - 기준 문서 갱신, 상태 반영, 결정사항 기록, 다음 액션 정리
- `architect-reviewer`
  - 구조 적합성, 경계 설정, 장기 유지보수성 검토
- `security-auditor`
  - 권한, 데이터 노출, 인증/인가, 운영 보안 리스크 검토
- `reviewer`
  - 코드 기준의 구현 리스크, 회귀 위험, 정책-구현 불일치 검토
- `qa-expert`
  - QA 시나리오, 테스트 공백, 검증 기준선 정리

운영 원칙:
- 기본적으로 위 팀 구성을 유지합니다.
- 안건별로 필요한 전문 에이전트만 추가합니다.
- 현재 단계에서는 `P0-1 권한 정책표 작성`을 첫 번째 작업으로 진행합니다.

## 문서화 운영 방식
- 기준 문서는 [project-todo.md](/C:/project/Codex/crawler/docs/project-todo.md) 하나로 유지합니다.
- PM이 안건을 종합하면, 승인 여부와 관계없이 현재 판단 내용을 문서에 반영합니다.
- 상태 변경 시 아래 항목을 함께 갱신합니다.
  - Task 상태
  - 결정 사항
  - 차단 사유
  - 다음 액션
  - 작업 로그
- 구현 전 단계에서는 설계/정책/리스크 중심으로 기록하고, 구현 단계부터는 결과와 검증 내역도 함께 남깁니다.

## 현재 기준선
- [x] 백엔드 정적 설정 점검: `manage.py check` 통과
- [x] 프론트 정적 점검: `npm run lint` 통과
- [x] 프론트 빌드 점검: `npm run build` 통과
- [x] 백엔드 테스트 실행: `python backend/manage.py test api.tests --keepdb` 통과

## P0. 정책/권한 기준선 확정 및 반영

### P0 완료 기준
- `P0-1 정책` 완료
- `P0-2 공개/비공개 정책` 완료
- `P0-3 정책 반영 구현` 완료
- `P0-4 정책 반영 검증` 완료
- 위 4개가 모두 끝나기 전에는 `P1` 구현 작업으로 넘어가지 않습니다.

### P0-1. 권한 정책표 작성
- [x] `guest / user / author / staff / admin` 권한 매트릭스 작성
- [x] 게시글 조회/수정/삭제/공유 권한 정의
- [x] 댓글 조회/작성/수정/삭제 권한 정의
- [x] 대시보드 조회 권한 정의
- [x] 크롤러/AI 설정/CVE 운영 권한 정의

진행 메모:
- 권한 정책표 문서 확정
- 초안 문서: [p0-1-access-policy-draft.md](/C:/project/Codex/crawler/docs/p0-1-access-policy-draft.md)
- 2026-03-27 승인 반영:
  - `published` 게시글 상세: 비로그인 공개
  - 운영 대시보드: `staff/admin` 전용
  - `staff`와 `admin`: 실제 코드에서도 분리
  - 댓글 전역 API: 축소
  - 게시글 삭제: `admin` 전용
  - 크롤러 `preview/manual crawl`: `admin` 전용

완료 기준:
- 팀이 합의한 권한 정책표가 문서화되어 있어야 함
- 이후 구현/QA가 이 정책표를 기준으로 판단 가능해야 함

### P0-2. 공개/비공개 정책 확정
- [x] `published` 게시글의 비로그인 공개 여부 결정
- [x] 게시글 상세 페이지 접근 정책 결정
- [x] 공개 피드와 상세 페이지 동작 규칙 정리
- [x] 운영자 전용 화면과 일반 사용자 화면 경계 정리

진행 메모:
- 공개/비공개 정책 문서 확정
- 정책 문서: [p0-2-public-visibility-policy-draft.md](/C:/project/Codex/crawler/docs/p0-2-public-visibility-policy-draft.md)
- 확정 반영:
  - `published` 게시글 상세: 비로그인 공개
  - 운영 대시보드: `staff/admin` 전용
  - 댓글 공개 범위: `published` 게시글 하위로 제한
  - `/api/comments/` 전역 조회 API: 축소
  - `admin/posts`: `staff/admin`
  - `admin/crawler`, `admin/ai`: `admin` 전용
  - public author profile: 보류
  - 일반 사용자용 대시보드: 별도 제품 범위로 보류
  - 비공개 게시글 URL 직접 접근: guest/user에게 404 또는 동등 수준으로 숨김

완료 기준:
- 프론트와 백엔드가 같은 공개 정책을 따르도록 기준이 정리되어 있어야 함

### P0-3. 정책 반영 구현
- [x] 대시보드를 `staff/admin` 전용으로 제한
- [x] `published` 게시글 상세를 비로그인 공개 정책에 맞게 프론트/백엔드 정렬
- [x] 비공개 게시글 URL 직접 접근 시 guest/user에게 `404` 또는 동등 수준으로 숨김
- [x] 댓글 전역 조회 API 축소
- [x] 댓글 조회 범위를 `published` 게시글 하위로 제한
- [x] `admin/posts`는 `staff/admin`, `admin/crawler`와 `admin/ai`는 `admin` 전용으로 분리
- [x] 게시글 삭제를 `admin` 전용으로 제한
- [x] 크롤러 `preview/manual crawl`을 `admin` 전용으로 제한
- [x] CVE 운영 필드(`notes`, `is_tracked`, `legacy_mention_count`) 비공개 처리
- [x] public author profile은 미구현 상태로 유지
- [x] 일반 사용자용 대시보드는 미구현 상태로 유지

관련 문서:
- [p0-1-access-policy-draft.md](/C:/project/Codex/crawler/docs/p0-1-access-policy-draft.md)
- [p0-2-public-visibility-policy-draft.md](/C:/project/Codex/crawler/docs/p0-2-public-visibility-policy-draft.md)

완료 기준:
- 확정된 P0 정책이 실제 코드에 반영되어 있어야 함
- 주요 공개/비공개 경계가 코드 기준으로 일치해야 함

### P0-4. 정책 반영 검증
- [x] 비로그인 사용자의 `published` 게시글 목록/상세 접근 검증
- [x] 비공개 게시글의 URL 직접 접근 차단 검증
- [x] 대시보드의 `staff/admin` 제한 검증
- [x] 댓글 공개 범위와 전역 API 축소 검증
- [x] `admin/posts` / `admin/crawler` / `admin/ai` 권한 분리 검증
- [x] CVE 공개 필드와 운영 필드 분리 검증
- [x] 최소 회귀 테스트 또는 수동 QA 체크리스트 반영
- [x] 백엔드 테스트 실행 환경 복구
  - 상태: 해결
  - 확인 내용: 로컬 PostgreSQL 실행 및 `python backend/manage.py test api.tests --keepdb` 통과

완료 기준:
- 정책 반영 후 핵심 흐름 검증 결과가 남아 있어야 함
- P0 종료 시점에 최소 검증 기록이 문서화되어 있어야 함

## P1. 즉시 수정 후보 정리

P1 시작 조건:
- `P0-3 정책 반영 구현` 완료
- `P0-4 정책 반영 검증` 완료
- P0 종료 판단이 문서에 기록됨

### P1-1. 대시보드 데이터 노출 범위 정리
- [x] 일반 로그인 사용자가 대시보드에 접근 가능한지 정책 확정
- [x] 대시보드 집계 대상이 `전체 글`인지 `published + 본인 글`인지 결정
- [x] 최근 글/크롤러 통계/CVE 통계 노출 범위 정의

관련 위치:
- [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py#L1051)
- [frontend/src/components/Navbar.tsx](/C:/project/Codex/crawler/frontend/src/components/Navbar.tsx#L66)

### P1-2. 공유 토글 권한 정리
- [x] `toggle_share`를 작성자 또는 관리자만 수행 가능하도록 정책 확정
- [x] 프론트에서 공유 버튼 노출 대상을 정의
- [x] 관련 테스트 필요 여부 정리

관련 위치:
- [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py#L650)

### P1-3. 댓글 API 노출 범위 정리
- [x] `/api/comments/` 직접 노출 유지 여부 결정
- [x] 댓글 queryset을 게시글 공개 정책과 연동할지 결정
- [x] 댓글 조회를 게시글 상세 하위 경로 중심으로 제한할지 검토

관련 위치:
- [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py#L270)
- [backend/api/serializers.py](/C:/project/Codex/crawler/backend/api/serializers.py#L50)

### P1-4. 관리자 크롤러 보안 리스크 정리
- [x] preview/manual crawl의 허용 범위 문서화
- [x] 내부망/loopback/private IP 차단 정책 검토
- [x] 허용 헤더/허용 도메인 정책 검토

관련 위치:
- [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py#L909)
- [backend/api/crawler.py](/C:/project/Codex/crawler/backend/api/crawler.py#L789)

### P1-5. 스케줄러 장애 격리 방안 정리
- [x] 순차 실행 구조의 병목 여부 확인
- [x] 재시도 `sleep` 구조 개선 필요성 판단
- [x] 한 소스 실패가 전체 스케줄에 미치는 영향 정리

관련 위치:
- [backend/api/management/commands/run_crawler_scheduler.py](/C:/project/Codex/crawler/backend/api/management/commands/run_crawler_scheduler.py#L54)
- [backend/api/crawler.py](/C:/project/Codex/crawler/backend/api/crawler.py#L828)

## P1. API/구조 기준 정리

### P1-6. `/api/posts/` 응답 계약 표준화
- [x] 배열 응답과 paginated object 응답 혼용 정책 정리
- [x] 프론트 표준 호출 방식 정의
- [x] 새 화면 추가 시 따라야 할 API 규칙 정리

관련 위치:
- [backend/api/views.py](/C:/project/Codex/crawler/backend/api/views.py#L432)
- [frontend/src/lib/api.ts](/C:/project/Codex/crawler/frontend/src/lib/api.ts#L251)

### P1-7. 프론트 인증/토큰 관리 정책 정리
- [x] `P1-7` 착수
- [x] `localStorage` 저장 방식 유지 여부 결정
- [x] 토큰 갱신 흐름과 배포 환경 분리 방안 검토
- [x] `API_URL` 하드코딩 제거 필요성 판단

관련 위치:
- [frontend/src/lib/api.ts](/C:/project/Codex/crawler/frontend/src/lib/api.ts#L1)
- [frontend/src/app/login/page.tsx](/C:/project/Codex/crawler/frontend/src/app/login/page.tsx#L30)

### P1-8. 운영자 UI 권한 노출 기준 정리
- [x] staff가 요약/댓글 관리 가능한지 정책 확정
- [x] 프론트 버튼 노출이 백엔드 권한과 일치하는지 점검
- [x] 운영자 QA 흐름 문서화

관련 위치:
- [frontend/src/components/PostSummary.tsx](/C:/project/Codex/crawler/frontend/src/components/PostSummary.tsx#L231)
- [frontend/src/components/PostComments.tsx](/C:/project/Codex/crawler/frontend/src/components/PostComments.tsx#L132)

## P1. 테스트/QA 기준선 복구

### P1-9. 백엔드 테스트 환경 복구
- [x] PostgreSQL 로컬 실행 조건 정리
- [x] 테스트 DB 생성 가능 상태 확인
- [x] `api.tests` 전체 실행 기준선 확보

관련 위치:
- [start_local_postgres.bat](/C:/project/Codex/crawler/start_local_postgres.bat)
- [stop_local_postgres.bat](/C:/project/Codex/crawler/stop_local_postgres.bat)

### P1-10. 핵심 QA 시나리오 정의
- [x] 비로그인 홈 피드 → 게시글 상세
- [x] 작성자 초안 저장 → 검토 요청
- [x] 관리자 승인/반려 → 초안 복원
- [x] 크롤러 preview → crawl → logs/runs/items
- [x] CVE 목록 → 상세 → 관련 게시글 → 상세 페이지

완료 기준:
- 최소 수동 QA 체크리스트가 문서화되어 있어야 함

## P2. 구조 개선 준비

### P2-1. 대형 파일 분해 후보 식별
- [ ] `backend/api/views.py` 분리 후보 정리
- [ ] `backend/api/crawler.py` 분리 후보 정리
- [ ] `frontend/src/lib/api.ts` 분리 후보 정리
- [ ] 대형 UI 컴포넌트 분해 후보 정리

### P2-2. 프론트 자동화 테스트 필요 범위 정리
- [ ] 관리자 글 관리
- [ ] 게시글 상세/댓글/요약
- [ ] 로그인/프로필
- [ ] 대시보드/CVE 흐름

### P2-3. 문서 정비
- [ ] 실제 프로젝트 기준의 프론트 README 작성 필요성 검토
- [ ] 로컬 실행 문서 정리
- [ ] 운영 체크 문서 정리

관련 위치:
- [frontend/README.md](/C:/project/Codex/crawler/frontend/README.md)

## 다음 액션
- [x] `P0-1 권한 정책표 작성` 확정
- [x] `P0-2 공개/비공개 정책 확정` 확정
- [x] `P0-3 정책 반영 구현` 완료
- [x] `P0-4 정책 반영 검증` 완료
- [x] `P1-1` ~ `P1-6` 완료
- [x] `P1-7 프론트 인증/토큰 관리 정책 정리` 완료
- [x] `P1-8 운영자 UI 권한 노출 기준 정리` 완료
- [x] `P1-9 백엔드 테스트 환경 복구` 완료
- [x] `P1-10 핵심 QA 시나리오 정의` 완료
- [ ] `P2-1 대형 파일 분해 후보 식별` 시작
- [ ] 이 문서를 기준 문서로 삼아 이후 진행 시 상태 갱신

## 작업 로그
- 2026-03-27: 초기 분석 결과를 바탕으로 Todo 문서 생성
- 2026-03-27: `product-manager` 기준으로 P0-1 권한 정책표 초안 작성 시작
- 2026-03-27: P0-1 승인 항목 일부 확정 (`published` 상세 공개, 운영 대시보드 staff/admin 전용, 게시글 삭제 admin 전용, 크롤러 preview/manual crawl admin 전용)
- 2026-03-27: P0-1 승인 항목 최종 확정 (`staff/admin` 실제 코드 분리, 댓글 전역 API 축소)
- 2026-03-27: `product-manager` 기준으로 P0-2 공개/비공개 정책 초안 작성 시작
- 2026-03-27: P0-2 승인 항목 최종 확정 (댓글 공개 범위 제한, 댓글 전역 API 축소, 운영 화면 분리, public author profile 보류, 일반 사용자 대시보드 보류, 비공개 게시글 404 수준 숨김)
- 2026-03-27: P0를 `정책 / 구현 / 검증` 구조로 재정리하고, P0 완료 후에만 P1로 넘어가도록 기준선 갱신
- 2026-04-20: 실제 완료 상태 기준으로 Todo 문서를 재정렬하고, 이후 작업은 이 문서를 기준으로 대항목 완료 시 문서화/커밋/진행 보고 흐름으로 운영하기로 확정
- 2026-04-20: `P1-7 프론트 인증/토큰 관리 정책 정리` 착수
- 2026-04-20: `P1-7 프론트 인증/토큰 관리 정책 정리` 완료 (`localStorage` 접근 경로 공통화, `NEXT_PUBLIC_API_URL` 도입, 직접 세션 체크 축소)
- 2026-04-20: `P1-8 운영자 UI 권한 노출 기준 정리` 완료 (`staff`의 요약/댓글 운영 권한을 프론트 UI와 정렬, QA 기준 문서화)
- 2026-04-20: `P1-9 백엔드 테스트 환경 복구` 완료 (로컬 PostgreSQL 5433 기준선 문서화, `manage.py check`와 `api.tests --keepdb` 재검증)
- 2026-04-20: `P1-10 핵심 QA 시나리오 정의` 완료 (권한, 크롤러, CVE, 인증 흐름 기준의 최소 수동 QA 시나리오 문서화)
## 2026-03-27 Update
- [x] P0-3 정책 반영 구현 완료
- [x] 대시보드 접근을 `staff/admin`으로 제한
- [x] 게시글 상세를 비로그인 공개로 정렬하고 비공개 게시글은 안내형 not-found 처리로 정렬
- [x] 댓글 전역 API를 운영/제한 영역으로 축소
- [x] `admin/posts`는 `staff/admin`, `admin/crawler`와 `admin/ai`는 `admin` 전용으로 분리
- [x] 게시글 삭제를 `admin` 전용으로 제한
- [x] 크롤러 preview/manual crawl을 `admin` 전용으로 제한
- [x] 공개 CVE 응답에서 운영 필드(`notes`, `is_tracked`, `legacy_mention_count`)를 숨김
- [-] P0-4 정책 반영 검증 진행 중
- [x] `npm run lint`
- [x] `npm run build`
- [x] `python -m py_compile backend/api/views.py backend/api/serializers.py backend/api/tests.py`
- [!] `python manage.py check`
  - 차단 사유: `pgvector` 모듈 미설치
- [ ] 다음 작업: 로컬 백엔드 실행 환경 복구 후 P0-4 수동 QA 체크리스트 수행
