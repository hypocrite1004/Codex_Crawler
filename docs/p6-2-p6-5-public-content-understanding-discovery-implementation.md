# P6-2 ~ P6-5 Public Content Understanding and Discovery Implementation

Date: 2026-04-24

## Scope

- Added a public post detail understanding card near the top of the article.
- Linked CVE mentions to CVE detail pages.
- Linked IOC and summary hashtag signals back to public feed search.
- Preserved related coverage links from the post detail page.
- Removed operator-oriented CVE mention fields from the public post detail response.
- Expanded deterministic E2E seed data and public visitor E2E coverage.

## Product Behavior

Public visitors can now decide why a post matters before reading the full article. The understanding card shows:

- Summary or fallback context.
- CVE count and direct CVE detail links.
- IOC count and IOC search links.
- Related coverage count.
- Published date and source.
- Summary and curated availability signals.

Posts without enriched metadata still render a fallback explanation instead of an empty or broken card.

## Public-Safe Data Boundary

The public CVE mention payload excludes operator-oriented fields:

- `source`
- `legacy_reference_ids`

Crawler diagnostics remain limited to admin/operator surfaces and are not surfaced in the public understanding card.

## Verification

- Passed: `python -m py_compile backend/api/serializers.py backend/api/tests.py backend/api/management/commands/seed_e2e_data.py`
- Passed: `python backend/manage.py check`
- Passed: `python backend/manage.py test api.tests.CveFeatureTests --keepdb`
- Passed: `npm run lint`
- Passed: `npm run build`
- Passed: `npm run test:e2e` with 10 tests

## Notes

- Two E2E reruns initially failed because Playwright strict mode matched duplicate visible text. The selectors were narrowed to the intended regions; no product-code defect was identified from those failures.
- Manual browser visual inspection outside Playwright was not performed.
