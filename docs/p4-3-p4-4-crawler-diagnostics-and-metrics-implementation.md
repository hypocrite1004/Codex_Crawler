# P4-3/P4-4. Crawler Diagnostics and Metrics Implementation

## Status

Completed on 2026-04-24.

## Objective

Make crawler results actionable for operators. The admin crawler page now shows whether collection is healthy over recent windows and the run drilldown explains common failure causes without requiring server log access.

## Changes

- Added backend diagnostic categorization for crawler runs and crawl items.
- Added user-facing diagnostic labels and hints to run and item API responses.
- Distinguished common crawler outcomes:
  - blocked source configuration
  - network or fetch failure
  - selector or parsing mismatch
  - missing item URL
  - duplicate URL
  - persistence failure
  - partial item failures
  - fallback fetch usage
- Added admin-only crawler metrics endpoint at `/api/crawler-runs/metrics/`.
- Added 24h and 7d run summaries for total, successful, failed, running, created, duplicate, filtered, and item error counts.
- Added source-level 7d health rows for recent runs, success rate, failures, created posts, item errors, and last run time.
- Added collection metrics to the admin crawler page.
- Added diagnostic badges and hints to the crawl run drilldown.
- Extended E2E coverage to verify diagnostics and collection status visibility.

## Operator Outcome

An admin can now:

- see recent collection health over 24h and 7d
- identify sources with recent failures or item errors
- open a run and immediately see whether the issue is blocked config, network, selector/parsing, duplicate URL, missing URL, persistence, fallback, or partial item failure
- inspect raw error messages only after seeing the normalized operator diagnosis

## Verification

- `.\venv\Scripts\python.exe backend\manage.py check`
- `.\venv\Scripts\python.exe backend\manage.py test api.tests --keepdb`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`

Result:
- Backend check passed.
- Backend tests passed: 50 tests.
- Frontend lint passed.
- Frontend build passed.
- Playwright E2E passed: 8 tests.

## Notes

Metrics are derived from `CrawlRun` and `CrawlItem` records instead of inferred from posts. This keeps the operations view aligned with actual crawler evidence, including duplicates, filtered items, item errors, and failed runs that may not create posts.
