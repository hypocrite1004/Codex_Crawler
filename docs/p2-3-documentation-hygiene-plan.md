# P2-3 문서 정비

## 목적

현재 프로젝트는 기능과 운영 기준 문서는 많이 쌓였지만, 새 참여자가 바로 따라갈 수 있는 `시작 문서`는 아직 부족하다.  
이번 `P2-3`의 목표는 어떤 문서를 새로 써야 하는지와 우선순위를 정리하는 것이다.

## 현재 상태

### 강한 문서

- [project-todo.md](/C:/project/Codex/Crawler/docs/project-todo.md)
- P0 / P1 / P2 단계별 의사결정 문서

장점:

- 왜 이렇게 바꿨는지 추적 가능
- 정책/리스크/구현 맥락이 남아 있음

### 약한 문서

- [frontend/README.md](/C:/project/Codex/Crawler/frontend/README.md)
  - 실제 프로젝트 설명보다 보일러플레이트 성격이 강함
- 루트 기준 실행 가이드 부재
- 운영 체크 문서 부재

## 문서 정비 우선순위

### 1. 실제 프로젝트 기준 프론트 README

대상:

- [frontend/README.md](/C:/project/Codex/Crawler/frontend/README.md)

필수 내용:

- 프로젝트 개요
- 로컬 실행 방법
- 주요 페이지
- 환경변수
- 인증/권한 개요
- 빌드/검증 명령

우선순위:

- `높음`

### 2. 로컬 실행 문서

신규 문서 후보:

- `docs/local-development.md`

필수 내용:

- `venv` 준비
- PostgreSQL 로컬 시작/정지
- `backend/.env` 설명
- Django 실행
- Next.js 실행
- 스케줄러 실행
- 테스트 실행

우선순위:

- `최상`

이유:

- 현재는 실행 지식이 `.bat`, `.env`, Todo 문서에 흩어져 있다.

### 3. 운영 체크 문서

신규 문서 후보:

- `docs/operations-checklist.md`

필수 내용:

- 배포 전 체크
- 크롤러 source 변경 시 체크
- 권한/공개 정책 회귀 체크
- AI 설정 변경 시 체크
- 수동 QA 핵심 흐름 링크

우선순위:

- `높음`

## 권장 작성 순서

1. `docs/local-development.md`
2. `frontend/README.md` 정리
3. `docs/operations-checklist.md`

## 결론

현재 가장 먼저 필요한 문서는 `로컬 실행 문서`다.  
그 다음으로 `frontend/README.md`를 실제 프로젝트 기준으로 교체하고, 마지막으로 운영 체크 문서를 추가하는 순서가 적절하다.
