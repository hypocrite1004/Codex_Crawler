# P4-2. Crawl Run Detail Drilldown Implementation

## Status

Completed on 2026-04-24.

## Objective

Make crawler execution results inspectable from the admin crawler screen. Operators can now move from a source to recent runs, then from a run to item-level outcomes without reading backend logs.

## Changes

- Added frontend API functions for existing backend crawler run endpoints:
  - `fetchCrawlerRuns(sourceId)`
  - `fetchCrawlerRunItems(runId)`
- Added `CrawlerRun` and `CrawlItem` frontend types.
- Added `CrawlerRunDrilldown` on the admin crawler page.
- Added a `Runs` action to each crawler source card.
- Manual crawl responses now preserve `run_id` in the frontend type and open the resulting run panel when available.
- Added E2E seed data for a deterministic crawler source, run, and item set.
- Added Playwright coverage for:
  - opening the crawler run drilldown
  - seeing created, duplicate, filtered, and error item outcomes
  - opening the generated post from a created crawl item

## Operator Outcome

An admin can inspect:

- run status
- trigger type
- started/finished time
- attempt count
- duration
- found/created/duplicate/filtered/error totals
- item-level source URLs
- item-level error messages
- generated post links for created items

## Verification

- `.\venv\Scripts\python.exe backend\manage.py check`
- `.\venv\Scripts\python.exe backend\manage.py test api.tests --keepdb`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`

Result:
- Backend check passed.
- Backend tests passed: 48 tests.
- Frontend lint passed.
- Frontend build passed.
- Playwright E2E passed: 7 tests.

## Notes

The first backend test attempt failed because local PostgreSQL on `127.0.0.1:5433` was not running. The local database was started with `start_local_postgres.bat`, then backend tests and E2E passed.

The first new E2E attempt failed because `Created` matched multiple visible nodes. The assertion was changed to the deterministic item title `E2E Created Crawl Item`.
