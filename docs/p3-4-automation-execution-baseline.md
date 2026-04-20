# P3-4 자동화 테스트 실행 스크립트 / CI 기준선

## 목적

현재 프로젝트는 백엔드 테스트, 프론트 lint/build, Playwright E2E가 모두 준비되어 있다.  
이번 `P3-4`의 목표는 이 검증 순서를 하나의 기준선으로 고정하고, 로컬/CI에서 같은 순서로 실행할 수 있게 만드는 것이다.

## 실행 순서

권장 순서:

1. 로컬 PostgreSQL 시작
2. `manage.py check`
3. `api.tests --keepdb`
4. `npm run lint`
5. `npm run build`
6. `npm run test:e2e`

## 스크립트

- [run_ci_checks.bat](/C:/project/Codex/Crawler/run_ci_checks.bat)

이 스크립트는 위 순서를 한 번에 수행한다.

## 로컬 기준 명령

```powershell
cmd /c run_ci_checks.bat
```

## 세부 명령

### 백엔드

```powershell
.\venv\Scripts\python.exe backend\manage.py check
.\venv\Scripts\python.exe backend\manage.py test api.tests --keepdb
```

### 프론트

```powershell
cd frontend
npm run lint
npm run build
npm run test:e2e
```

## CI 기준선 제안

CI에서도 최소 아래 단계를 유지하는 편이 적절하다.

- PostgreSQL 기동
- Python 의존성 설치
- Node 의존성 설치
- Playwright Chromium 설치
- backend check/test
- frontend lint/build
- Playwright E2E

## 결론

이제 프로젝트는 단일 실행 기준선으로

- backend 정적 검증
- backend 테스트
- frontend 정적 검증
- frontend E2E

를 한 번에 검증할 수 있다.
