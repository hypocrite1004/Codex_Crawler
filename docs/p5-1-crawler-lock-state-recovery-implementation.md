# P5-1. Crawler Lock State Recovery Implementation

## Status

Completed on 2026-04-24.

## Objective

Prevent crawler sources from getting permanently stuck in `is_running=True` after process crashes, server restarts, or unexpected termination during a crawl.

## Changes

- Added `CRAWLER_STALE_RUN_MINUTES`, configurable by environment variable and defaulting to 120 minutes.
- Added stale crawler state recovery in `api.crawler.recover_stale_crawler_state`.
- A stale source is identified when:
  - `CrawlerSource.is_running=True`
  - and `last_run_started_at` is older than the configured timeout, or missing
- Recovery now:
  - marks stuck `CrawlRun(status='running')` records as `error`
  - records `finished_at`, `duration_seconds`, item-derived counts, and a recovery error message
  - updates the source to `is_running=False`
  - records an operator-visible `CrawlerLog`
  - increments failure count and respects auto-disable thresholds
- Manual `run_crawl` attempts recover stale state for the target source before trying to acquire the run lock.
- The scheduler performs global stale-state recovery before checking due sources.

## Reliability Outcome

- Fresh duplicate runs are still blocked.
- Stale locks no longer block manual recovery forever.
- Scheduled collection will clear stale state instead of silently skipping a source forever.
- Scheduler recovery does not immediately retry in the same tick, reducing the risk of tight failure loops after stale recovery.

## Verification

- `.\venv\Scripts\python.exe backend\manage.py test api.tests.CrawlRunTrackingTests --keepdb`

Result:
- Backend crawler tracking tests passed: 28 tests.
