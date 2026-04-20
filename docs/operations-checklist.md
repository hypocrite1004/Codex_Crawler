# 운영 체크리스트

## 목적

운영자 기능이나 배포 전후에 반드시 확인해야 할 최소 체크 항목을 정리합니다.

## 1. 배포 전 기본 체크

- [ ] `python backend/manage.py check`
- [ ] `python backend/manage.py test api.tests --keepdb`
- [ ] `npm run lint`
- [ ] `npm run build`

## 2. 공개/비공개 정책 체크

- [ ] guest가 공개 게시글 상세 접근 가능
- [ ] guest가 비공개 게시글 접근 시 `404` 또는 동등 수준으로 숨김
- [ ] 댓글은 공개 게시글 하위에서만 공개
- [ ] `/api/comments/` 전역 조회는 일반 사용자에게 노출되지 않음

## 3. 권한 체크

### staff

- [ ] `/dashboard` 접근 가능
- [ ] `/admin/posts` 접근 가능
- [ ] `/admin/crawler` 접근 불가
- [ ] `/admin/ai` 접근 불가
- [ ] 게시글 상세에서 요약 관리 버튼 노출 확인
- [ ] 타 사용자 댓글 운영 버튼 노출 확인

### admin

- [ ] `/admin/crawler` 접근 가능
- [ ] `/admin/ai` 접근 가능
- [ ] 크롤러 preview/manual crawl 가능

## 4. 게시글 워크플로 체크

- [ ] 작성자 초안 저장 가능
- [ ] 검토 요청 가능
- [ ] staff/admin 승인 가능
- [ ] 반려 가능
- [ ] draft 복원 가능
- [ ] archive 동작 확인

## 5. 크롤러 운영 체크

- [ ] source 생성/수정 가능
- [ ] preview 실행 가능
- [ ] manual crawl 실행 가능
- [ ] logs 조회 가능
- [ ] runs 조회 가능
- [ ] items 조회 가능

## 6. 크롤러 보안 체크

- [ ] localhost / private IP 차단
- [ ] 금지 헤더 차단
- [ ] preview/manual crawl 내부 상세 오류가 그대로 노출되지 않음

## 7. 대시보드 체크

- [ ] staff 대시보드에 admin 전용 통계가 노출되지 않음
- [ ] admin은 source 통계/버블 데이터 확인 가능
- [ ] recent posts에 불필요한 `source_url` 노출 없음

## 8. CVE 체크

- [ ] `/cves` 공개 접근 가능
- [ ] `/cves/[id]` 공개 접근 가능
- [ ] 운영 필드(`notes`, `is_tracked`, `legacy_mention_count`) 비노출
- [ ] 관련 게시글 링크 이동 가능

## 9. 인증 체크

- [ ] 로그인 가능
- [ ] 회원가입 후 로그인 가능
- [ ] 프로필 접근 가능
- [ ] 세션 만료 시 refresh 재시도 또는 로그아웃 흐름 확인
- [ ] `NEXT_PUBLIC_API_URL` 설정 또는 fallback 확인

## 참고 문서

- [project-todo.md](/C:/project/Codex/Crawler/docs/project-todo.md)
- [local-development.md](/C:/project/Codex/Crawler/docs/local-development.md)
- [p1-9-backend-test-environment-baseline.md](/C:/project/Codex/Crawler/docs/p1-9-backend-test-environment-baseline.md)
- [p1-10-core-qa-scenarios.md](/C:/project/Codex/Crawler/docs/p1-10-core-qa-scenarios.md)
