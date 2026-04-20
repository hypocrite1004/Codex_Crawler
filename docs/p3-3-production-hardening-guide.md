# P3-3 운영 환경 설정 하드닝

## 목적

현재 로컬 개발 설정은 실행 편의를 우선한다.  
운영 환경에서는 최소한 아래 설정 기준을 분리해서 관리해야 한다.

## 주요 운영 기준

### Django

- `DEBUG=False`
- `SECRET_KEY`는 `change-me` 금지
- `SECRET_KEY`는 32자 이상 랜덤 값 권장
- `ALLOWED_HOSTS`는 실제 도메인만 허용

### DB

- 운영 DB 계정과 로컬 계정 분리
- `DB_PASSWORD`는 강한 비밀번호 사용
- test DB 생성 권한은 운영 계정과 분리 검토

### CORS

- `CORS_ALLOW_ALL_ORIGINS=False`
- `CORS_ALLOWED_ORIGINS`는 실제 프론트 도메인만 명시

### 프론트 API

- `NEXT_PUBLIC_API_URL`를 운영 도메인 기준으로 명시
- fallback 로컬 URL에 의존하지 않도록 배포 환경 변수 고정

## 현재 발견된 경고

- 로컬 `.env`는 `SECRET_KEY=change-me`
- JWT 서명 시 `InsecureKeyLengthWarning` 발생 가능

이 경고는 로컬 개발에서는 치명적이지 않지만, 운영 환경에서는 허용하면 안 된다.

## 추가한 예시 파일

- [backend/.env.production.example](/C:/project/Codex/Crawler/backend/.env.production.example)

이 파일은 운영 배포용 기본 틀이다. 실제 배포 시 값은 반드시 교체해야 한다.

## 운영 전 체크

- [ ] `DEBUG=False`
- [ ] `SECRET_KEY`가 기본값 아님
- [ ] `DB_PASSWORD`가 기본값 아님
- [ ] `ALLOWED_HOSTS`가 실제 도메인만 포함
- [ ] `CORS_ALLOW_ALL_ORIGINS=False`
- [ ] `CORS_ALLOWED_ORIGINS`가 실제 프론트 도메인만 포함
- [ ] `NEXT_PUBLIC_API_URL`가 운영 API 주소로 설정

## 결론

이번 단계는 운영 하드닝 기준을 문서와 예시 파일로 고정한 것이다.  
다음 단계에서는 실제 배포 환경에 이 기준을 적용하고, 필요하면 배포 전 자동 점검으로 확장하는 것이 적절하다.
