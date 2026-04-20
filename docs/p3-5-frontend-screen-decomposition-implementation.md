# P3-5 프론트 대형 화면 추가 분해

## 안건 요약

남아 있던 대형 프론트 화면 중 아래 3개를 UI 블록 기준으로 분해했다.

- [frontend/src/app/admin/posts/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/admin/posts/page.tsx)
- [frontend/src/components/HomeFeed.tsx](/C:/project/Codex/Crawler/frontend/src/components/HomeFeed.tsx)
- [frontend/src/app/profile/page.tsx](/C:/project/Codex/Crawler/frontend/src/app/profile/page.tsx)

## 구현 결과

### profile 분해

- [frontend/src/app/profile/ProfileForm.tsx](/C:/project/Codex/Crawler/frontend/src/app/profile/ProfileForm.tsx)
- [frontend/src/app/profile/ProfilePostsPanel.tsx](/C:/project/Codex/Crawler/frontend/src/app/profile/ProfilePostsPanel.tsx)

`page.tsx`는 데이터 로드와 액션 orchestration만 남기고, 프로필 편집 UI와 내 게시글 패널을 분리했다.

### admin posts 분해

- [frontend/src/app/admin/posts/AdminPostsTable.tsx](/C:/project/Codex/Crawler/frontend/src/app/admin/posts/AdminPostsTable.tsx)
- [frontend/src/app/admin/posts/RejectPostModal.tsx](/C:/project/Codex/Crawler/frontend/src/app/admin/posts/RejectPostModal.tsx)

`page.tsx`는 필터/데이터 로드/액션 handler만 남기고, 테이블과 반려 모달을 분리했다.

### HomeFeed 분해

- [frontend/src/components/HomeFeedFilters.tsx](/C:/project/Codex/Crawler/frontend/src/components/HomeFeedFilters.tsx)
- [frontend/src/components/HomeFeedGrid.tsx](/C:/project/Codex/Crawler/frontend/src/components/HomeFeedGrid.tsx)

`HomeFeed.tsx`는 상태와 무한 스크롤/가상화 계산을 유지하고, 필터 UI와 카드 그리드를 분리했다.

## 검증 결과

```powershell
cd frontend
npm run lint
npm run build
npm run test:e2e
```

검증 결과:

- `npm run lint`: 통과
- `npm run build`: 통과
- `npm run test:e2e`: 6 passed

## 결론

이번 단계로 남아 있던 주요 프론트 대형 화면의 1차 UI 분해가 완료됐다.  
이제 다음 프론트 리팩터링은 hook 분리나 상태 관리 로직 분리처럼 더 세밀한 방향으로 진행하는 것이 적절하다.
