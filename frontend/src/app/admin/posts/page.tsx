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
import AdminPostsTable from './AdminPostsTable';
import RejectPostModal from './RejectPostModal';

const PAGE_SIZE = 50;

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

            <AdminPostsTable
                posts={posts}
                loading={loading}
                page={page}
                totalPages={totalPages}
                currentUser={currentUser}
                onToggleSummarize={(post) => void handleToggleSummarize(post)}
                onApprove={(post) => void handleWorkflowAction(() => approvePost(post.id).then(() => undefined), '게시글을 승인했습니다.', '게시글 승인에 실패했습니다.')}
                onOpenRejectModal={openRejectModal}
                onRestoreDraft={(post) => void handleWorkflowAction(() => restorePostToDraft(post.id).then(() => undefined), '초안으로 되돌렸습니다.', '초안 복귀에 실패했습니다.')}
                onArchive={(post) => void handleWorkflowAction(() => archivePost(post.id).then(() => undefined), '게시글을 보관했습니다.', '보관에 실패했습니다.')}
                onDelete={confirmDelete}
                onPrevPage={() => setPage((current) => Math.max(1, current - 1))}
                onNextPage={() => setPage((current) => Math.min(totalPages, current + 1))}
            />

            <RejectPostModal
                rejectingPost={rejectingPost}
                rejectionReason={rejectionReason}
                submittingRejection={submittingRejection}
                onClose={closeRejectModal}
                onReasonChange={setRejectionReason}
                onSubmit={() => void handleRejectSubmit()}
            />
        </div>
    );
}
