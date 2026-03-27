'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    ResponsiveContainer,
    Scatter,
    ScatterChart,
    Tooltip,
    XAxis,
    YAxis,
    ZAxis,
} from 'recharts';

import { fetchDashboard, fetchProfile, getErrorMessage, type DashboardData } from '@/lib/api';

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];

function formatShortDate(value: string) {
    const date = new Date(value);
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateTime(value: string) {
    return new Date(value).toLocaleString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getSeverityColor(severity: string) {
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

function renderChangeBadge(percent: number) {
    if (percent === 0) {
        return <span style={{ color: '#94a3b8', fontWeight: 600 }}>변화 없음</span>;
    }

    const isUp = percent > 0;
    return (
        <span style={{ color: isUp ? '#10b981' : '#ef4444', fontWeight: 600 }}>
            {isUp ? '증가' : '감소'} {Math.abs(percent)}%
        </span>
    );
}

function SummaryCard({
    title,
    value,
    detail,
}: {
    title: string;
    value: string | number;
    detail?: React.ReactNode;
}) {
    return (
        <div
            style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                padding: '1rem 1.2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
            }}
        >
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{title}</div>
            <div style={{ color: 'var(--text-primary)', fontSize: '1.8rem', fontWeight: 700 }}>{value}</div>
            {detail ? <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{detail}</div> : null}
        </div>
    );
}

export default function DashboardPage() {
    const router = useRouter();
    const [period, setPeriod] = useState<'week' | 'month'>('week');
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const verifyAccess = async () => {
            try {
                const user = await fetchProfile();
                if (!user.is_staff) {
                    router.replace('/');
                    return;
                }
                setIsAdmin(Boolean(user.is_superuser));
                setIsAuthorized(true);
            } catch {
                router.replace('/login');
            }
        };

        void verifyAccess();
    }, [router]);

    const load = useCallback(async () => {
        if (!isAuthorized) {
            return;
        }

        setLoading(true);
        setError('');

        try {
            const dashboard = await fetchDashboard(period);
            setData(dashboard);
        } catch (fetchError: unknown) {
            setError(getErrorMessage(fetchError, '대시보드 데이터를 불러오지 못했습니다.'));
        } finally {
            setLoading(false);
        }
    }, [isAuthorized, period]);

    useEffect(() => {
        if (!isAuthorized) {
            return;
        }
        void load();
    }, [isAuthorized, load]);

    if (isAuthorized === null || loading) {
        return (
            <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: 'var(--text-secondary)' }}>대시보드 로딩 중...</div>
            </div>
        );
    }

    if (!isAuthorized || !data) {
        return null;
    }

    if (error) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
                <p>{error}</p>
                <button className="btn btn-primary" onClick={load}>다시 시도</button>
            </div>
        );
    }

    const summary = data.summary;
    const periodLabel = period === 'week' ? '이번 주' : '이번 달';
    const postChange =
        summary.prev_period_posts > 0
            ? Math.round(((summary.period_posts - summary.prev_period_posts) / summary.prev_period_posts) * 100)
            : 0;
    const categoryKeys = [
        ...new Set(
            data.daily_trend.flatMap((item) =>
                Object.keys(item).filter((key) => key !== 'date' && key !== 'total'),
            ),
        ),
    ];

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.5rem' }}>보안 인텔리전스 대시보드</h1>
                    <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        콘텐츠 운영 지표와 최근 수집 흐름을 한 화면에서 확인합니다.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(['week', 'month'] as const).map((value) => (
                        <button
                            key={value}
                            onClick={() => setPeriod(value)}
                            style={{
                                padding: '0.45rem 0.9rem',
                                borderRadius: '999px',
                                border: '1px solid var(--glass-border)',
                                background: period === value ? 'var(--accent-primary)' : 'transparent',
                                color: period === value ? '#fff' : 'var(--text-secondary)',
                                cursor: 'pointer',
                            }}
                        >
                            {value === 'week' ? '주간' : '월간'}
                        </button>
                    ))}
                    <button
                        onClick={load}
                        style={{
                            padding: '0.45rem 0.9rem',
                            borderRadius: '999px',
                            border: '1px solid var(--glass-border)',
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                        }}
                    >
                        새로고침
                    </button>
                </div>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: isAdmin ? 'repeat(4, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
                    gap: '1rem',
                }}
            >
                <SummaryCard
                    title="전체 게시글"
                    value={summary.total_posts.toLocaleString()}
                    detail={<>{periodLabel} {summary.period_posts.toLocaleString()}건 · {renderChangeBadge(postChange)}</>}
                />
                <SummaryCard
                    title={`${periodLabel} 키워드`}
                    value={data.trending_keywords[0]?.word ?? '-'}
                    detail={
                        data.trending_keywords[0]
                            ? <>{data.trending_keywords[0].count}건 · {renderChangeBadge(data.trending_keywords[0].change_pct)}</>
                            : '집계된 키워드가 없습니다.'
                    }
                />
                {isAdmin && summary.active_sources !== undefined && summary.total_sources !== undefined && (
                    <SummaryCard
                        title="활성 소스"
                        value={`${summary.active_sources} / ${summary.total_sources}`}
                        detail="활성 소스 / 전체 소스"
                    />
                )}
                <SummaryCard
                    title="마지막 크롤링"
                    value={summary.last_crawled_at ? formatShortDate(summary.last_crawled_at) : '-'}
                    detail={summary.last_crawled_at ? formatDateTime(summary.last_crawled_at) : '크롤링 기록이 없습니다.'}
                />
            </div>

            {isAdmin && data.bubble_data.length > 0 && (
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1.2rem' }}>
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>AI 유사도 버블 맵</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                            임베딩 기반 군집 결과를 운영 관점에서 확인하는 관리자 전용 섹션입니다.
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                        <ScatterChart margin={{ top: 24, right: 24, bottom: 24, left: 24 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis type="number" dataKey="x" hide />
                            <YAxis type="number" dataKey="y" hide />
                            <ZAxis type="number" dataKey="z" range={[100, 1000]} />
                            <Tooltip
                                cursor={{ strokeDasharray: '3 3' }}
                                content={({ active, payload }) => {
                                    if (!active || !payload || payload.length === 0) {
                                        return null;
                                    }

                                    const point = payload[0].payload as {
                                        title: string;
                                        category: string;
                                        related_count: number;
                                    };

                                    return (
                                        <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.7rem 0.9rem' }}>
                                            <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{point.title}</div>
                                            <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                                                [{point.category}] 관련 게시글 {point.related_count}건
                                            </div>
                                        </div>
                                    );
                                }}
                            />
                            <Scatter data={data.bubble_data} fill="#8b5cf6">
                                {data.bubble_data.map((item, index) => (
                                    <Cell key={item.id} fill={COLORS[index % COLORS.length]} opacity={0.75} />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1.2rem' }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>일별 수집 추이</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                                날짜별 게시글 수와 카테고리 분포를 확인합니다.
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={240}>
                            <AreaChart data={data.daily_trend} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                                <defs>
                                    {categoryKeys.map((key, index) => (
                                        <linearGradient key={key} id={`area-${index}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0} />
                                        </linearGradient>
                                    ))}
                                    {categoryKeys.length === 0 && (
                                        <linearGradient id="area-total" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                        </linearGradient>
                                    )}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.82rem' }}
                                    labelStyle={{ color: '#e2e8f0' }}
                                    formatter={(value: number | string | undefined, name: string | undefined) => [`${value ?? 0}건`, name ?? ''] as [string, string]}
                                />
                                {categoryKeys.length > 0 ? (
                                    categoryKeys.map((key, index) => (
                                        <Area
                                            key={key}
                                            type="monotone"
                                            dataKey={key}
                                            name={key}
                                            stackId="1"
                                            stroke={COLORS[index % COLORS.length]}
                                            fill={`url(#area-${index})`}
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                    ))
                                ) : (
                                    <Area
                                        type="monotone"
                                        dataKey="total"
                                        name="전체"
                                        stroke="#0ea5e9"
                                        fill="url(#area-total)"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                )}
                                {categoryKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '0.78rem', color: '#9ca3af' }} />}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1.2rem' }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>카테고리별 수집 비교</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                                현재 기간과 직전 기간의 카테고리별 수집량을 비교합니다.
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={data.category_dist} layout="vertical" margin={{ top: 0, right: 12, left: 12, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                                <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={88} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.82rem' }}
                                    itemStyle={{ color: '#e2e8f0' }}
                                    labelStyle={{ display: 'none' }}
                                    formatter={(value: number | string | undefined, name: string | undefined) => [`${value ?? 0}건`, name ?? ''] as [string, string]}
                                />
                                <Bar dataKey="prev" name="이전 기간" fill="rgba(148,163,184,0.25)" radius={[0, 3, 3, 0]} barSize={8} />
                                <Bar dataKey="current" name="현재 기간" fill="#0ea5e9" radius={[0, 3, 3, 0]} barSize={8} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1.2rem' }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.3rem' }}>급상승 키워드</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.9rem' }}>
                            이전 기간 대비 증가 폭이 큰 키워드를 표시합니다.
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {data.trending_keywords.slice(0, 12).map((keyword, index) => {
                                const maxCount = data.trending_keywords[0]?.count || 1;
                                const width = Math.round((keyword.count / maxCount) * 100);
                                const isNew = keyword.prev_count === 0;

                                return (
                                    <div key={keyword.word} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                        <div style={{ width: '18px', textAlign: 'right', color: '#6b7280', fontSize: '0.72rem' }}>{index + 1}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                                <div style={{ color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {keyword.word}
                                                    {isNew && (
                                                        <span style={{ marginLeft: '0.35rem', fontSize: '0.65rem', background: '#ef4444', color: '#fff', borderRadius: '3px', padding: '1px 4px' }}>
                                                            NEW
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{keyword.count}건</div>
                                            </div>
                                            <div style={{ height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '999px' }}>
                                                <div
                                                    style={{
                                                        width: `${width}%`,
                                                        height: '100%',
                                                        borderRadius: '999px',
                                                        background: index < 3 ? '#ef4444' : '#0ea5e9',
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1.2rem' }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.3rem' }}>Top CVEs</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.9rem' }}>
                            게시글에서 자주 언급된 CVE 목록입니다.
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {data.top_cves.length === 0 ? (
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>표시할 CVE 데이터가 없습니다.</div>
                            ) : (
                                data.top_cves.map((cve) => (
                                    <div
                                        key={cve.cve_id}
                                        style={{
                                            padding: '0.75rem',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                            background: 'rgba(255,255,255,0.03)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.35rem',
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                                            <div style={{ color: 'var(--text-primary)', fontSize: '0.84rem', fontWeight: 600 }}>{cve.cve_id}</div>
                                            <span
                                                style={{
                                                    fontSize: '0.68rem',
                                                    padding: '2px 6px',
                                                    borderRadius: '999px',
                                                    background: `${getSeverityColor(cve.severity)}22`,
                                                    color: getSeverityColor(cve.severity),
                                                    border: `1px solid ${getSeverityColor(cve.severity)}44`,
                                                }}
                                            >
                                                {cve.severity || 'UNKNOWN'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                            <span>언급 {cve.mention_count}회</span>
                                            <span>게시글 {cve.post_count}건</span>
                                            {typeof cve.cvss_score === 'number' && <span>CVSS {cve.cvss_score.toFixed(1)}</span>}
                                        </div>
                                        {cve.last_seen && (
                                            <div style={{ color: '#64748b', fontSize: '0.72rem' }}>
                                                마지막 확인 {formatDateTime(cve.last_seen)}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1.2rem' }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '1rem' }}>최근 수집 게시글</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem' }}>
                    {data.recent_posts.map((post) => (
                        <Link
                            key={post.id}
                            href={`/posts/${post.id}`}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.35rem',
                                padding: '0.8rem',
                                textDecoration: 'none',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.06)',
                                background: 'rgba(255,255,255,0.03)',
                            }}
                        >
                            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}>
                                    {post.category}
                                </span>
                                <span style={{ fontSize: '0.72rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {post.site || '-'}
                                </span>
                            </div>
                            <div
                                style={{
                                    color: 'var(--text-primary)',
                                    fontSize: '0.84rem',
                                    fontWeight: 500,
                                    lineHeight: 1.4,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                }}
                            >
                                {post.title}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#6b7280', fontSize: '0.72rem' }}>
                                <span>{formatDateTime(post.created_at)}</span>
                                {post.related_count > 0 && (
                                    <span style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.15)', padding: '2px 6px', borderRadius: '10px' }}>
                                        + {post.related_count}건 관련
                                    </span>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
