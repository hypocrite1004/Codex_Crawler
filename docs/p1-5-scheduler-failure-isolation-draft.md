# P1-5 스케줄러 장애 격리 방안 정리

## 안건 요약

현재 스케줄러는 due source를 하나씩 순차 처리한다.  
문제는 개별 source의 재시도와 백오프가 `run_crawl()` 내부에서 동기적으로 실행된다는 점이다.

즉, 한 source가 느리거나 반복 실패하면 그 시간만큼 다음 source들이 모두 밀린다.  
이번 `P1-5`의 목적은 이 구조를 당장 전면 교체하지 않더라도, `한 source의 장애가 전체 수집 지연으로 번지는 문제`를 줄이는 기준을 정하는 것이다.

## 현재 상태

### 순차 실행

- [run_crawler_scheduler.py](/C:/project/Codex/crawler/backend/api/management/commands/run_crawler_scheduler.py)
  - `run_due_sources()`가 due source를 순서대로 순회
  - 각 source마다 `run_crawl(source, triggered_by='scheduled')`를 직접 호출

### 내부 재시도와 sleep 백오프

- [crawler.py](/C:/project/Codex/crawler/backend/api/crawler.py)
  - `max_attempts = 1 + max_retries`
  - 실패 시 `retry_backoff_minutes * 60 * attempt` 만큼 `time.sleep()` 수행
  - 이 sleep 동안 스케줄러 프로세스는 다른 source를 처리하지 못함

## 현재 리스크

1. 느린 source 1개가 due queue 전체를 지연시킨다.
2. 재시도 횟수가 많을수록 지연이 선형이 아니라 누적된다.
3. 외부 사이트 timeout, Playwright fallback, HTML parsing 지연이 그대로 다음 source 지연으로 이어진다.
4. 스케줄러 1프로세스 구조라 처리량 상한이 낮다.

## PM 권장안

### 1. 즉시 단계: scheduled run에서 내부 sleep 재시도 제거

권장안:

- `manual crawl`: 현재 재시도 유지 가능
- `scheduled crawl`: 내부 재시도 비활성화
- scheduled는 실패를 기록만 하고 다음 poll에서 다시 기회 부여

이렇게 하면 한 번의 scheduler tick에서 개별 source 실패가 길게 점유하지 않는다.

### 2. 즉시 단계: scheduler loop는 계속 순차 유지

이번 단계에서 곧바로 worker queue나 병렬 실행으로 넘어가기보다, 먼저 `blocking sleep 제거`부터 하는 편이 안전하다.

이유:

- 구현 영향 범위가 작다
- 현재 모델/로그 구조를 거의 유지할 수 있다
- 장애 전파를 가장 크게 줄이는 지점이 바로 여기다

### 3. 후속 단계: 병렬 처리 또는 큐 분리 검토

후속 후보:

- source별 worker queue
- thread/process pool 기반 제한적 병렬화
- 외부 task queue 도입

하지만 이것은 `P1-5` 즉시 구현 범위보다 크다.  
이번 단계는 `scheduled blocking 제거`까지로 자르는 것이 적절하다.

### 4. 관측성은 유지

재시도 축소와 함께 아래 데이터는 계속 남겨야 한다.

- 실패 상태
- 마지막 에러 메시지
- consecutive_failures
- auto_disable_after_failures 동작
- crawl run / crawl log 기록

즉, 격리는 강화하되 운영 가시성은 줄이지 않는다.

## 승인 필요 항목

1. `scheduled crawl`에서는 내부 sleep 재시도를 제거할지  
권장안: `제거`

2. `manual crawl`은 현재처럼 재시도를 유지할지  
권장안: `유지`

3. 이번 단계는 병렬화까지 가지 않고, 순차 scheduler + non-blocking scheduled retry 구조로 마칠지  
권장안: `그렇게 진행`

## PM 결론

이번 안건의 본질은 스케줄러를 고급화하는 것이 아니라,  
`실패한 source 하나가 전체 tick을 오래 붙잡지 못하게 만든다`는 것이다.

가장 효과 대비 리스크가 낮은 방향은:

- `scheduled`: 재시도 sleep 제거
- `manual`: 기존 재시도 유지
- 병렬화는 후속 과제로 분리

## 구현 결과

이번 단계에서는 스케줄러 구조를 바꾸지 않고, `run_crawl()`의 재시도 정책을 `triggered_by` 기준으로 분기했다.

### 재시도 정책 변경

- [crawler.py](/C:/project/Codex/crawler/backend/api/crawler.py)
  - `triggered_by='scheduled'`일 때는 `max_attempts = 1`
  - `triggered_by='manual'`일 때만 기존 `max_retries` 기반 재시도 유지
  - 백오프 `time.sleep()`도 `manual`에서만 동작

즉, scheduled run은 실패를 기록하고 바로 다음 source로 넘어가며, manual run만 운영자 편의상 재시도를 유지한다.

### 테스트 갱신

- [tests.py](/C:/project/Codex/crawler/backend/api/tests.py)
  - scheduled run은 재시도 없이 `attempt_count = 1`
  - scheduled run은 `sleep`을 호출하지 않음
  - manual run은 재시도 유지, `attempt_count = 2`
  - manual run은 backoff `sleep(60)` 호출

## 검증 결과

아래 명령 기준으로 확인했다.

```powershell
.\venv\Scripts\python.exe backend\manage.py check
.\venv\Scripts\python.exe backend\manage.py test api.tests --keepdb
```

검증 결과:

- `manage.py check`: 통과
- `manage.py test api.tests --keepdb`: 통과
