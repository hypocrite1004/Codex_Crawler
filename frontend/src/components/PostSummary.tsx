"use client";

import { useEffect, useState } from 'react';
import { deleteSummary, fetchProfile, getErrorMessage, summarizePost, type AuthUser, updateSummary } from '@/lib/api';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import type { ReactQuillProps } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic<ReactQuillProps>(() => import('react-quill-new').then((mod) => mod.default), {
    ssr: false,
    loading: () => <p style={{ color: 'var(--text-secondary)' }}>Loading editor...</p>,
});

type SectionContent = string | SectionNode;

interface SectionNode {
    caption: string;
    content: SectionContent[];
}

interface SummaryJSON {
    title?: string;
    brief?: string;
    summary?: string;
    hashtag?: string[];
    sections?: SectionNode[];
}

function contentToMarkdown(items: SectionContent[], depth = 0): string {
    const indent = '  '.repeat(depth);
    return items.map((item) => {
        if (typeof item === 'string') {
            return `${indent}- ${item}`;
        }

        return [`${indent}### ${item.caption}`, contentToMarkdown(item.content, depth + 1)].join('\n');
    }).join('\n');
}

function summaryToMarkdown(data: SummaryJSON): string {
    const lines: string[] = [];

    if (data.title) {
        lines.push(`# ${data.title}`, '');
    }
    if (data.brief) {
        lines.push(`> ${data.brief}`, '');
    }
    if (data.summary) {
        lines.push(data.summary, '');
    }
    if (data.sections?.length) {
        data.sections.forEach((section) => {
            lines.push(`## ${section.caption}`);
            lines.push(contentToMarkdown(section.content));
            lines.push('');
        });
    }
    if (data.hashtag?.length) {
        lines.push(data.hashtag.join(' '));
    }

    return lines.join('\n').trim();
}

function ContentItem({ item, depth = 0 }: { item: SectionContent; depth?: number }) {
    if (typeof item === 'string') {
        return (
            <li style={{ marginBottom: '6px', paddingLeft: '4px', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                {item}
            </li>
        );
    }

    return (
        <li style={{ marginBottom: '10px', listStyle: 'none' }}>
            <div
                style={{
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: 'var(--accent-secondary)',
                    marginBottom: '6px',
                    paddingLeft: `${depth * 12}px`,
                }}
            >
                {item.caption}
            </div>
            <ul style={{ paddingLeft: '1.5rem', margin: 0 }}>
                {item.content.map((child, index) => (
                    <ContentItem key={index} item={child} depth={depth + 1} />
                ))}
            </ul>
        </li>
    );
}

function StructuredSummary({ data }: { data: SummaryJSON }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            {data.title && (
                <div
                    style={{
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        color: 'var(--accent-primary)',
                        paddingBottom: '0.7rem',
                        borderBottom: '1px solid var(--glass-border)',
                    }}
                >
                    {data.title}
                </div>
            )}

            {data.brief && (
                <div
                    style={{
                        fontSize: '1rem',
                        fontStyle: 'italic',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.6,
                        padding: '0.7rem 1rem',
                        background: 'rgba(14,165,233,0.05)',
                        borderLeft: '3px solid var(--accent-primary)',
                        borderRadius: '0 6px 6px 0',
                    }}
                >
                    {data.brief}
                </div>
            )}

            {data.summary && (
                <div style={{ lineHeight: 1.7, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                    {data.summary}
                </div>
            )}

            {data.sections?.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {data.sections.map((section, index) => (
                        <div
                            key={`${section.caption}-${index}`}
                            style={{
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: '8px',
                                padding: '1rem 1.2rem',
                                border: '1px solid var(--glass-border)',
                            }}
                        >
                            <div
                                style={{
                                    fontWeight: 700,
                                    fontSize: '0.95rem',
                                    color: 'var(--accent-primary)',
                                    marginBottom: '0.8rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                }}
                            >
                                <span
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        background: 'rgba(14,165,233,0.2)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.75rem',
                                        flexShrink: 0,
                                    }}
                                >
                                    {index + 1}
                                </span>
                                {section.caption}
                            </div>
                            <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
                                {section.content.map((item, itemIndex) => (
                                    <ContentItem key={itemIndex} item={item} />
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            ) : null}

            {data.hashtag?.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '0.5rem' }}>
                    {data.hashtag.map((tag, index) => (
                        <span
                            key={`${tag}-${index}`}
                            style={{
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '0.78rem',
                                background: 'rgba(16,185,129,0.1)',
                                color: 'var(--accent-secondary)',
                                border: '1px solid rgba(16,185,129,0.25)',
                            }}
                        >
                            {tag.startsWith('#') ? tag : `#${tag}`}
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

export default function PostSummary({
    postId,
    summaryInitial,
    authorUsername,
}: {
    postId: number;
    isSummarizedInitial: boolean;
    summaryInitial: string | null;
    authorUsername: string;
}) {
    const [summary, setSummary] = useState<string | null>(summaryInitial);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [copied, setCopied] = useState(false);
    const router = useRouter();

    useEffect(() => {
        fetchProfile().then(setCurrentUser).catch(() => undefined);
    }, []);

    const isAuthor = currentUser?.username === authorUsername;
    const parsedSummary: SummaryJSON | null = (() => {
        if (!summary) {
            return null;
        }

        try {
            return JSON.parse(summary) as SummaryJSON;
        } catch {
            return null;
        }
    })();

    const handleCopy = async () => {
        if (!summary) {
            return;
        }

        const text = parsedSummary ? summaryToMarkdown(parsedSummary) : summary;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast.success('마크다운 형태로 복사했습니다.');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('복사에 실패했습니다.');
        }
    };

    const handleSummarize = async () => {
        setLoading(true);
        setError('');
        try {
            const nextSummary = await summarizePost(postId);
            setSummary(nextSummary);
            toast.success('요약을 생성했습니다.');
        } catch (error: unknown) {
            const message = getErrorMessage(error, '요약 생성에 실패했습니다.');
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async () => {
        const cleanContent = editContent.replace(/(<([^>]+)>)/gi, '').trim();
        if (!cleanContent) {
            return;
        }

        setLoading(true);
        try {
            const updated = await updateSummary(postId, editContent);
            setSummary(updated);
            setIsEditing(false);
            router.refresh();
            toast.success('요약을 수정했습니다.');
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, '요약 수정에 실패했습니다.'));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        toast(
            (toastItem) => (
                <div>
                    <p style={{ margin: '0 0 12px 0', fontWeight: 'bold' }}>요약을 삭제하시겠습니까?</p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => toast.dismiss(toastItem.id)} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                            취소
                        </button>
                        <button
                            onClick={async () => {
                                toast.dismiss(toastItem.id);
                                setLoading(true);
                                try {
                                    await deleteSummary(postId);
                                    setSummary(null);
                                    router.refresh();
                                    toast.success('요약을 삭제했습니다.');
                                } catch (error: unknown) {
                                    toast.error(getErrorMessage(error, '요약 삭제에 실패했습니다.'));
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            className="btn btn-primary"
                            style={{ padding: '6px 12px', fontSize: '0.85rem', background: '#ef4444', color: 'white', borderColor: '#ef4444' }}
                        >
                            삭제
                        </button>
                    </div>
                </div>
            ),
            { duration: Infinity, style: { minWidth: '300px' } },
        );
    };

    return (
        <div style={{ padding: '1.5rem', borderRadius: '8px', background: 'rgba(0, 240, 255, 0.05)', border: '1px solid var(--accent-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ color: 'var(--accent-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                    AI 요약 분석
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {summary && !isEditing && (
                        <button
                            onClick={handleCopy}
                            title="마크다운으로 복사"
                            style={{
                                padding: '4px 12px',
                                fontSize: '0.8rem',
                                borderRadius: '6px',
                                border: '1px solid var(--glass-border)',
                                background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                                color: copied ? 'var(--accent-secondary)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                transition: 'all 0.2s',
                            }}
                        >
                            {copied ? '복사됨' : '복사'}
                        </button>
                    )}
                    {!summary && isAuthor && (
                        <button onClick={handleSummarize} disabled={loading} className="btn btn-outline" style={{ padding: '6px 16px', fontSize: '0.85rem', borderColor: 'var(--accent-secondary)', color: 'var(--accent-secondary)' }}>
                            {loading ? '분석 중...' : '요약 생성'}
                        </button>
                    )}
                    {summary && isAuthor && !isEditing && (
                        <>
                            <button onClick={() => { setIsEditing(true); setEditContent(summary); }} className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
                                편집
                            </button>
                            <button onClick={handleDelete} className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '0.8rem', color: '#ef4444', borderColor: '#ef4444' }}>
                                삭제
                            </button>
                        </>
                    )}
                </div>
            </div>

            {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

            {!summary && !loading && (
                <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                    아직 요약이 없습니다.
                </div>
            )}

            {loading && (
                <div style={{ color: 'var(--text-secondary)', padding: '1rem', textAlign: 'center' }}>
                    AI가 분석 중입니다...
                </div>
            )}

            {summary && !loading && (
                isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="quill-dark-theme-wrapper" style={{ borderRadius: '4px' }}>
                            <ReactQuill theme="snow" value={editContent} onChange={setEditContent} />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setIsEditing(false)} className="btn btn-outline">취소</button>
                            <button onClick={handleUpdate} disabled={loading} className="btn btn-primary">저장</button>
                        </div>
                    </div>
                ) : parsedSummary ? (
                    <StructuredSummary data={parsedSummary} />
                ) : (
                    <div
                        className="post-content"
                        style={{
                            padding: '1rem',
                            background: 'rgba(0,0,0,0.2)',
                            borderRadius: '8px',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.7,
                            color: 'var(--text-primary)',
                        }}
                    >
                        {summary}
                    </div>
                )
            )}
        </div>
    );
}
