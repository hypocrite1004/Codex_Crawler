# P7-4. Source-Level Quality Metrics Implementation

## Summary

Crawler operations now expose stored content quality by source in the existing admin metrics endpoint.

Added metrics:
- `quality.posts_checked`
- `quality.error_count`
- `quality.warning_count`
- `quality.info_count`
- `quality.issue_count`
- `quality.quality_status`
- `quality.issues[]`

The admin crawler dashboard displays each source's quality status next to run success, created count, and item errors.

## Decisions

- Source quality is derived from recent posts linked through `CrawlItem -> CrawlRun -> CrawlerSource`.
- The existing `analyze_post_quality` contract remains the single source of truth for issue classification.
- Quality alerts are included in the existing reliability alert list so operators see source quality problems without opening a separate report.
- The metrics endpoint remains admin-only through the existing `CrawlerRunViewSet` permission boundary.

## Verification

- Passed: `python -m py_compile backend/api/crawler_quality.py backend/api/crawler_views.py backend/api/tests.py`
- Passed: `python backend/manage.py test api.tests.CrawlRunTrackingTests.test_crawler_metrics_endpoint_returns_source_quality_summaries api.tests.CrawlRunTrackingTests.test_crawler_metrics_endpoint_returns_period_and_source_summaries --keepdb`
- Passed: `python backend/manage.py test api.tests.CrawlRunTrackingTests api.tests.CrawlerQualityAuditTests --keepdb`
- Passed: `python backend/manage.py check`
- Passed: `python backend/manage.py audit_crawler_quality --days 30 --limit 5`
- Passed: `python backend/manage.py test api.tests --keepdb`
- Passed: `npm run lint` from `frontend/`
- Passed: `npm run build` from `frontend/`
- Not run: live browser visual inspection.
