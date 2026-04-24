# P5-3. Crawler Retry Policy Implementation

## Status

Completed on 2026-04-24.

## Objective

Reduce unsafe or wasteful retries by retrying only failures that are likely to be transient.

## Changes

- Added `is_retryable_crawler_error` based on crawler diagnostic categories.
- Manual crawls now retry only:
  - network or fetch failures
  - unclassified crawler errors
- Manual crawls no longer retry deterministic failures such as selector mismatch, blocked source configuration, missing item URL, duplicate URL, persistence failure, or auto-disable markers.
- Existing scheduled behavior remains conservative: scheduled crawls still use a single attempt.
- Added a regression test proving selector mismatch errors do not retry even when `max_retries` is configured.

## Reliability Outcome

- Network failures can still benefit from retry/backoff.
- Selector/configuration failures fail fast and produce actionable diagnostics instead of repeated identical attempts.
- Auto-disable counters are not inflated by multiple attempts for deterministic failures in one manual run.

## Verification

- `.\venv\Scripts\python.exe backend\manage.py test api.tests.CrawlRunTrackingTests --keepdb`

Result:
- Backend crawler tracking tests passed: 30 tests.
