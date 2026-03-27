'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { fetchCves, type CveRecord, getErrorMessage } from '@/lib/api';

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

function formatDateTime(value: string | null) {
    if (!value) {
        return '-';
    }
    return new Date(value).toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function CveListPage() {
    const [items, setItems] = useState<CveRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [severity, setSeverity] = useState('');
    const [tracked, setTracked] = useState<'all' | 'true' | 'false'>('all');

    const filters = useMemo(() => {
        const next: Record<string, string> = {};
        if (query.trim()) {
            next.q = query.trim();
        }
        if (severity) {
            next.severity = severity;
        }
        return next;
    }, [query, severity]);

    useEffect(() => {
        let cancelled = false;

        fetchCves(filters)
            .then((data) => {
                if (cancelled) {
                    return;
                }
                setItems(data);
                setError('');
            })
            .catch((fetchError: unknown) => {
                if (cancelled) {
                    return;
                }
                setError(getErrorMessage(fetchError, 'CVE 목록을 불러오지 못했습니다.'));
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [filters]);

    return (
        <div className="container" style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '2rem' }}>CVE Intelligence</h1>
                    <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)' }}>
                        현재 시스템에서 추적 중인 CVE와 공개 게시글 연결 현황을 확인합니다.
                    </p>
                </div>
                <Link href="/" className="btn btn-outline">홈으로</Link>
            </div>

            <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="CVE ID 검색 (예: CVE-2025-12345)"
                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '0.85rem 1rem', borderRadius: '10px', outline: 'none' }}
                />
                <select
                    value={severity}
                    onChange={(event) => setSeverity(event.target.value)}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '0.85rem 1rem', borderRadius: '10px', outline: 'none' }}
                >
                    <option value="">모든 심각도</option>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                </select>
                {false && <select
                    value={tracked}
                    onChange={(event) => setTracked(event.target.value as 'all' | 'true' | 'false')}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '0.85rem 1rem', borderRadius: '10px', outline: 'none' }}
                >
                    <option value="all">추적 여부 전체</option>
                    <option value="true">추적 중</option>
                    <option value="false">추적 안 함</option>
                </select>}
            </div>

            {loading ? (
                <div style={{ color: 'var(--text-secondary)', padding: '2rem 0', textAlign: 'center' }}>CVE 목록을 불러오는 중입니다...</div>
            ) : error ? (
                <div style={{ color: '#ef4444', padding: '2rem 0', textAlign: 'center' }}>{error}</div>
            ) : items.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', padding: '2rem 0', textAlign: 'center' }}>조건에 맞는 CVE가 없습니다.</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {items.map((item) => (
                        <Link
                            href={`/cves/${item.id}`}
                            key={item.id}
                            className="glass-panel"
                            style={{ padding: '1rem', textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                                <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{item.cve_id}</div>
                                <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, color: severityColor(item.severity), border: `1px solid ${severityColor(item.severity)}44`, background: `${severityColor(item.severity)}22` }}>
                                    {item.severity || 'UNKNOWN'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                <span>현재 언급 {item.mention_count}건</span>
                                <span>공개 게시글 {item.post_count}건</span>
                                {item.legacy_mention_count > 0 && <span>Legacy 원본 {item.legacy_mention_count}건</span>}
                                {typeof item.cvss_score === 'number' && <span>CVSS {item.cvss_score.toFixed(1)}</span>}
                            </div>
                            {(item.vendor || item.product) && (
                                <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                                    {[item.vendor, item.product].filter(Boolean).join(' / ')}
                                </div>
                            )}
                            <div style={{ color: '#64748b', fontSize: '0.78rem' }}>
                                마지막 확인 {formatDateTime(item.last_seen)}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
