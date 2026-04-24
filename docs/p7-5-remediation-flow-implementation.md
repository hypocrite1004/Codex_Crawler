# P7-5. Remediation Flow Implementation

## Summary

Crawler quality findings now lead to concrete operator actions from the admin crawler screen.

Added remediation capabilities:
- Source-level quality detail endpoint: `GET /api/crawler-sources/{id}/quality/`
- Source review action: `POST /api/crawler-sources/{id}/mark_needs_review/`
- Admin UI quality panel per source with affected posts, issue codes, recommended actions, source edit, run history, rerun, and pause-for-review actions.

## Decisions

- Remediation is driven by `CrawlItem -> CrawlRun -> CrawlerSource` evidence so manual or imported posts do not affect crawler source health.
- Marking a source as needing review pauses scheduling by setting `is_active=false`, records `last_status=error`, and stores an operator-facing `last_error_message`.
- The flow uses existing admin-only crawler source permissions; no public or general-user surface is introduced.
- Item-level rerun is not implemented yet because the current crawler execution unit is source-level. The UI links affected posts back to their run and supports source rerun after selector fixes.

## Verification

- Passed: `python -m py_compile backend/api/crawler_views.py backend/api/tests.py`
- Passed: `python backend/manage.py test api.tests.CrawlRunTrackingTests.test_crawler_source_quality_endpoint_returns_remediation_details api.tests.CrawlRunTrackingTests.test_mark_needs_review_pauses_crawler_source api.tests.CrawlRunTrackingTests.test_crawler_source_quality_endpoint_rejects_invalid_window --keepdb`
- Passed: `python backend/manage.py test api.tests.CrawlRunTrackingTests api.tests.CrawlerQualityAuditTests --keepdb`
- Passed: `python backend/manage.py check`
- Passed: `python backend/manage.py audit_crawler_quality --days 30 --limit 5`
- Passed: `python backend/manage.py test api.tests --keepdb` (63 tests)
- Passed: `npm run lint` from `frontend/`
- Passed: `npm run build` from `frontend/`
- Not run: live browser visual inspection.
