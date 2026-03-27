'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { fetchCve, fetchCvePosts, getErrorMessage, type CveRecord, type Post } from '@/lib/api';

function severityColor(severity: string) {
    switch ((severity || '').toUpperCase()) {
        case 'CRITICAL':
            return '#ef4444';
        case 'HIGH':
            return '#f97316';
        case 'MEDIUM':
            return '#f59e0b';
        case 'LOW':
            return '#22c55e';
        default:
            return '#64748b';
    }
}

function formatDate(value: string | null) {
    if (!value) {
        return '-';
    }
    return new Date(value).toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function CveDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const [cve, setCve] = useState<CveRecord | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const cveId = params?.id;
        if (!cveId) {
            router.push('/cves');
            return;
        }

        let cancelled = false;

        Promise.all([fetchCve(cveId), fetchCvePosts(cveId)])
            .then(([cveData, postData]) => {
                if (cancelled) {
                    return;
                }
                if (!cveData) {
                    router.push('/cves');
                    return;
                }
                setCve(cveData);
                setPosts(postData);
                setError('');
            })
            .catch((fetchError: unknown) => {
                if (cancelled) {
                    return;
                }
                setError(getErrorMessage(fetchError, 'CVE 상세 정보를 불러오지 못했습니다.'));
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [params, router]);

    if (loading) {
        return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>CVE 상세 정보를 불러오는 중입니다...</div>;
    }

    if (error || !cve) {
        return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>{error || 'CVE를 찾을 수 없습니다.'}</div>;
    }

    return (
        <div className="container" style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '2rem' }}>{cve.cve_id}</h1>
                        <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700, color: severityColor(cve.severity), border: `1px solid ${severityColor(cve.severity)}44`, background: `${severityColor(cve.severity)}22` }}>
                            {cve.severity || 'UNKNOWN'}
                        </span>
                    </div>
                    <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', maxWidth: '860px' }}>
                        {cve.description || '등록된 설명이 없습니다.'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <Link href="/" className="btn btn-outline">게시글 보기</Link>
                    <Link href="/cves" className="btn btn-outline">목록으로</Link>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="glass-panel" style={{ padding: '1rem' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>현재 언급 수</div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '1.7rem', fontWeight: 700 }}>{cve.mention_count}</div>
                </div>
                {false && <div className="glass-panel" style={{ padding: '1rem' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Legacy 원본 수</div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '1.7rem', fontWeight: 700 }}>{cve?.legacy_mention_count}</div>
                </div>}
                <div className="glass-panel" style={{ padding: '1rem' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>공개 게시글</div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '1.7rem', fontWeight: 700 }}>{cve.post_count}</div>
                </div>
                <div className="glass-panel" style={{ padding: '1rem' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>CVSS</div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '1.7rem', fontWeight: 700 }}>{typeof cve.cvss_score === 'number' ? cve.cvss_score.toFixed(1) : '-'}</div>
                </div>
                {false && <div className="glass-panel" style={{ padding: '1rem' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>추적 여부</div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '1.7rem', fontWeight: 700 }}>{cve?.is_tracked ? 'ON' : 'OFF'}</div>
                </div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: '1rem' }}>
                <aside className="glass-panel" style={{ padding: '1rem', height: 'fit-content' }}>
                    <h2 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: '1rem' }}>메타데이터</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                        <div><strong style={{ color: 'var(--text-primary)' }}>Vendor</strong><br />{cve.vendor || '-'}</div>
                        <div><strong style={{ color: 'var(--text-primary)' }}>Product</strong><br />{cve.product || '-'}</div>
                        <div><strong style={{ color: 'var(--text-primary)' }}>공개일</strong><br />{cve.published_date || '-'}</div>
                        <div><strong style={{ color: 'var(--text-primary)' }}>최초 확인</strong><br />{formatDate(cve.first_seen)}</div>
                        <div><strong style={{ color: 'var(--text-primary)' }}>마지막 확인</strong><br />{formatDate(cve.last_seen)}</div>
                        <div><strong style={{ color: 'var(--text-primary)' }}>메모</strong><br />{cve.notes || '-'}</div>
                    </div>
                </aside>

                <section className="glass-panel" style={{ padding: '1rem' }}>
                    <h2 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: '1rem' }}>연결된 게시글</h2>
                    {posts.length === 0 ? (
                        <div style={{ color: 'var(--text-secondary)' }}>연결된 게시글이 없습니다.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {posts.map((post) => (
                                <Link
                                    href={`/posts/${post.id}`}
                                    key={post.id}
                                    style={{ textDecoration: 'none', padding: '0.9rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                                        <span style={{ color: '#38bdf8', fontSize: '0.75rem', fontWeight: 700 }}>{post.category_name || 'Uncategorized'}</span>
                                        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{formatDate(post.published_at || post.created_at)}</span>
                                    </div>
                                    <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{post.title}</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{post.site || 'Unknown Source'}</div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
