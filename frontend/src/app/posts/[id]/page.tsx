"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { fetchPost, getStoredAccessToken, type Post, type PostStatus } from '@/lib/api';
import PostComments from '@/components/PostComments';
import PostSidebar from '@/components/PostSidebar';
import PostSummary from '@/components/PostSummary';

const STATUS_STYLES: Record<PostStatus, { label: string; color: string; background: string; border: string }> = {
    draft: { label: 'Draft', color: '#cbd5e1', background: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)' },
    review: { label: 'Review', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.35)' },
    rejected: { label: 'Rejected', color: '#fb7185', background: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.35)' },
    published: { label: 'Published', color: '#34d399', background: 'rgba(52, 211, 153, 0.12)', border: 'rgba(52, 211, 153, 0.35)' },
    archived: { label: 'Archived', color: '#94a3b8', background: 'rgba(71, 85, 105, 0.18)', border: 'rgba(148, 163, 184, 0.25)' },
};

export default function PostDetailPage() {
    const params = useParams<{ id: string }>();
    const postId = params?.id;
    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!postId) {
            return;
        }

        const includeAuth = Boolean(getStoredAccessToken());

        fetchPost(postId, includeAuth).then((data) => {
            if (!data) {
                setNotFound(true);
                setLoading(false);
                return;
            }
            setPost(data);
            setLoading(false);
        });
    }, [postId]);

    if (!postId) {
        return (
            <div className="container" style={{ maxWidth: '760px', margin: '80px auto', textAlign: 'center', display: 'grid', gap: '1rem' }}>
                <h1 style={{ margin: 0, color: 'var(--text-primary)' }}>게시글을 찾을 수 없습니다.</h1>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                    잘못된 주소이거나 접근할 수 없는 게시글입니다.
                </p>
                <div>
                    <Link href="/" className="btn btn-outline">홈으로 이동</Link>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                Loading post...
            </div>
        );
    }

    if (notFound || !post) {
        return (
            <div className="container" style={{ maxWidth: '760px', margin: '80px auto', textAlign: 'center', display: 'grid', gap: '1rem' }}>
                <h1 style={{ margin: 0, color: 'var(--text-primary)' }}>게시글을 찾을 수 없습니다.</h1>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                    비공개 게시글이거나 접근 권한이 없는 게시글일 수 있습니다.
                </p>
                <div>
                    <Link href="/" className="btn btn-outline">홈으로 이동</Link>
                </div>
            </div>
        );
    }

    const statusStyle = STATUS_STYLES[post.status];

    return (
        <div className="container" style={{ maxWidth: '1200px', margin: '40px auto' }}>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 700px', minWidth: 0 }}>
                    <article className="glass-panel" style={{ padding: '3rem 2rem' }}>
                            <header style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '2rem', marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ background: 'var(--accent-primary)', color: 'white', padding: '4px 12px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
                                            {post.category_name || 'Uncategorized'}
                                        </span>
                                        <span style={{ color: statusStyle.color, background: statusStyle.background, border: `1px solid ${statusStyle.border}`, padding: '4px 12px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
                                            {statusStyle.label}
                                        </span>
                                    </div>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                        {post.published_at
                                            ? `${new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} (Published)`
                                            : new Date(post.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </span>
                                </div>

                                <h1 style={{ fontSize: '2.5rem', color: 'var(--text-primary)', marginBottom: '1.5rem', lineHeight: 1.2 }}>
                                    {post.title}
                                </h1>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                                        {post.author?.username ? post.author.username.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{post.author?.username || 'Unknown Researcher'}</div>
                                        <div style={{ fontSize: '0.85rem' }}>Security Analyst</div>
                                    </div>
                                </div>

                                {(post.status === 'review' || post.status === 'rejected' || post.status === 'archived') && (
                                    <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                                        {post.status === 'review' && (
                                            <div>
                                                This post is in the review queue.
                                                {post.approval_requested_at ? ` Requested on ${new Date(post.approval_requested_at).toLocaleString()}.` : ''}
                                            </div>
                                        )}
                                        {post.status === 'rejected' && (
                                            <div>
                                                This post was rejected.
                                                {post.rejected_at ? ` Rejected on ${new Date(post.rejected_at).toLocaleString()}.` : ''}
                                                {post.rejection_reason ? ` Reason: ${post.rejection_reason}` : ''}
                                            </div>
                                        )}
                                        {post.status === 'archived' && (
                                            <div>
                                                This post is archived.
                                                {post.archived_at ? ` Archived on ${new Date(post.archived_at).toLocaleString()}.` : ''}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </header>

                            <section
                                className="post-content"
                                style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.7 }}
                                dangerouslySetInnerHTML={{ __html: post.content }}
                            >
                            </section>

                            {post.iocs && post.iocs.length > 0 && (
                                <div style={{ marginTop: '2.5rem', padding: '1.5rem', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px' }}>
                                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        Extracted References (IoC / Links)
                                        <span style={{ background: '#3b82f6', color: 'white', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px' }}>{post.iocs.length}</span>
                                    </h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {post.iocs.map((ioc, idx) => (
                                            <span key={idx} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--accent-primary)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                                                {ioc}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {post.cve_mentions && post.cve_mentions.length > 0 && (
                                <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.18)', borderRadius: '12px' }}>
                                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        Related CVEs
                                        <span style={{ background: '#ef4444', color: 'white', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px' }}>
                                            {post.cve_mentions.length}
                                        </span>
                                    </h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem' }}>
                                        {post.cve_mentions.map((mention) => (
                                            <div
                                                key={mention.id}
                                                style={{
                                                    padding: '0.9rem',
                                                    borderRadius: '10px',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    background: 'rgba(255,255,255,0.03)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '0.35rem',
                                                }}
                                            >
                                                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{mention.cve_id}</div>
                                                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                                                    <span>위치: {mention.mentioned_in}</span>
                                                    {mention.severity && <span>심각도: {mention.severity}</span>}
                                                    {typeof mention.cvss_score === 'number' && <span>CVSS {mention.cvss_score.toFixed(1)}</span>}
                                                </div>
                                                {(mention.vendor || mention.product) && (
                                                    <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                                                        {[mention.vendor, mention.product].filter(Boolean).join(' / ')}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {post.category_name?.toLowerCase() === 'news' && (
                                <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
                                    <PostSummary
                                        postId={post.id}
                                        isSummarizedInitial={post.is_summarized}
                                        summaryInitial={post.summary}
                                        authorUsername={post.author?.username || ''}
                                    />
                                </div>
                            )}

                            {post.related_posts_list && post.related_posts_list.length > 0 && (
                                <div style={{ marginTop: '2rem', marginBottom: '2rem', padding: '1.5rem', background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '12px' }}>
                                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        Related Coverage
                                        <span style={{ background: '#8b5cf6', color: 'white', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px' }}>{post.related_posts_list.length}</span>
                                    </h3>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                        {post.related_posts_list.map((related) => (
                                            <li key={related.id}>
                                                <Link href={`/posts/${related.id}`} style={{ textDecoration: 'none', display: 'block', padding: '1rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', transition: 'border-color 0.2s', backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(139,92,246,0.05), transparent 30%)' }}>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-secondary)', marginBottom: '4px', fontWeight: 600 }}>{related.site || 'Unknown Source'}</div>
                                                    <div style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '6px' }}>{related.title}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                        {new Date(related.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                        <PostComments postId={post.id} initialComments={post.comments} />
                    </article>
                </div>

                <div style={{ flex: '0 0 320px', width: '320px', position: 'sticky', top: '6rem' }}>
                    <PostSidebar post={post} />
                </div>
            </div>
        </div>
    );
}
