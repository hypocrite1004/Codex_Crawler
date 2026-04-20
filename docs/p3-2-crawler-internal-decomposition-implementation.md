# P3-2 `backend/api/crawler.py` 내부 분해

## 안건 요약

기존 [backend/api/crawler.py](/C:/project/Codex/Crawler/backend/api/crawler.py)는 fetch, parsing, persistence, preview, notification, runtime을 모두 포함하고 있었다.

이번 `P3-2`의 목표는 테스트 patch 호환성을 유지하면서 내부 기능을 하위 모듈로 분리하는 것이다.

## 구현 결과

### 분리된 모듈

- [backend/api/crawler_fetchers.py](/C:/project/Codex/Crawler/backend/api/crawler_fetchers.py)
  - `crawl_rss`
  - `crawl_html`
  - HTML cleaning / parsing / Playwright fallback

- [backend/api/crawler_persistence.py](/C:/project/Codex/Crawler/backend/api/crawler_persistence.py)
  - `_ensure_system_user`
  - `normalize_source_url`
  - `_record_crawl_item`
  - `_get_run_item_totals`
  - `_persist_crawled_items`
  - `_persist_crawled_items_with_run`

- [backend/api/crawler_notifications.py](/C:/project/Codex/Crawler/backend/api/crawler_notifications.py)
  - `_send_telegram_notifications`

- [backend/api/crawler_preview.py](/C:/project/Codex/Crawler/backend/api/crawler_preview.py)
  - `_SourceProxy`
  - `preview_crawl`

### crawler.py 정리

- [backend/api/crawler.py](/C:/project/Codex/Crawler/backend/api/crawler.py)
  - `run_crawl` 오케스트레이션 유지
  - 테스트에서 patch하는 심볼은 wrapper 형태로 유지
  - 내부 구현은 하위 모듈 호출

## 이슈와 처리

### 1. 하위 모듈 파일 누락

초기 분리 중 `crawler_fetchers.py`, `crawler_persistence.py`, `crawler_notifications.py`, `crawler_preview.py` 파일이 실제로 생성되지 않아 import 에러가 발생했다.  
파일 추가 후 해결했다.

### 2. 테스트 patch 호환성 문제

기존 테스트는 `api.crawler._record_crawl_item` patch를 통해 원자성 검증을 하고 있었다.  
분리 후 persistence 모듈이 내부 함수를 직접 쓰면서 patch가 적용되지 않아 테스트 3개가 깨졌다.

해결:

- [backend/api/crawler.py](/C:/project/Codex/Crawler/backend/api/crawler.py)에 wrapper 유지
- persistence 함수는 `record_item_fn` 주입을 받도록 변경
- 테스트가 patch하는 `api.crawler._record_crawl_item` 경로가 다시 실제 실행 경로에 반영되도록 복구

## 검증 결과

```powershell
.\venv\Scripts\python.exe backend\manage.py check
.\venv\Scripts\python.exe backend\manage.py test api.tests --keepdb
```

검증 결과:

- `manage.py check`: 통과
- `api.tests --keepdb`: 통과

## 결론

이번 단계로 `crawler.py`는 실질적으로 오케스트레이션 레이어가 되었고, fetch/parsing/persistence/preview/notification이 분리됐다.  
이제 다음 구조 작업은 프론트 대형 화면 분해 또는 운영 설정/CI 기준선 강화 쪽으로 넘어가는 것이 적절하다.
