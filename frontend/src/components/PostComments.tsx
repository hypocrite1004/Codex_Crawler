"use client";
import { useState, useEffect } from 'react';
import { addComment, Comment, updateComment, deleteComment, fetchProfile, type AuthUser, getErrorMessage } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import type { ReactQuillProps } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic<ReactQuillProps>(() => import('react-quill-new').then((mod) => mod.default), {
    ssr: false,
    loading: () => <p style={{ color: 'var(--text-secondary)' }}>Loading editor...</p>,
});

export default function PostComments({ postId, initialComments }: { postId: number, initialComments: Comment[] }) {
    const [comments, setComments] = useState<Comment[]>(initialComments || []);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
    const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
    const [editContent, setEditContent] = useState('');
    const router = useRouter();

    useEffect(() => {
        setComments(initialComments || []);
    }, [initialComments]);

    useEffect(() => {
        fetchProfile().then(user => setCurrentUser(user)).catch(() => { });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanContent = newComment.replace(/(<([^>]+)>)/gi, "").trim();
        if (!cleanContent) return;
        setLoading(true);
        try {
            const comment = await addComment(postId, newComment);
            setComments([...comments, comment]);
            setNewComment('');
            router.refresh();
            toast.success('Comment posted successfully!');
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Failed to add comment. Please log in.'));
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (comment: Comment) => {
        setEditingCommentId(comment.id);
        setEditContent(comment.content);
    };

    const handleUpdateComment = async (commentId: number) => {
        const cleanContent = editContent.replace(/(<([^>]+)>)/gi, "").trim();
        if (!cleanContent) return;
        setLoading(true);
        try {
            const updated = await updateComment(commentId, editContent);
            setComments(comments.map(c => c.id === commentId ? updated : c));
            setEditingCommentId(null);
            router.refresh(); // Tells Next.js to fetch new Server Components
            toast.success('Comment updated successfully!');
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Failed to update comment'));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteComment = async (commentId: number) => {
        toast((t) => (
            <div>
                <p style={{ margin: '0 0 12px 0', fontWeight: 'bold' }}>Are you sure you want to delete this comment?</p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => toast.dismiss(t.id)} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Cancel</button>
                    <button onClick={async () => {
                        toast.dismiss(t.id);
                        setLoading(true);
                        try {
                            await deleteComment(commentId);
                            setComments(prev => prev.filter(c => c.id !== commentId));
                            router.refresh(); // Tells Next.js to fetch new Server Components
                            toast.success('Comment deleted successfully!');
                        } catch (error: unknown) {
                            toast.error(getErrorMessage(error, 'Failed to delete comment'));
                        } finally {
                            setLoading(false);
                        }
                    }} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem', background: '#ef4444', color: 'white', borderColor: '#ef4444' }}>Delete</button>
                </div>
            </div>
        ), { duration: Infinity, style: { minWidth: '300px' } });
    };

    return (
        <div style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid var(--glass-border)' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Discussion ({comments.length})</h3>

            {currentUser ? (
                <form onSubmit={handleSubmit} style={{ marginBottom: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="quill-dark-theme-wrapper" style={{ borderRadius: '4px' }}>
                        <ReactQuill
                            theme="snow"
                            value={newComment}
                            onChange={setNewComment}
                            style={{ minHeight: '350px' }}
                            placeholder="Share your thoughts on this intel..."
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" disabled={loading} className="btn btn-primary">
                            {loading ? 'Posting...' : 'Post Comment'}
                        </button>
                    </div>
                </form>
            ) : (
                <div style={{ marginBottom: '2rem', padding: '1rem 1.2rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                    댓글 작성은 로그인 후 가능합니다. <Link href="/login" style={{ color: 'var(--accent-primary)' }}>로그인</Link>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {comments.map((comment) => (
                    <div key={comment.id} style={{ padding: '1.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--border-color)", display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                                    {comment.author?.username ? comment.author.username.charAt(0).toUpperCase() : '?'}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{comment.author?.username || 'Unknown'}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(comment.created_at).toLocaleString()}</div>
                                </div>
                            </div>

                            {currentUser?.username === comment.author?.username && !editingCommentId && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => handleEditClick(comment)} className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>Edit</button>
                                    <button onClick={() => handleDeleteComment(comment.id)} className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '0.8rem', color: '#ef4444', borderColor: '#ef4444' }}>Delete</button>
                                </div>
                            )}
                        </div>

                        {editingCommentId === comment.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                                <div className="quill-dark-theme-wrapper" style={{ borderRadius: '4px' }}>
                                    <ReactQuill theme="snow" value={editContent} onChange={setEditContent} style={{ minHeight: '150px' }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    <button onClick={() => setEditingCommentId(null)} className="btn btn-outline">Cancel</button>
                                    <button onClick={() => handleUpdateComment(comment.id)} disabled={loading} className="btn btn-primary">Save Changes</button>
                                </div>
                            </div>
                        ) : (
                            <div
                                className="post-content"
                                style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}
                                dangerouslySetInnerHTML={{ __html: comment.content }}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
