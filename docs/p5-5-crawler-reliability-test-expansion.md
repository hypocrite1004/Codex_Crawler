# P5-5. Crawler Reliability Test Expansion

## Status

Completed on 2026-04-24.

## Objective

Lock P5 reliability behavior with regression tests so future crawler changes do not silently reintroduce stuck runs, misleading metrics, unsafe retry behavior, or missing operator alerts.

## Coverage Added During P5

- Stale lock recovery:
  - fresh locks still block duplicate execution
  - stale source locks are recovered before manual runs
  - scheduler recovers stale locks before due-source evaluation
- Persistence consistency:
  - run summaries derive counts from recorded `CrawlItem` evidence
  - duplicate item recording failure becomes item error evidence instead of a misleading duplicate count
- Retry policy:
  - scheduled runs remain single-attempt
  - manual network failures keep retry behavior
  - manual selector mismatch failures do not retry
- Reliability alerts:
  - metrics endpoint returns high failure rate and high item error rate alerts
  - Playwright verifies alert visibility on the admin crawler page

## Verification

- `.\venv\Scripts\python.exe backend\manage.py check`
- `.\venv\Scripts\python.exe backend\manage.py test api.tests --keepdb`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`

Result:
- Backend check passed.
- Backend tests passed: 55 tests.
- Frontend lint passed.
- Frontend build passed.
- Playwright E2E passed: 8 tests.
