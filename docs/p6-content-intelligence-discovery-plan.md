# P6. Content Intelligence and Discovery Plan

## Goal

Make collected security content more useful to public visitors. A visitor should quickly understand why a post matters and move naturally to related CVEs, IOCs, keywords, or similar posts.

## Product Direction

Priority:
- Product value first.
- Crawler/content quality improvements are included only where they directly improve public understanding or discovery.

Primary user:
- Public visitor.

Success criterion:
- A visitor can understand why a post matters within about 10 seconds from the list or detail page, then continue discovery through related security context.

## P6-1. Public Post List Discovery UX

Status: completed

Objective:
- Improve the public list so visitors can find meaningful security content faster than chronological browsing alone.

Scope:
- Added discovery cues to public post cards.
- Exposed CVE count, IOC presence, summary availability, and related coverage signals where available.
- Improved filtering and sorting paths for posts with security context.

Acceptance criteria:
- Completed: public visitors can identify posts with richer security context from the list.
- Completed: existing public list behavior remains stable.

Implementation record:
- [p6-1-public-post-list-discovery-implementation.md](/C:/project/Codex/Crawler/docs/p6-1-public-post-list-discovery-implementation.md)

## P6-2. Public Post Detail Understanding Card

Status: completed

Objective:
- Help visitors understand a post before reading the full article.

Scope:
- Add a compact understanding card to public post detail.
- Reuse existing summary, CVE mentions, IOC extraction, source, and published metadata.
- Clearly show why the post matters when enough data exists.

Acceptance criteria:
- Completed: public visitors can see summary/context/CVE/IOC signals near the top of the post detail.
- Completed: posts without enriched metadata degrade gracefully.

Implementation record:
- [p6-2-p6-5-public-content-understanding-discovery-implementation.md](/C:/project/Codex/Crawler/docs/p6-2-p6-5-public-content-understanding-discovery-implementation.md)

## P6-3. CVE/IOC/Keyword Discovery Links

Status: completed

Objective:
- Turn structured security signals into navigation paths.

Scope:
- Link CVE mentions to CVE detail pages.
- Expose IOC and keyword paths where safe and useful.
- Connect related posts from post detail.

Acceptance criteria:
- Completed: public visitors can continue from a post to CVE detail, IOC search, keyword search, or related coverage.
- Completed: discovery links do not expose operator-only fields.

Implementation record:
- [p6-2-p6-5-public-content-understanding-discovery-implementation.md](/C:/project/Codex/Crawler/docs/p6-2-p6-5-public-content-understanding-discovery-implementation.md)

## P6-4. Public Content Quality Signals

Status: completed

Objective:
- Give visitors lightweight confidence and usefulness signals without exposing internal crawler operations.

Scope:
- Show source, published date, summary availability, related count, CVE count, or similar public-safe signals.
- Avoid exposing internal crawler failure details to guests.

Acceptance criteria:
- Completed: visitors can judge source, date, summary, CVE, IOC, and related coverage signals before reading further.
- Completed: internal crawler diagnostics remain admin-only.

Implementation record:
- [p6-2-p6-5-public-content-understanding-discovery-implementation.md](/C:/project/Codex/Crawler/docs/p6-2-p6-5-public-content-understanding-discovery-implementation.md)

## P6-5. Public Visitor E2E Coverage

Status: completed

Objective:
- Lock the public understanding and discovery flow.

Scope:
- Seed posts with summaries, CVE mentions, IOC-like content, and related security context.
- Verify list-to-detail understanding flow.
- Verify at least one CVE or related-content discovery path.

Acceptance criteria:
- Completed: `npm run test:e2e` covers public list-to-detail understanding and CVE discovery flow.
- Completed: existing E2E tests remain passing.

Implementation record:
- [p6-2-p6-5-public-content-understanding-discovery-implementation.md](/C:/project/Codex/Crawler/docs/p6-2-p6-5-public-content-understanding-discovery-implementation.md)

## P6 Completion

Status: completed

Completed scope:
- P6-1 public list discovery UX.
- P6-2 public post detail understanding card.
- P6-3 CVE/IOC/keyword discovery links.
- P6-4 public content quality signals.
- P6-5 public visitor E2E coverage.

Verification:
- `python -m py_compile backend/api/serializers.py backend/api/tests.py backend/api/management/commands/seed_e2e_data.py`
- `python backend/manage.py check`
- `python backend/manage.py test api.tests.CveFeatureTests --keepdb`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`

## Notes

Deep-interview artifact:
- `.omx/specs/deep-interview-next-work-after-p5.md`

Residual risk:
- The exact UI layout and metadata schema should be decided during implementation after inspecting existing public list/detail components.
