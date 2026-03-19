"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchPosts, fetchCategories, fetchCrawlerSources, Post, Category, CrawlerSource } from '@/lib/api';

export default function HomeFeed() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [sources, setSources] = useState<CrawlerSource[]>([]);
    const [activeCategory, setActiveCategory] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    // 검색 및 필터 상태
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [filterSite, setFilterSite] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [filterSummarized, setFilterSummarized] = useState(false);
    const [filterShared, setFilterShared] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // 디바운스 처리 (입력 중 연속 호출 방지)
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // 초기 메타데이터 로딩
    useEffect(() => {
        Promise.all([fetchCategories(), fetchCrawlerSources()]).then(([categoriesData, sourcesData]) => {
            setCategories(categoriesData);
            setSources(sourcesData);
        });
    }, []);

    // 쿼리 파라미터가 바뀔 때마다 자동 로딩
    useEffect(() => {
        const params: Record<string, string> = {};
        if (debouncedQuery) params.search = debouncedQuery;
        if (filterSite) params.site = filterSite;
        if (filterDateFrom) params.start_date = filterDateFrom;
        if (filterDateTo) params.end_date = filterDateTo;
        if (filterSummarized) params.is_summarized = 'true';
        if (filterShared) params.is_shared = 'true';

        let cancelled = false;

        fetchPosts(params).then(postsData => {
            if (cancelled) {
                return;
            }
            setPosts(postsData);
            setLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [debouncedQuery, filterSite, filterDateFrom, filterDateTo, filterSummarized, filterShared]);

    const filteredPosts = activeCategory
        ? posts.filter(p => p.category === activeCategory)
        : posts;

    // 키워드 하이라이팅 유틸 함수
    const highlightText = (text: string, query: string) => {
        if (!query.trim()) return text;
        const parts = text.split(new RegExp(`(${query})`, 'gi'));
        return (
            <>
                {parts.map((part, i) =>
                    part.toLowerCase() === query.toLowerCase()
                        ? <mark key={i} style={{ background: 'rgba(14, 165, 233, 0.3)', color: '#38bdf8', padding: '0 2px', borderRadius: '4px', fontWeight: 600 }}>{part}</mark>
                        : part
                )}
            </>
        );
    };

    if (loading && posts.length === 0) {
        return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Decrypting intelligence...</div>;
    }

    return (
        <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem" }}>
                <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2>Trending Insights</h2>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '0 16px', width: '320px', transition: 'border-color 0.2s' }}>
                                <input
                                    type="text"
                                    placeholder="키워드로 식별된 위협 뉴스 검색..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    // onKeyDown 이벤트 제거 (자동 검색이 되므로 불필요)
                                    style={{
                                        width: '100%', padding: '10px 0',
                                        background: 'transparent', border: 'none',
                                        color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem'
                                    }}
                                />
                                <div style={{ color: 'var(--text-secondary)', padding: '10px 0 10px 8px', display: 'flex', alignItems: 'center' }}>
                                    🔍
                                </div>
                            </div>
                            <button
                                className={`btn ${showFilters ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => setShowFilters(!showFilters)}
                                style={{ borderRadius: '24px', padding: '8px 20px', fontSize: '0.9rem' }}
                            >
                                {showFilters ? '옵션 닫기' : '고급 필터'}
                            </button>
                        </div>
                    </div>

                    {showFilters && (
                        <div className="glass-panel" style={{
                            marginTop: '1.5rem', padding: '1.5rem',
                            display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'flex-end',
                            borderRadius: '16px', border: '1px solid rgba(139, 92, 246, 0.2)',
                            background: 'rgba(139, 92, 246, 0.03)'
                        }}>
                            <div style={{ flex: '1 1 180px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>수집 출처</label>
                                <select
                                    value={filterSite}
                                    onChange={e => setFilterSite(e.target.value)}
                                    style={{ width: '100%', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px 14px', borderRadius: '10px', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
                                >
                                    <option value="" style={{ background: '#1a1f2e' }}>모든 출처 통계</option>
                                    {sources.map(s => <option key={s.id} value={s.name} style={{ background: '#1a1f2e' }}>{s.name}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: '1 1 150px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>발생 기간 (From)</label>
                                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ width: '100%', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '9px 14px', borderRadius: '10px', fontSize: '0.9rem', outline: 'none', cursor: 'pointer', colorScheme: 'dark' }} />
                            </div>
                            <div style={{ flex: '1 1 150px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>발생 기간 (To)</label>
                                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{ width: '100%', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '9px 14px', borderRadius: '10px', fontSize: '0.9rem', outline: 'none', cursor: 'pointer', colorScheme: 'dark' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '1.5rem', paddingBottom: '0.5rem', flex: '1 1 200px', alignItems: 'center' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '0.95rem', cursor: 'pointer', userSelect: 'none' }}>
                                    <input type="checkbox" checked={filterSummarized} onChange={e => setFilterSummarized(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }} />
                                    <span>AI 요약됨</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '0.95rem', cursor: 'pointer', userSelect: 'none' }}>
                                    <input type="checkbox" checked={filterShared} onChange={e => setFilterShared(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }} />
                                    <span>공유됨</span>
                                </label>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                        <button
                            className={`btn ${activeCategory === null ? 'btn-primary' : 'btn-outline'}`}
                            style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                            onClick={() => setActiveCategory(null)}
                        >
                            All Data
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                className={`btn ${activeCategory === cat.id ? 'btn-primary' : 'btn-outline'}`}
                                style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                                onClick={() => setActiveCategory(cat.id)}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px" }}>
                {filteredPosts.length > 0 ? (
                    filteredPosts.map(post => (
                        <Link href={`/posts/${post.id}`} key={post.id} style={{ textDecoration: 'none' }}>
                            <article className="glass-panel" style={{ cursor: "pointer", height: '100%', position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "8px" }}>
                                    <div style={{ color: "var(--accent-secondary)", fontSize: "0.85rem", fontWeight: 600 }}>
                                        {post.category_name || "Uncategorized"}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {post.is_shared && (
                                            <div style={{ background: 'var(--accent-primary)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                                ✓ Shared
                                            </div>
                                        )}
                                        {post.is_draft && (
                                            <div style={{ border: '1px solid var(--text-secondary)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                                임시저장
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <h3 style={{ fontSize: "1.25rem", color: "var(--text-primary)", marginBottom: "8px" }}>
                                    {highlightText(post.title, debouncedQuery)}
                                </h3>
                                <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.5, marginBottom: "16px" }}>
                                    {(() => {
                                        // Strip HTML tags AND decode entities (e.g. &nbsp;) via DOMParser
                                        const raw = typeof window !== 'undefined'
                                            ? (new DOMParser().parseFromString(post.content, 'text/html').body.textContent || '')
                                            : post.content.replace(/<[^>]+>/gi, '');
                                        const clean = raw.replace(/\s+/g, ' ').trim();
                                        const truncated = clean.length > 100 ? clean.substring(0, 100) + '...' : clean;
                                        return highlightText(truncated, debouncedQuery);
                                    })()}
                                </p>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                        <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--border-color)", display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                                            {post.author?.username ? post.author.username.charAt(0).toUpperCase() : '?'}
                                        </div>
                                        <span>{post.author?.username || 'Unknown'} • {new Date(post.created_at).toLocaleDateString()}</span>
                                    </div>
                                    {post.related_count > 0 && (
                                        <span style={{ fontSize: '0.75rem', color: '#8b5cf6', background: 'rgba(139,92,246,0.15)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                                            + {post.related_count} 유사 뉴스
                                        </span>
                                    )}
                                </div>
                            </article>
                        </Link>
                    ))
                ) : (
                    <p style={{ color: "var(--text-secondary)", gridColumn: "1 / -1", textAlign: "center", padding: "40px 0" }}>
                        No intelligence available in this sector.
                    </p>
                )}
            </div>
        </>
    );
}
