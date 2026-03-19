import { fetchPost } from '@/lib/api';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PostComments from '@/components/PostComments';
import PostSidebar from '@/components/PostSidebar';
import PostSummary from '@/components/PostSummary';
import ClientPostGuard from '@/components/ClientPostGuard';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PostPageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function PostDetailPage(props: PostPageProps) {
    const params = await props.params;
    const post = await fetchPost(params.id);

    if (!post) {
        notFound();
    }

    const formatHtmlContent = (html: string) => {
        if (!html) return '';
        let clean = html;

        // 1. 의미 없는 빈 문단 지우기 (단일 빈 문단도 포함)
        const emptyBlock = /<(p|div)[^>]*>(\s*|&nbsp;|<br\s*\/?>)*<\/\1>/gi;
        clean = clean.replace(emptyBlock, '');
        clean = clean.replace(emptyBlock, ''); // 중첩 제거 대비

        // 2. 문단 끝/시작과 맞닿은 불필요한 <br> 제거 (여백 뻥튀기 방지)
        clean = clean.replace(/<\/(p|div)>\s*(<br\s*\/?>\s*)+/gi, '</$1>');
        clean = clean.replace(/(<br\s*\/?>\s*)+<(p|div)[^>]*>/gi, '<$2>');

        // 3. 남은 연속 <br> 또는 \n 들은 최대 2개(빈 줄 1칸)로 강제 압축
        clean = clean.replace(/(<br\s*\/?>\s*){3,}/gi, '<br/><br/>');
        clean = clean.replace(/\n{3,}/g, '\n\n');

        return clean;
    };

    void formatHtmlContent;

    return (
        <ClientPostGuard>
            <div className="container" style={{ maxWidth: '1200px', margin: '40px auto' }}>
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

                    {/* Main Content Area */}
                    <div style={{ flex: '1 1 700px', minWidth: 0 }}>
                        <article className="glass-panel" style={{ padding: '3rem 2rem' }}>
                            <header style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '2rem', marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <span style={{ background: 'var(--accent-primary)', color: 'white', padding: '4px 12px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
                                            {post.category_name || "Uncategorized"}
                                        </span>
                                        {post.is_draft && (
                                            <span style={{ border: '1px solid var(--text-secondary)', color: 'var(--text-secondary)', padding: '4px 12px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
                                                임시저장
                                            </span>
                                        )}
                                    </div>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                        {post.published_at
                                            ? `${new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} (Published)`
                                            : new Date(post.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                                        }
                                    </span>
                                </div>

                                <h1 style={{ fontSize: '2.5rem', color: 'var(--text-primary)', marginBottom: '1.5rem', lineHeight: 1.2 }}>
                                    {post.title}
                                </h1>

                                <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--text-secondary)" }}>
                                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--border-color)", display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                                        {post.author?.username ? post.author.username.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{post.author?.username || 'Unknown Researcher'}</div>
                                        <div style={{ fontSize: '0.85rem' }}>Security Analyst</div>
                                    </div>
                                </div>
                            </header>

                            <section className="post-content markdown-body" style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.7 }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {post.content}
                                </ReactMarkdown>
                            </section>

                            {post.iocs && post.iocs.length > 0 && (
                                <div style={{ marginTop: '2.5rem', padding: '1.5rem', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px' }}>
                                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        🔍 추출된 외부 참조 (IoC / Links)
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
                                        🔗 이 기사와 병합된 이전 유사 뉴스
                                        <span style={{ background: '#8b5cf6', color: 'white', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px' }}>{post.related_posts_list.length}</span>
                                    </h3>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                        {post.related_posts_list.map(related => (
                                            <li key={related.id}>
                                                <Link href={`/posts/${related.id}`} style={{ textDecoration: 'none', display: 'block', padding: '1rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', transition: 'border-color 0.2s', backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(139,92,246,0.05), transparent 30%)' }}>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-secondary)', marginBottom: '4px', fontWeight: 600 }}>{related.site || '알 수 없는 출처'}</div>
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

                    {/* Sticky Sidebar Area */}
                    <div style={{ flex: '0 0 320px', width: '320px', position: 'sticky', top: '6rem' }}>
                        <PostSidebar post={post} />
                    </div>
                </div>
            </div>
        </ClientPostGuard>
    );
}
