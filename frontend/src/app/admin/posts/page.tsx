'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

import {
    approvePost,
    archivePost,
    deletePost,
    fetchAdminPosts,
    fetchProfile,
    rejectPost,
    restorePostToDraft,
    updatePost,
    type AuthUser,
    type AdminPostListItem,
    type PostStatus,
} from '@/lib/api';

const PAGE_SIZE = 50;

const STATUS_STYLES: Record<PostStatus, { label: string; color: string; background: string; border: string }> = {
    draft: { label: 'Draft', color: '#cbd5e1', background: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)' },
    review: { label: 'Review', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.35)' },
    rejected: { label: 'Rejected', color: '#fb7185', background: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.35)' },
    published: { label: 'Published', color: '#34d399', background: 'rgba(52, 211, 153, 0.12)', border: 'rgba(52, 211, 153, 0.35)' },
    archived: { label: 'Archived', color: '#94a3b8', background: 'rgba(71, 85, 105, 0.18)', border: 'rgba(148, 163, 184, 0.25)' },
};

export default function AdminPostsPage() {
    const [posts, setPosts] = useState<AdminPostListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [siteFilter, setSiteFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<PostStatus | ''>('');
    const [sites, setSites] = useState<string[]>([]);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [rejectingPost, setRejectingPost] = useState<AdminPostListItem | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [submittingRejection, setSubmittingRejection] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
    const router = useRouter();

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    const loadPosts = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetchAdminPosts(undefined, search, siteFilter, undefined, undefined, statusFilter, page, PAGE_SIZE);
            setPosts(response.results);
            setSites(response.site_options);
            setTotalCount(response.count);
        } catch {
            toast.error('게시글 목록을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, [page, search, siteFilter, statusFilter]);

    useEffect(() => {
        const init = async () => {
            try {
                const user = await fetchProfile();
                if (!user.is_staff) {
                    router.push('/');
                    return;
                }
                setCurrentUser(user);
                setIsAuthorized(true);
            } catch {
                router.push('/login');
            }
        };

        void init();
    }, [router, loadPosts]);

    const handleSearch = (event: React.FormEvent) => {
        event.preventDefault();
        setPage(1);
        if (page === 1) {
            void loadPosts();
        }
    };

    useEffect(() => {
        if (!isAuthorized) {
            return;
        }
        void loadPosts();
    }, [isAuthorized, loadPosts]);

    const handleToggleSummarize = async (post: AdminPostListItem) => {
        try {
            const updated = await updatePost(post.id, { is_summarized: !post.is_summarized });
            setPosts((current) => current.map((item) => (item.id === updated.id ? { ...item, is_summarized: updated.is_summarized } : item)));
            toast.success('요약 상태를 변경했습니다.');
        } catch {
            toast.error('요약 상태를 변경하지 못했습니다.');
        }
    };

    const handleWorkflowAction = async (action: () => Promise<void>, successMessage: string, errorMessage: string) => {
        try {
            await action();
            toast.success(successMessage);
            await loadPosts();
        } catch {
            toast.error(errorMessage);
        }
    };

    const confirmDelete = (id: number) => {
        toast((toastInstance) => (
            <div>
                <p style={{ margin: '0 0 12px 0', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                    이 게시글을 삭제할까요?
                </p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => toast.dismiss(toastInstance.id)} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                        취소
                    </button>
                    <button
                        onClick={async () => {
                            toast.dismiss(toastInstance.id);
                            try {
                                await deletePost(id);
                                toast.success('게시글을 삭제했습니다.');
                                await loadPosts();
                            } catch {
                                toast.error('게시글 삭제에 실패했습니다.');
                            }
                        }}
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.85rem', background: '#ef4444', color: 'white', borderColor: '#ef4444' }}
                    >
                        삭제
                    </button>
                </div>
            </div>
        ), { duration: Infinity });
    };

    const openRejectModal = (post: AdminPostListItem) => {
        setRejectingPost(post);
        setRejectionReason(post.rejection_reason ?? '');
    };

    const closeRejectModal = (force = false) => {
        if (submittingRejection && !force) {
            return;
        }
        setRejectingPost(null);
        setRejectionReason('');
    };

    const handleRejectSubmit = async () => {
        if (!rejectingPost) {
            return;
        }

        setSubmittingRejection(true);
        try {
            await rejectPost(rejectingPost.id, rejectionReason.trim());
            toast.success('게시글을 반려했습니다.');
            closeRejectModal(true);
            await loadPosts();
        } catch {
            toast.error('게시글 반려에 실패했습니다.');
        } finally {
            setSubmittingRejection(false);
        }
    };

    const renderStatusBadge = (status: PostStatus) => {
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
    };

    const renderWorkflowMeta = (post: AdminPostListItem) => {
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
    };

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
                        <button
                            onClick={() => void handleWorkflowAction(() => approvePost(post.id).then(() => undefined), '게시글을 승인했습니다.', '게시글 승인에 실패했습니다.')}
                            style={{ ...buttonStyle, color: '#34d399', borderColor: 'rgba(52, 211, 153, 0.35)' }}
                        >
                            승인
                        </button>
                        <button
                            onClick={() => openRejectModal(post)}
                            style={{ ...buttonStyle, color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.35)' }}
                        >
                            반려
                        </button>
                    </>
                )}
                {(post.status === 'rejected' || post.status === 'archived') && (
                    <button
                        onClick={() => void handleWorkflowAction(() => restorePostToDraft(post.id).then(() => undefined), '초안으로 되돌렸습니다.', '초안 복귀에 실패했습니다.')}
                        style={buttonStyle}
                    >
                        초안 복귀
                    </button>
                )}
                {post.status === 'published' && (
                    <button
                        onClick={() => void handleWorkflowAction(() => archivePost(post.id).then(() => undefined), '게시글을 보관했습니다.', '보관에 실패했습니다.')}
                        style={{ ...buttonStyle, color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.35)' }}
                    >
                        보관
                    </button>
                )}
                {currentUser?.is_superuser && <button
                    onClick={() => confirmDelete(post.id)}
                    style={{ background: 'transparent', border: 'none', color: '#f87171', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', padding: '6px 8px' }}
                >
                    삭제
                </button>}
            </div>
        );
    };

    if (loading && posts.length === 0) {
        return <div className="p-8 text-center text-[var(--text-secondary)]">게시글을 불러오는 중입니다...</div>;
    }

    return (
        <div className="container" style={{ padding: '2rem 24px', maxWidth: '1280px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>게시글 워크플로우</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                        총 {totalCount.toLocaleString()}건 중 {Math.min((page - 1) * PAGE_SIZE + 1, totalCount || 1)}-{Math.min(page * PAGE_SIZE, totalCount)}건을 보고 있습니다.
                    </p>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', width: '100%', flexWrap: 'wrap' }}>
                    <input
                        type="text"
                        value={search}
                        onChange={(event) => {
                            setSearch(event.target.value);
                            setPage(1);
                        }}
                        placeholder="제목 또는 본문 검색"
                        style={{ flex: '1 1 260px', padding: '0.6rem 1rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem' }}
                    />
                    <select
                        value={siteFilter}
                        onChange={(event) => {
                            setSiteFilter(event.target.value);
                            setPage(1);
                        }}
                        style={{ padding: '0.6rem 1rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem', width: '180px' }}
                    >
                        <option value="">모든 사이트</option>
                        {sites.map((site) => <option key={site} value={site}>{site}</option>)}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(event) => {
                            setStatusFilter(event.target.value as PostStatus | '');
                            setPage(1);
                        }}
                        style={{ padding: '0.6rem 1rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem', width: '180px' }}
                    >
                        <option value="">모든 상태</option>
                        <option value="draft">Draft</option>
                        <option value="review">Review</option>
                        <option value="rejected">Rejected</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                    </select>
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem' }}>
                        적용
                    </button>
                </form>
            </div>

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
                                                <a
                                                    href={post.source_url || '#'}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                                                    title={post.title}
                                                >
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
                                            <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                                                {renderStatusBadge(post.status)}
                                            </td>
                                            <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                                                {new Date(post.created_at).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                                                <button
                                                    onClick={() => void handleToggleSummarize(post)}
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
                                            <td style={{ padding: '1rem', textAlign: 'right', verticalAlign: 'top' }}>
                                                {renderActions(post)}
                                            </td>
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
                    <button
                        className="btn btn-outline"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page <= 1 || loading}
                    >
                        이전
                    </button>
                    <button
                        className="btn btn-outline"
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        disabled={page >= totalPages || loading}
                    >
                        다음
                    </button>
                </div>
            </div>

            {rejectingPost && (
                <div
                    onClick={() => closeRejectModal()}
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
                                onClick={() => closeRejectModal()}
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
                            onChange={(event) => setRejectionReason(event.target.value)}
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
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => closeRejectModal()}
                                    disabled={submittingRejection}
                                >
                                    취소
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => void handleRejectSubmit()}
                                    disabled={submittingRejection}
                                    style={{ minWidth: '140px' }}
                                >
                                    {submittingRejection ? '반려 중...' : '반려 확정'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
