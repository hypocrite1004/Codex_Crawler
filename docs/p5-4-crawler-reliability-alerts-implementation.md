# P5-4. Crawler Reliability Alerts Implementation

## Status

Completed on 2026-04-24.

## Objective

Surface crawler reliability warnings at the operations dashboard level so operators do not need to inspect every source or run to find collection risks.

## Changes

- Added `alerts` to `/api/crawler-runs/metrics/`.
- Added alert categories:
  - `stale_running`
  - `high_failure_rate`
  - `no_recent_success`
  - `high_item_error_rate`
- Added severity sorting so error alerts appear before warning alerts.
- Added `Reliability Alerts` cards to the admin crawler page.
- Extended E2E seed data with a deterministic high-failure crawler source.
- Added backend metrics tests for reliability alert output.
- Extended Playwright crawler operations coverage to verify alert visibility.

## Operator Outcome

Admins can now see source-level reliability risks directly on the crawler operations page, including high recent failure rate and high item error rate, before opening individual run details.

## Verification

- `.\venv\Scripts\python.exe backend\manage.py test api.tests.CrawlRunTrackingTests.test_crawler_metrics_endpoint_returns_reliability_alerts api.tests.CrawlRunTrackingTests.test_crawler_metrics_endpoint_returns_period_and_source_summaries --keepdb`
- `npm run lint`

Result:
- Targeted backend metrics tests passed: 2 tests.
- Frontend lint passed.
