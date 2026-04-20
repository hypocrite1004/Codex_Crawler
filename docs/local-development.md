# 로컬 개발 가이드

## 개요

이 프로젝트는 아래 3개를 함께 사용합니다.

- Django 백엔드
- Next.js 프론트엔드
- 로컬 PostgreSQL

추가로 크롤러 fallback을 위해 Playwright Chromium이 필요합니다.

## 기본 경로

- 워크스페이스 루트: `C:\project\Codex\Crawler`
- 가상환경: `C:\project\Codex\Crawler\venv`
- 백엔드 설정 파일: [backend/.env](/C:/project/Codex/Crawler/backend/.env)

## 사전 준비

### 1. Python 가상환경 및 패키지

처음 한 번은 아래 스크립트를 사용합니다.

```powershell
cmd /c setup_backend.bat
```

이 스크립트는 아래를 수행합니다.

- `venv` 생성
- `backend/requirements.txt` 설치
- Playwright Chromium 설치
- `backend/.env.example`가 있으면 `backend/.env` 생성

### 2. Node/npm

프론트 실행과 빌드를 위해 Node/npm이 필요합니다.

프론트 경로:

- [frontend](/C:/project/Codex/Crawler/frontend)

## 환경변수

현재 로컬 기준 주요 값은 [backend/.env](/C:/project/Codex/Crawler/backend/.env)에 있습니다.

중요 항목:

```env
SECRET_KEY=change-me
DEBUG=True
DB_NAME=securnet_db
DB_USER=securnet_admin
DB_PASSWORD=change-me
DB_HOST=127.0.0.1
DB_PORT=5433
CORS_ALLOW_ALL_ORIGINS=True
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
OPENAI_API_KEY=
```

프론트는 `NEXT_PUBLIC_API_URL`이 없으면 기본값으로 `http://127.0.0.1:8000/api`를 사용합니다.

## PostgreSQL

### 로컬 시작

```powershell
cmd /c start_local_postgres.bat
```

### 포트 확인

```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 5433
```

### 로컬 정지

```powershell
cmd /c stop_local_postgres.bat
```

## 백엔드 실행

### 1. 가상환경 활성화

```powershell
.\venv\Scripts\activate
```

### 2. 마이그레이션

```powershell
cd backend
python manage.py migrate
```

### 3. 개발 서버 실행

```powershell
python manage.py runserver
```

기본 주소:

- `http://127.0.0.1:8000`

## 프론트 실행

```powershell
cd frontend
npm run dev
```

기본 주소:

- `http://localhost:3000`

## 스케줄러 실행

별도 터미널에서 실행합니다.

```powershell
cd backend
python manage.py run_crawler_scheduler --poll-seconds 60
```

## 한 번에 실행

아래 스크립트는 PostgreSQL, 백엔드, 프론트, 스케줄러를 각각 별도 창으로 띄웁니다.

```powershell
cmd /c run_all.bat
```

주의:

- 이 스크립트는 `migrate`를 수행하지 않습니다.
- DB 초기 준비가 되어 있어야 합니다.

## 검증 명령

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
```

## Postgres 관련 주의사항

현재 로컬 Postgres 스크립트는 클러스터를 `시작/정지`만 합니다.  
즉 아래는 미리 준비돼 있어야 합니다.

- PostgreSQL 클러스터
- `securnet_db`
- `securnet_admin`
- test DB 생성 권한

또한 마이그레이션 기준 아래 확장이 사용 가능해야 합니다.

- `pgvector`
- `pg_trgm`

관련 마이그레이션:

- [0011_enable_pgvector.py](/C:/project/Codex/Crawler/backend/api/migrations/0011_enable_pgvector.py)
- [0014_enable_pg_trgm.py](/C:/project/Codex/Crawler/backend/api/migrations/0014_enable_pg_trgm.py)

## 자주 쓰는 순서

일반적인 하루 시작 순서:

1. `cmd /c start_local_postgres.bat`
2. `.\venv\Scripts\python.exe backend\manage.py check`
3. `cd backend && python manage.py runserver`
4. `cd frontend && npm run dev`
5. 필요 시 `python manage.py test api.tests --keepdb`

## 참고 문서

- [project-todo.md](/C:/project/Codex/Crawler/docs/project-todo.md)
- [p1-9-backend-test-environment-baseline.md](/C:/project/Codex/Crawler/docs/p1-9-backend-test-environment-baseline.md)
- [p1-10-core-qa-scenarios.md](/C:/project/Codex/Crawler/docs/p1-10-core-qa-scenarios.md)
