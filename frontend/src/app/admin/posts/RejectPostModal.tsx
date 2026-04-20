import type { AdminPostListItem } from '@/lib/api';

export default function RejectPostModal({
  rejectingPost,
  rejectionReason,
  submittingRejection,
  onClose,
  onReasonChange,
  onSubmit,
}: {
  rejectingPost: AdminPostListItem | null;
  rejectionReason: string;
  submittingRejection: boolean;
  onClose: (force?: boolean) => void;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
}) {
  if (!rejectingPost) {
    return null;
  }

  return (
    <div
      onClick={() => onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        zIndex: 1000,
      }}
    >
      <div
        className="glass-panel"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '1.5rem',
          borderRadius: '16px',
          boxShadow: '0 24px 80px rgba(15, 23, 42, 0.45)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>게시글 반려</h2>
            <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              작성자에게 전달할 반려 사유를 입력해 주세요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            disabled={submittingRejection}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '1.4rem',
              lineHeight: 1,
              cursor: submittingRejection ? 'not-allowed' : 'pointer',
              padding: 0,
            }}
            aria-label="Close rejection dialog"
          >
            ×
          </button>
        </div>

        <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--glass-border)', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>대상 게시글</div>
          <div style={{ fontWeight: 600, lineHeight: 1.5 }}>{rejectingPost.title}</div>
        </div>

        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
          반려 사유
        </label>
        <textarea
          value={rejectionReason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder="수정이 필요한 내용을 입력해 주세요."
          rows={6}
          disabled={submittingRejection}
          style={{
            width: '100%',
            resize: 'vertical',
            minHeight: '140px',
            padding: '0.9rem 1rem',
            borderRadius: '12px',
            border: '1px solid var(--glass-border)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            outline: 'none',
            fontSize: '0.92rem',
            lineHeight: 1.6,
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            비워둘 수는 있지만, 사유를 적어 두는 편이 수정에 도움이 됩니다.
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="btn btn-outline" onClick={() => onClose()} disabled={submittingRejection}>
              취소
            </button>
            <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={submittingRejection} style={{ minWidth: '140px' }}>
              {submittingRejection ? '반려 중...' : '반려 확정'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
