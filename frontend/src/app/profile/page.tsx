"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    fetchMyPosts,
    fetchProfile,
    getErrorMessage,
    hasClientSession,
    restorePostToDraft,
    submitPostForReview,
    type AuthUser,
    type Post,
    type PostStatus,
    updateProfile,
} from '@/lib/api';

const STATUS_STYLES: Record<PostStatus, { label: string; color: string; background: string; border: string }> = {
    draft: { label: 'Draft', color: '#cbd5e1', background: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)' },
    review: { label: 'Review', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.35)' },
    rejected: { label: 'Rejected', color: '#fb7185', background: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.35)' },
    published: { label: 'Published', color: '#34d399', background: 'rgba(52, 211, 153, 0.12)', border: 'rgba(52, 211, 153, 0.35)' },
    archived: { label: 'Archived', color: '#94a3b8', background: 'rgba(71, 85, 105, 0.18)', border: 'rgba(148, 163, 184, 0.25)' },
};

export default function ProfilePage() {
    const router = useRouter();
    const [profile, setProfile] = useState<AuthUser>({ id: 0, username: '', email: '', is_staff: false, is_superuser: false });
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all');
    const [workflowBusyId, setWorkflowBusyId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const loadProfileData = useCallback(async () => {
        const [profileData, postData] = await Promise.all([fetchProfile(), fetchMyPosts()]);
        setProfile(profileData);
        setPosts(postData);
    }, []);

    useEffect(() => {
        if (!hasClientSession()) {
            router.push('/login');
            return;
        }

        loadProfileData()
            .then(() => setLoading(false))
            .catch((requestError: unknown) => {
                setError(getErrorMessage(requestError, 'Failed to load profile data.'));
                setLoading(false);
            });
    }, [loadProfileData, router]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        try {
            await updateProfile({ username: profile.username, email: profile.email });
            setSuccess('Profile updated successfully.');
            router.refresh();
        } catch (updateError: unknown) {
            setError(getErrorMessage(updateError, 'Failed to update profile.'));
        }
    };

    const handleWorkflowAction = async (postId: number, action: 'submit' | 'restore') => {
        setError('');
        setSuccess('');
        setWorkflowBusyId(postId);

        try {
            if (action === 'submit') {
                await submitPostForReview(postId);
                setSuccess('Post submitted for review.');
            } else {
                await restorePostToDraft(postId);
                setSuccess('Post restored to draft.');
            }
            await loadProfileData();
        } catch (workflowError: unknown) {
            setError(
                getErrorMessage(
                    workflowError,
                    action === 'submit' ? 'Failed to submit the post for review.' : 'Failed to restore the post to draft.',
                ),
            );
        } finally {
            setWorkflowBusyId(null);
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

    const postCounts = useMemo(
        () => ({
            all: posts.length,
            draft: posts.filter((post) => post.status === 'draft').length,
            review: posts.filter((post) => post.status === 'review').length,
            rejected: posts.filter((post) => post.status === 'rejected').length,
            published: posts.filter((post) => post.status === 'published').length,
            archived: posts.filter((post) => post.status === 'archived').length,
        }),
        [posts],
    );

    const filteredPosts = useMemo(
        () => (statusFilter === 'all' ? posts : posts.filter((post) => post.status === statusFilter)),
        [posts, statusFilter],
    );

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading profile...</div>;
    }

    return (
        <div className="container" style={{ maxWidth: '960px', margin: '40px auto', display: 'grid', gap: '24px' }}>
            <div className="glass-panel">
                <h2 style={{ marginBottom: '2rem' }}>My Profile</h2>
                {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}
                {success && <div style={{ color: 'var(--accent-secondary)', marginBottom: '1rem' }}>{success}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>User ID</label>
                        <input
                            type="text"
                            value={profile.id || ''}
                            disabled
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontSize: '1rem', cursor: 'not-allowed' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Username</label>
                        <input
                            type="text"
                            value={profile.username}
                            onChange={(event) => setProfile({ ...profile, username: event.target.value })}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem' }}
                            required
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Email</label>
                        <input
                            type="email"
                            value={profile.email}
                            onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem' }}
                            required
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem', width: '100%' }}>
                            Update Information
                        </button>
                    </div>
                </form>
            </div>

            <div className="glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                        <h3 style={{ marginBottom: '0.35rem' }}>My Posts</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                            Review status, rejection reason, and quick workflow actions for your posts.
                        </p>
                    </div>
                    <Link href="/create-post" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                        Create Post
                    </Link>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    {[
                        { key: 'all', label: 'All', count: postCounts.all },
                        { key: 'draft', label: 'Draft', count: postCounts.draft },
                        { key: 'review', label: 'Review', count: postCounts.review },
                        { key: 'rejected', label: 'Rejected', count: postCounts.rejected },
                        { key: 'published', label: 'Published', count: postCounts.published },
                        { key: 'archived', label: 'Archived', count: postCounts.archived },
                    ].map((item) => {
                        const active = statusFilter === item.key;
                        return (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => setStatusFilter(item.key as PostStatus | 'all')}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '0.55rem 0.85rem',
                                    borderRadius: '999px',
                                    border: active ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid var(--glass-border)',
                                    background: active ? 'rgba(14, 165, 233, 0.12)' : 'rgba(255,255,255,0.02)',
                                    color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.82rem',
                                }}
                            >
                                <span>{item.label}</span>
                                <span style={{ color: 'var(--text-primary)' }}>{item.count}</span>
                            </button>
                        );
                    })}
                </div>

                <div style={{ display: 'grid', gap: '12px' }}>
                    {filteredPosts.length === 0 ? (
                        <div style={{ color: 'var(--text-secondary)', padding: '1rem 0' }}>
                            {posts.length === 0 ? 'You have not created any posts yet.' : 'No posts match the selected status.'}
                        </div>
                    ) : (
                        filteredPosts.map((post) => (
                            <div
                                key={post.id}
                                style={{
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '12px',
                                    padding: '1rem',
                                    background: 'rgba(255,255,255,0.02)',
                                    display: 'grid',
                                    gap: '10px',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'grid', gap: '6px' }}>
                                        <Link
                                            href={`/posts/${post.id}`}
                                            style={{ color: 'var(--text-primary)', textDecoration: 'none', fontSize: '1rem', fontWeight: 600 }}
                                        >
                                            {post.title}
                                        </Link>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                            {post.category_name || 'Uncategorized'} / {new Date(post.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                    {renderStatusBadge(post.status)}
                                </div>
                                {post.status === 'review' && post.approval_requested_at && (
                                    <div style={{ color: '#fbbf24', fontSize: '0.84rem' }}>
                                        Waiting for review since {new Date(post.approval_requested_at).toLocaleString()}.
                                    </div>
                                )}
                                {post.status === 'rejected' && (
                                    <div style={{ color: '#fda4af', fontSize: '0.84rem' }}>
                                        {post.rejection_reason ? `Rejected: ${post.rejection_reason}` : 'Rejected without a reason.'}
                                    </div>
                                )}
                                {post.status === 'published' && post.approved_at && (
                                    <div style={{ color: '#86efac', fontSize: '0.84rem' }}>
                                        Approved {new Date(post.approved_at).toLocaleString()}
                                        {post.approved_by_name ? ` by ${post.approved_by_name}` : ''}
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap', paddingTop: '4px' }}>
                                    <Link href={`/posts/${post.id}`} style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 600 }}>
                                        Open detail
                                    </Link>
                                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                        {(post.status === 'draft' || post.status === 'rejected') && (
                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                disabled={workflowBusyId === post.id}
                                                onClick={() => void handleWorkflowAction(post.id, 'submit')}
                                                style={{ padding: '0.5rem 0.9rem' }}
                                            >
                                                {workflowBusyId === post.id ? 'Submitting...' : 'Submit for Review'}
                                            </button>
                                        )}
                                        {(post.status === 'review' || post.status === 'archived') && (
                                            <button
                                                type="button"
                                                className="btn btn-outline"
                                                disabled={workflowBusyId === post.id}
                                                onClick={() => void handleWorkflowAction(post.id, 'restore')}
                                                style={{ padding: '0.5rem 0.9rem' }}
                                            >
                                                {workflowBusyId === post.id ? 'Restoring...' : 'Restore Draft'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
