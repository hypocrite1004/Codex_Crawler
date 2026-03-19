"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPost, fetchCategories, Category, type CreatePostPayload, getErrorMessage } from '@/lib/api';
import dynamic from 'next/dynamic';
import type { ReactQuillProps } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic<ReactQuillProps>(() => import('react-quill-new').then((mod) => mod.default), {
    ssr: false,
    loading: () => <p>Loading editor...</p>,
});

export default function CreatePostPage() {
    const router = useRouter();
    const [categories, setCategories] = useState<Category[]>([]);
    const [formData, setFormData] = useState<CreatePostPayload>({ title: '', content: '', category: '', site: '', source_url: '', is_draft: false });
    const [error, setError] = useState('');

    useEffect(() => {
        if (!localStorage.getItem('access_token')) {
            router.push('/login');
        }
        fetchCategories().then(setCategories);
    }, [router]);

    const charCount = formData.content.replace(/(<([^>]+)>)/gi, "").length;
    const wordCount = formData.content.replace(/(<([^>]+)>)/gi, "").split(/\s+/).filter(Boolean).length;
    const readTime = Math.ceil(wordCount / 200) || 0;

    const handleSubmit = async (e: React.FormEvent, isDraft: boolean = false) => {
        e.preventDefault();
        try {
            await createPost({ ...formData, is_draft: isDraft });
            router.push('/');
            router.refresh();
        } catch (error: unknown) {
            setError(getErrorMessage(error, 'Failed to save post. Please try again.'));
        }
    };

    return (
        <div className="container" style={{ maxWidth: '1000px', margin: '40px auto' }}>
            {error && <div style={{ color: '#ef4444', marginBottom: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>{error}</div>}

            <form onSubmit={(e) => handleSubmit(e, false)} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                {/* Basic Info Panel */}
                <div className="glass-panel" style={{ padding: '0' }}>
                    <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                        기본 정보
                    </div>
                    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                                Title
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                maxLength={200}
                                style={{ width: '100%', padding: '0.8rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'white', fontSize: '1rem' }}
                                placeholder="보안 관련 제목을 입력하세요"
                                required
                            />
                            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                {formData.title.length}/200
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 250px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                                    Site
                                </label>
                                <input
                                    type="text"
                                    value={formData.site}
                                    onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                                    style={{ width: '100%', padding: '0.8rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'white', fontSize: '0.95rem' }}
                                    placeholder="KISA, NCSC 등"
                                />
                            </div>
                            <div style={{ flex: '1 1 250px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                                    Link
                                </label>
                                <input
                                    type="url"
                                    value={formData.source_url}
                                    onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                                    style={{ width: '100%', padding: '0.8rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'white', fontSize: '0.95rem' }}
                                    placeholder="https://example.com/article"
                                />
                            </div>
                            <div style={{ flex: '1 1 250px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
                                    Category
                                </label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    style={{ width: '100%', padding: '0.8rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: '#111', color: 'white', fontSize: '0.95rem' }}
                                    required
                                >
                                    <option value="" disabled>Select a category</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Creation Panel */}
                <div className="glass-panel" style={{ padding: '0' }}>
                    <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                        콘텐츠 작성
                    </div>
                    <div style={{ padding: '2rem' }}>
                        <div className="quill-dark-theme-wrapper" style={{ borderRadius: '4px' }}>
                            <ReactQuill
                                theme="snow"
                                value={formData.content}
                                onChange={(value) => setFormData({ ...formData, content: value })}
                                style={{ minHeight: '350px' }}
                                placeholder="보안 관련 콘텐츠를 작성하세요. 텍스트 포맷팅, 링크, 리스트 등을 활용하여 풍부한 내용을 만들 수 있습니다."
                            />
                        </div>
                        <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {charCount} characters • {wordCount} words • ~{readTime} min read
                        </div>
                    </div>
                </div>

                {/* Bottom Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                    <button type="button" onClick={(e) => handleSubmit(e, true)} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                        임시 저장
                    </button>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button type="button" className="btn btn-outline" onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                            목록으로 돌아가기
                        </button>
                        <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            작성 완료
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
