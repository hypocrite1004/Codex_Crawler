import Link from 'next/link';

import type { PostListItem } from '@/lib/api';

export default function HomeFeedGrid({
  posts,
  visiblePosts,
  debouncedQuery,
  columnCount,
  gridRef,
  sentinelRef,
  virtualHeight,
  translateY,
  rowHeight,
  gridGap,
  hasMore,
  loadingInitial,
  loadingMore,
  highlightText,
}: {
  posts: PostListItem[];
  visiblePosts: PostListItem[];
  debouncedQuery: string;
  columnCount: number;
  gridRef: React.RefObject<HTMLDivElement | null>;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  virtualHeight: number;
  translateY: number;
  rowHeight: number;
  gridGap: number;
  hasMore: boolean;
  loadingInitial: boolean;
  loadingMore: boolean;
  highlightText: (text: string, query: string) => React.ReactNode;
}) {
  return (
    <>
      {posts.length > 0 ? (
        <div ref={gridRef} style={{ position: 'relative', minHeight: 480, height: virtualHeight }}>
          <div style={{ position: 'absolute', top: translateY, left: 0, right: 0, display: 'grid', gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`, gap: gridGap }}>
            {visiblePosts.map((post) => (
              <Link href={`/posts/${post.id}`} key={post.id} style={{ textDecoration: 'none' }}>
                <article className="glass-panel" style={{ cursor: 'pointer', height: rowHeight - gridGap, display: 'flex', flexDirection: 'column', overflow: 'hidden', contentVisibility: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                    <div style={{ color: 'var(--accent-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>{post.category_name || '미분류'}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {post.cve_count > 0 && <div style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 'bold' }}>CVE {post.cve_count}</div>}
                      {post.is_shared && <div style={{ background: 'var(--accent-primary)', color: 'white', padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 'bold' }}>Shared</div>}
                    </div>
                  </div>

                  <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 58 }}>
                    {highlightText(post.title, debouncedQuery)}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 96 }}>
                    {highlightText(post.content_preview, debouncedQuery)}
                  </p>

                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.85rem', color: 'var(--text-secondary)', minWidth: 0 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>
                        {post.author?.username ? post.author.username.charAt(0).toUpperCase() : '?'}
                      </div>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {post.author?.username || 'Unknown'} · {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {post.related_count > 0 && <span style={{ fontSize: '0.75rem', color: '#8b5cf6', background: 'rgba(139,92,246,0.15)', padding: '2px 8px', borderRadius: 12, fontWeight: 600, flexShrink: 0 }}>+ {post.related_count} 연관 글</span>}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div ref={gridRef} style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
          현재 조건에 맞는 게시글이 없습니다.
        </div>
      )}

      <div ref={sentinelRef} style={{ height: 1 }} />

      {(loadingMore || loadingInitial) && posts.length > 0 && (
        <div style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>게시글을 더 불러오는 중입니다...</div>
      )}
      {!hasMore && posts.length > 0 && (
        <div style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>마지막 게시글까지 모두 확인했습니다.</div>
      )}
    </>
  );
}
