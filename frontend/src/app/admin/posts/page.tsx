'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchProfile, fetchAdminPosts, deletePost, updatePost, type Post } from '@/lib/api';
import toast from 'react-hot-toast';

export default function AdminPostsPage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [siteFilter, setSiteFilter] = useState('');
    const [sites, setSites] = useState<string[]>([]);
    const router = useRouter();

    const loadPosts = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchAdminPosts(undefined, search, siteFilter);
            setPosts(data);

            // Extract unique sites for filter dropdown
            const uniqueSites = Array.from(new Set(data.map(p => p.site))).filter(Boolean);
            setSites(uniqueSites as string[]);
        } catch {
            toast.error('포스트 목록을 불러오는 데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    }, [search, siteFilter]);

    useEffect(() => {
        const init = async () => {
            try {
                const user = await fetchProfile();
                if (!user.is_staff) { router.push('/'); return; }
                await loadPosts();
            } catch { router.push('/login'); }
        };
        void init();
    }, [router, loadPosts]);

    // Trigger search when enter is pressed or button clicked
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        loadPosts();
    };

    const confirmDelete = (id: number) => {
        toast((t) => (
            <div>
                <p style={{ margin: '0 0 12px 0', fontWeight: 'bold', color: 'var(--text-primary)' }}>정말 이 게시물을 삭제하시겠습니까?</p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => toast.dismiss(t.id)} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>취소</button>
                    <button onClick={async () => {
                        toast.dismiss(t.id);
                        try {
                            await deletePost(id);
                            toast.success('게시물이 삭제되었습니다.');
                            setPosts(prev => prev.filter(p => p.id !== id));
                        } catch {
                            toast.error('삭제 권한이 없거나 오류가 발생했습니다.');
                        }
                    }} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem', background: '#ef4444', color: 'white', borderColor: '#ef4444' }}>삭제</button>
                </div>
            </div>
        ), { duration: Infinity });
    };

    const handleToggleSummarize = async (post: Post) => {
        try {
            const updated = await updatePost(post.id, { is_summarized: !post.is_summarized });
            setPosts(posts.map(p => p.id === updated.id ? updated : p));
            toast.success('요약 상태가 변경되었습니다.');
        } catch {
            toast.error('수정 권한이 없거나 오류가 발생했습니다.');
        }
    };

    if (loading && posts.length === 0) {
        return <div className="p-8 text-center text-[var(--text-secondary)]">데이터를 불러오는 중...</div>;
    }

    return (
        <div className="container" style={{ padding: '2rem 24px', maxWidth: '1200px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📝 게시물 통합 관리</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                        크롤링된 모든 기사 데이터를 조회하고 병합 전 상태까지 관리합니다.
                    </p>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="제목 또는 내용 검색..."
                        style={{
                            flex: 1, padding: '0.6rem 1rem', background: 'var(--bg-primary)',
                            border: '1px solid var(--glass-border)', borderRadius: '8px',
                            color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem'
                        }}
                    />
                    <select
                        value={siteFilter}
                        onChange={(e) => setSiteFilter(e.target.value)}
                        style={{
                            padding: '0.6rem 1rem', background: 'var(--bg-primary)',
                            border: '1px solid var(--glass-border)', borderRadius: '8px',
                            color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem', width: '200px'
                        }}
                    >
                        <option value="">모든 출처</option>
                        {sites.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem' }}>
                        검색 적용
                    </button>
                </form>
            </div>

            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <thead style={{ background: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-secondary)', borderBottom: '1px border-color' }}>
                            <tr>
                                <th style={{ padding: '1rem', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--glass-border)' }}>ID / 출처</th>
                                <th style={{ padding: '1rem', fontWeight: 600, minWidth: '400px', borderBottom: '1px solid var(--glass-border)' }}>제목</th>
                                <th style={{ padding: '1rem', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--glass-border)' }}>수집 일시</th>
                                <th style={{ padding: '1rem', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap', borderBottom: '1px solid var(--glass-border)' }}>요약 여부</th>
                                <th style={{ padding: '1rem', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap', borderBottom: '1px solid var(--glass-border)' }}>병합 (자식수)</th>
                                <th style={{ padding: '1rem', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid var(--glass-border)' }}>관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {posts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>게시물이 없습니다.</td>
                                </tr>
                            ) : (
                                posts.map(post => (
                                    <tr key={post.id} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                        <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                                            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>#{post.id}</div>
                                            <div style={{ fontSize: '0.85rem', marginTop: '4px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={post.site || ''}>{post.site}</div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <a href={post.source_url || '#'} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={post.title}>
                                                {post.title}
                                            </a>
                                            {post.related_count > 0 && (
                                                <div style={{ fontSize: '0.8rem', color: 'var(--accent-secondary)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span>↳</span> <span>병합된 하위 기사 {post.related_count}건 보유</span>
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                            {new Date(post.created_at).toLocaleString()}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            <button
                                                onClick={() => handleToggleSummarize(post)}
                                                style={{
                                                    padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                                    border: post.is_summarized ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid var(--glass-border)',
                                                    background: post.is_summarized ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                                                    color: post.is_summarized ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {post.is_summarized ? '요약 완료' : '미요약'}
                                            </button>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            {post.related_count > 0 ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', fontSize: '0.75rem' }}>
                                                    +{post.related_count}건
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>-</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            <button
                                                onClick={() => confirmDelete(post.id)}
                                                style={{
                                                    background: 'transparent', border: 'none', color: '#f87171', fontWeight: 600, fontSize: '0.8rem',
                                                    cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(248, 113, 113, 0.1)'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                삭제
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

