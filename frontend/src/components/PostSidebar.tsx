"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { type Post, toggleSharePost, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

export default function PostSidebar({ post }: { post: Post }) {
    const router = useRouter();
    const [isShared, setIsShared] = useState(post.is_shared);
    const [shareLoading, setShareLoading] = useState(false);

    const handleCopyContent = async () => {
        try {
            await navigator.clipboard.writeText(post.content);
            toast.success("본문 내용을 클립보드에 복사했습니다.");
        } catch {
            toast.error("복사에 실패했습니다.");
        }
    };

    const handleCopySourceUrl = async () => {
        if (!post.source_url) {
            return;
        }

        try {
            await navigator.clipboard.writeText(post.source_url);
            toast.success("원본 링크를 클립보드에 복사했습니다.");
        } catch {
            toast.error("복사에 실패했습니다.");
        }
    };

    const handleShare = async () => {
        setShareLoading(true);
        try {
            const newShareState = await toggleSharePost(post.id);
            setIsShared(newShareState);
            router.refresh();
            toast.success(newShareState ? "게시물을 공유 상태로 변경했습니다." : "공유를 취소했습니다.");
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "게시물 공유에 실패했습니다."));
        } finally {
            setShareLoading(false);
        }
    };

    return (
        <aside style={{ position: 'sticky', top: '100px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <button onClick={() => router.push('/')} className="btn btn-outline" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                &larr; Back to Dashboard
            </button>

            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>Actions</h3>

                <button
                    onClick={handleShare}
                    disabled={shareLoading}
                    className={`btn ${isShared ? 'btn-primary' : 'btn-outline'}`}
                    style={{ width: '100%' }}
                >
                    {shareLoading ? 'Processing...' : isShared ? 'Shared' : 'Share Article'}
                </button>

                {(post.source_url || post.site) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Source / Reference</div>

                        {post.site && (
                            <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', textAlign: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px', marginBottom: '0.5rem' }}>
                                출처: <strong>{post.site}</strong>
                            </div>
                        )}

                        {post.source_url ? (
                            <>
                                <a href={post.source_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ display: 'flex', justifyContent: 'center', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}>
                                    Go to Source
                                </a>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={handleCopySourceUrl} className="btn btn-outline" style={{ flex: 1, fontSize: '0.85rem', padding: '0.5rem' }}>
                                        Copy Link
                                    </button>
                                    <button onClick={handleCopyContent} className="btn btn-outline" style={{ flex: 1, fontSize: '0.85rem', padding: '0.5rem' }}>
                                        Copy Content
                                    </button>
                                </div>
                            </>
                        ) : (
                            <button onClick={handleCopyContent} className="btn btn-outline" style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem' }}>
                                Copy Content
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>Status</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Shared:</span>
                        <span style={{ color: isShared ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>{isShared ? 'Yes' : 'No'}</span>
                    </li>
                    <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>AI Summarized:</span>
                        <span style={{ color: post.is_summarized ? 'var(--accent-secondary)' : 'var(--text-secondary)' }}>{post.is_summarized ? 'Yes' : 'No'}</span>
                    </li>
                    <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Views:</span>
                        <span>{post.views}</span>
                    </li>
                </ul>
            </div>
        </aside>
    );
}
