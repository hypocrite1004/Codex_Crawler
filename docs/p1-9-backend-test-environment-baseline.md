# P1-9 백엔드 테스트 환경 복구

## 안건 요약

백엔드 테스트는 PostgreSQL 기반으로 동작하며, 로컬 환경에서 DB가 떠 있지 않으면 바로 실패한다.  
이번 `P1-9`의 목표는 “테스트가 왜 실패하는지”를 추측하는 상태를 끝내고, 실제 로컬 실행 기준선을 문서로 고정하는 것이다.

## 현재 기준

### DB 설정

- [backend/.env](/C:/project/Codex/Crawler/backend/.env)
  - `DB_HOST=127.0.0.1`
  - `DB_PORT=5433`
  - `DB_NAME=securnet_db`
  - `DB_USER=securnet_admin`

### 로컬 PostgreSQL 스크립트

- [start_local_postgres.bat](/C:/project/Codex/Crawler/start_local_postgres.bat)
- [stop_local_postgres.bat](/C:/project/Codex/Crawler/stop_local_postgres.bat)

이 스크립트들은 PostgreSQL 클러스터를 `시작/정지`만 한다.  
즉, 초기 클러스터 생성, DB 생성, 계정 생성은 별도 준비가 되어 있어야 한다.

### 머신 종속 경로

- PostgreSQL root: `C:\Users\SECURITYHUB\pgsql17-local\17`
- PostgreSQL data: `C:\Users\SECURITYHUB\pgsql17-local\data`

이 경로는 현재 머신 기준 하드코딩이므로 환경 의존성으로 문서화가 필요하다.

## 실행 절차

### 1. 가상환경 준비

- 루트 `venv` 사용
- 필요 시 [setup_backend.bat](/C:/project/Codex/Crawler/setup_backend.bat)로 기본 설치 수행

### 2. PostgreSQL 시작

```powershell
cmd /c start_local_postgres.bat
```

포트 확인:

```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 5433
```

### 3. 백엔드 점검

```powershell
.\venv\Scripts\python.exe backend\manage.py check
```

### 4. 백엔드 테스트 실행

```powershell
.\venv\Scripts\python.exe backend\manage.py test api.tests --keepdb
```

## 환경 의존성

### 필수

- Windows 배치 파일 실행 가능 환경
- 루트 `venv`
- PostgreSQL 17 로컬 클러스터
- test DB 생성 권한이 있는 DB 사용자

### Postgres 확장

마이그레이션 기준 아래 확장 사용 가능 상태가 필요하다.

- `pgvector`
- `pg_trgm`

관련 마이그레이션:

- [0011_enable_pgvector.py](/C:/project/Codex/Crawler/backend/api/migrations/0011_enable_pgvector.py)
- [0014_enable_pg_trgm.py](/C:/project/Codex/Crawler/backend/api/migrations/0014_enable_pg_trgm.py)

### 기타

- Playwright Chromium 설치 필요
- Node/npm 필요
- `OPENAI_API_KEY`가 비어 있어도 서버 기동과 기본 테스트는 가능하지만 AI 기능은 정상 경로를 타지 못할 수 있음

## 검증 결과

2026-04-20 기준 실제 확인:

```powershell
cmd /c start_local_postgres.bat
.\venv\Scripts\python.exe backend\manage.py check
.\venv\Scripts\python.exe backend\manage.py test api.tests --keepdb
```

검증 결과:

- PostgreSQL `127.0.0.1:5433` 포트 응답 확인
- `manage.py check`: 통과
- `api.tests --keepdb`: 통과

## 남은 공백

- 초기 PostgreSQL 클러스터 생성 절차
- `securnet_db`, `securnet_admin` 생성 절차
- DB 사용자 권한 설정 절차

즉, “운영 중인 로컬 테스트 기준선”은 확보됐지만, “완전한 처음부터 재현 문서”는 아직 아니다.
