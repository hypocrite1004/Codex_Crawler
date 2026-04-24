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

Status: planned

Objective:
- Help visitors understand a post before reading the full article.

Scope:
- Add a compact understanding card to public post detail.
- Reuse existing summary, CVE mentions, IOC extraction, source, and published metadata.
- Clearly show why the post matters when enough data exists.

Acceptance criteria:
- Public visitors can see summary/context/CVE/IOC signals near the top of the post detail.
- Posts without enriched metadata degrade gracefully.

## P6-3. CVE/IOC/Keyword Discovery Links

Status: planned

Objective:
- Turn structured security signals into navigation paths.

Scope:
- Link CVE mentions to CVE detail pages.
- Expose IOC and keyword paths where safe and useful.
- Connect related posts from post detail.

Acceptance criteria:
- Public visitors can continue from a post to at least one related security context.
- Discovery links do not expose operator-only fields.

## P6-4. Public Content Quality Signals

Status: planned

Objective:
- Give visitors lightweight confidence and usefulness signals without exposing internal crawler operations.

Scope:
- Show source, published date, summary availability, related count, CVE count, or similar public-safe signals.
- Avoid exposing internal crawler failure details to guests.

Acceptance criteria:
- Visitors can judge whether a post has enough context to read further.
- Internal crawler diagnostics remain admin-only.

## P6-5. Public Visitor E2E Coverage

Status: planned

Objective:
- Lock the public understanding and discovery flow.

Scope:
- Seed posts with summaries, CVE mentions, IOC-like content, and related security context.
- Verify list-to-detail understanding flow.
- Verify at least one CVE or related-content discovery path.

Acceptance criteria:
- `npm run test:e2e` covers a public visitor P6 flow.
- Existing E2E tests remain passing.

## Notes

Deep-interview artifact:
- `.omx/specs/deep-interview-next-work-after-p5.md`

Residual risk:
- The exact UI layout and metadata schema should be decided during implementation after inspecting existing public list/detail components.
