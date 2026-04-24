# P5-2. Crawler Persistence Consistency Implementation

## Status

Completed on 2026-04-24.

## Objective

Keep crawl run summaries aligned with the actual item evidence recorded for a run, especially when item persistence or item logging partially fails.

## Changes

- Run summaries now derive `articles_created`, `duplicate_count`, `filtered_count`, and `error_count` from recorded `CrawlItem` rows after persistence completes.
- Error-path run summaries also use recorded item evidence for created item counts.
- Missing URL item handling now goes through the same per-item exception boundary as other item outcomes.
- Duplicate and filtered counters are incremented only after the corresponding item evidence is recorded.
- Added a regression test for duplicate item recording failure to ensure run summary counts match the surviving `CrawlItem` evidence.

## Reliability Outcome

- Operators can trust that run-level counters match the item drilldown.
- Partial item recording failures do not leave run summaries showing duplicate or filtered counts that have no corresponding item evidence.
- Created post counts continue to reflect successfully recorded created items, not attempted creates that were rolled back.

## Verification

- `.\venv\Scripts\python.exe backend\manage.py test api.tests.CrawlRunTrackingTests --keepdb`

Result:
- Backend crawler tracking tests passed: 29 tests.
