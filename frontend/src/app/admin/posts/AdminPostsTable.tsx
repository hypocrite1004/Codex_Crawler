import type { AdminPostListItem, AuthUser, PostStatus } from '@/lib/api';

const STATUS_STYLES: Record<PostStatus, { label: string; color: string; background: string; border: string }> = {
  draft: { label: 'Draft', color: '#cbd5e1', background: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)' },
  review: { label: 'Review', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.35)' },
  rejected: { label: 'Rejected', color: '#fb7185', background: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.35)' },
  published: { label: 'Published', color: '#34d399', background: 'rgba(52, 211, 153, 0.12)', border: 'rgba(52, 211, 153, 0.35)' },
  archived: { label: 'Archived', color: '#94a3b8', background: 'rgba(71, 85, 105, 0.18)', border: 'rgba(148, 163, 184, 0.25)' },
};

function renderStatusBadge(status: PostStatus) {
  const style = STATUS_STYLES[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 10px',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 700,
        color: style.color,
        background: style.background,
        border: `1px solid ${style.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {style.label}
    </span>
  );
}

function renderWorkflowMeta(post: AdminPostListItem) {
  if (post.status === 'review' && post.approval_requested_at) {
    return `검토 요청: ${new Date(post.approval_requested_at).toLocaleString()}`;
  }
  if (post.status === 'published' && post.approved_at) {
    const approver = post.approved_by_name ? ` / ${post.approved_by_name}` : '';
    return `승인: ${new Date(post.approved_at).toLocaleString()}${approver}`;
  }
  if (post.status === 'rejected' && post.rejected_at) {
    const reviewer = post.rejected_by_name ? ` / ${post.rejected_by_name}` : '';
    return `반려: ${new Date(post.rejected_at).toLocaleString()}${reviewer}`;
  }
  if (post.status === 'archived' && post.archived_at) {
    return `보관: ${new Date(post.archived_at).toLocaleString()}`;
  }
  return null;
}

export default function AdminPostsTable({
  posts,
  loading,
  page,
  totalPages,
  currentUser,
  onToggleSummarize,
  onApprove,
  onOpenRejectModal,
  onRestoreDraft,
  onArchive,
  onDelete,
  onPrevPage,
  onNextPage,
}: {
  posts: AdminPostListItem[];
  loading: boolean;
  page: number;
  totalPages: number;
  currentUser: AuthUser | null;
  onToggleSummarize: (post: AdminPostListItem) => void;
  onApprove: (post: AdminPostListItem) => void;
  onOpenRejectModal: (post: AdminPostListItem) => void;
  onRestoreDraft: (post: AdminPostListItem) => void;
  onArchive: (post: AdminPostListItem) => void;
  onDelete: (postId: number) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}) {
  const renderActions = (post: AdminPostListItem) => {
    const buttonStyle = {
      background: 'transparent',
      border: '1px solid var(--glass-border)',
      color: 'var(--text-primary)',
      fontWeight: 600,
      fontSize: '0.78rem',
      cursor: 'pointer',
      padding: '6px 10px',
      borderRadius: '6px',
    };

    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
        {post.status === 'review' && (
          <>
            <button onClick={() => onApprove(post)} style={{ ...buttonStyle, color: '#34d399', borderColor: 'rgba(52, 211, 153, 0.35)' }}>
              승인
            </button>
            <button onClick={() => onOpenRejectModal(post)} style={{ ...buttonStyle, color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.35)' }}>
              반려
            </button>
          </>
        )}
        {(post.status === 'rejected' || post.status === 'archived') && (
          <button onClick={() => onRestoreDraft(post)} style={buttonStyle}>
            초안 복귀
          </button>
        )}
        {post.status === 'published' && (
          <button onClick={() => onArchive(post)} style={{ ...buttonStyle, color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.35)' }}>
            보관
          </button>
        )}
        {currentUser?.is_superuser && (
          <button onClick={() => onDelete(post.id)} style={{ background: 'transparent', border: 'none', color: '#f87171', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', padding: '6px 8px' }}>
            삭제
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead style={{ background: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-secondary)' }}>
              <tr>
                <th style={{ padding: '1rem', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--glass-border)' }}>ID / Site</th>
                <th style={{ padding: '1rem', fontWeight: 600, minWidth: '360px', borderBottom: '1px solid var(--glass-border)' }}>Title</th>
                <th style={{ padding: '1rem', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--glass-border)' }}>Status</th>
                <th style={{ padding: '1rem', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--glass-border)' }}>Created</th>
                <th style={{ padding: '1rem', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap', borderBottom: '1px solid var(--glass-border)' }}>Summary</th>
                <th style={{ padding: '1rem', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap', borderBottom: '1px solid var(--glass-border)' }}>Related</th>
                <th style={{ padding: '1rem', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid var(--glass-border)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    현재 조건에 맞는 게시글이 없습니다.
                  </td>
                </tr>
              ) : (
                posts.map((post) => {
                  const workflowMeta = renderWorkflowMeta(post);
                  return (
                    <tr key={post.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <td style={{ padding: '1rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>#{post.id}</div>
                        <div style={{ fontSize: '0.85rem', marginTop: '4px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={post.site || ''}>
                          {post.site || '-'}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                        <a href={post.source_url || '#'} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={post.title}>
                          {post.title}
                        </a>
                        {workflowMeta && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                            {workflowMeta}
                          </div>
                        )}
                        {post.rejection_reason && (
                          <div style={{ fontSize: '0.8rem', color: '#fda4af', marginTop: '6px' }}>
                            사유: {post.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '1rem', verticalAlign: 'top' }}>{renderStatusBadge(post.status)}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                        {new Date(post.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                        <button
                          onClick={() => onToggleSummarize(post)}
                          style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', border: post.is_summarized ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid var(--glass-border)', background: post.is_summarized ? 'rgba(14, 165, 233, 0.1)' : 'transparent', color: post.is_summarized ? 'var(--accent-primary)' : 'var(--text-secondary)', transition: 'all 0.2s' }}
                        >
                          {post.is_summarized ? '완료' : '대기'}
                        </button>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                        {post.related_count > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', fontSize: '0.75rem' }}>
                            +{post.related_count}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', verticalAlign: 'top' }}>{renderActions(post)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          페이지 {page} / {totalPages}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-outline" onClick={onPrevPage} disabled={page <= 1 || loading}>
            이전
          </button>
          <button className="btn btn-outline" onClick={onNextPage} disabled={page >= totalPages || loading}>
            다음
          </button>
        </div>
      </div>
    </>
  );
}
