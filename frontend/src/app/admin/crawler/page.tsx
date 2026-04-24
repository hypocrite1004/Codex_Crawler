'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import { CrawlerRunDrilldown } from './CrawlerRunDrilldown';
import {
    createCrawlerSource,
    deleteCrawlerSource,
    fetchCategories,
    fetchCrawlerSources,
    fetchProfile,
    getErrorMessage,
    previewCrawl,
    runCrawl,
    updateCrawlerSource,
    type Category,
    type CrawlerPreviewItem,
    type CrawlerSource,
} from '@/lib/api';

type CrawlerForm = {
    id?: number;
    name: string;
    url: string;
    source_type: 'rss' | 'html';
    is_active: boolean;
    category: number | null;
    crawl_interval: number;
    max_retries: number;
    retry_backoff_minutes: number;
    auto_disable_after_failures: number;
    http_method: 'GET' | 'POST';
    request_headers: Record<string, string>;
    request_body: Record<string, unknown>;
    article_list_selector: string;
    article_link_selector: string;
    title_selector: string;
    content_selector: string;
    date_selector: string;
    fetch_full_content: boolean;
    full_content_selector: string;
    exclude_selectors: string;
};

type HealthFilter = 'all' | 'attention' | 'due' | CrawlerSource['health_status'];
type ActiveFilter = 'all' | 'active' | 'paused';
type SourceTypeFilter = 'all' | CrawlerSource['source_type'];
type SortKey = 'attention' | 'due' | 'latest' | 'name';

const EMPTY_FORM: CrawlerForm = {
    name: '',
    url: '',
    source_type: 'rss',
    is_active: true,
    category: null,
    crawl_interval: 60,
    max_retries: 2,
    retry_backoff_minutes: 10,
    auto_disable_after_failures: 5,
    http_method: 'GET',
    request_headers: {},
    request_body: {},
    article_list_selector: '',
    article_link_selector: '',
    title_selector: '',
    content_selector: '',
    date_selector: '',
    fetch_full_content: false,
    full_content_selector: '',
    exclude_selectors: '',
};

const SELECTORS = [
    ['article_list_selector', 'Article List', '.article-list li'],
    ['article_link_selector', 'Article Link', 'a.title'],
    ['title_selector', 'Title', 'h1.article-title'],
    ['content_selector', 'Content', 'div.content'],
    ['date_selector', 'Date', 'time.published-at'],
] as const;

const HEALTH: Record<CrawlerSource['health_status'], { label: string; color: string }> = {
    healthy: { label: 'Healthy', color: '#10b981' },
    warning: { label: 'Fallback', color: '#f59e0b' },
    error: { label: 'Error', color: '#ef4444' },
    running: { label: 'Running', color: '#3b82f6' },
    paused: { label: 'Paused', color: '#94a3b8' },
    disabled: { label: 'Disabled', color: '#f97316' },
    pending: { label: 'Pending', color: '#8b5cf6' },
    idle: { label: 'Idle', color: '#64748b' },
};

const RUN: Record<'success' | 'playwright_fallback' | 'error' | 'running', { label: string; color: string }> = {
    success: { label: 'Success', color: '#10b981' },
    playwright_fallback: { label: 'Playwright', color: '#f59e0b' },
    error: { label: 'Error', color: '#ef4444' },
    running: { label: 'Running', color: '#3b82f6' },
};

function fmt(date: string | null | undefined) {
    return date ? new Date(date).toLocaleString('ko-KR') : 'None';
}

function due(date: string | null) {
    return Boolean(date && new Date(date).getTime() <= Date.now());
}

function timestamp(date: string | null | undefined) {
    return date ? new Date(date).getTime() : 0;
}

function attentionScore(source: CrawlerSource) {
    if (source.is_running) return 90;
    if (source.health_status === 'disabled') return 80;
    if (source.health_status === 'error') return 70;
    if (source.health_status === 'warning') return 60;
    if (source.is_active && due(source.next_crawl_at)) return 50;
    if (source.health_status === 'pending') return 40;
    if (source.health_status === 'paused') return 30;
    return 0;
}

function matchesHealthFilter(source: CrawlerSource, filter: HealthFilter) {
    if (filter === 'all') return true;
    if (filter === 'attention') return attentionScore(source) >= 50;
    if (filter === 'due') return source.is_active && due(source.next_crawl_at);
    return source.health_status === filter;
}

function matchesActiveFilter(source: CrawlerSource, filter: ActiveFilter) {
    if (filter === 'all') return true;
    if (filter === 'active') return source.is_active;
    return !source.is_active;
}

function sortSources(sources: CrawlerSource[], sortKey: SortKey) {
    return [...sources].sort((a, b) => {
        if (sortKey === 'attention') {
            return attentionScore(b) - attentionScore(a) || timestamp(b.last_crawled_at) - timestamp(a.last_crawled_at);
        }
        if (sortKey === 'due') {
            const aDue = a.is_active && due(a.next_crawl_at) ? 1 : 0;
            const bDue = b.is_active && due(b.next_crawl_at) ? 1 : 0;
            return bDue - aDue || timestamp(a.next_crawl_at) - timestamp(b.next_crawl_at);
        }
        if (sortKey === 'latest') {
            return timestamp(b.last_crawled_at) - timestamp(a.last_crawled_at);
        }
        return a.name.localeCompare(b.name);
    });
}

function payload(form: CrawlerForm) {
    return {
        name: form.name.trim(),
        url: form.url.trim(),
        source_type: form.source_type,
        is_active: form.is_active,
        category: form.category,
        crawl_interval: Number(form.crawl_interval),
        max_retries: Number(form.max_retries),
        retry_backoff_minutes: Number(form.retry_backoff_minutes),
        auto_disable_after_failures: Number(form.auto_disable_after_failures),
        http_method: form.http_method,
        request_headers: form.request_headers,
        request_body: form.request_body,
        article_list_selector: form.article_list_selector.trim(),
        article_link_selector: form.article_link_selector.trim(),
        title_selector: form.title_selector.trim(),
        content_selector: form.content_selector.trim(),
        date_selector: form.date_selector.trim(),
        fetch_full_content: form.fetch_full_content,
        full_content_selector: form.full_content_selector.trim(),
        exclude_selectors: form.exclude_selectors.trim(),
    };
}

function Badge({ text, color }: { text: string; color: string }) {
    return <span style={{ padding: '0.18rem 0.55rem', borderRadius: 999, color, background: `${color}1f`, border: `1px solid ${color}40`, fontSize: '0.76rem', fontWeight: 700 }}>{text}</span>;
}

function JsonField({ label, value, onChange }: { label: string; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
    const [raw, setRaw] = useState(JSON.stringify(value, null, 2));
    const [error, setError] = useState('');
    return (
        <div>
            <div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{label}</div>
            <textarea
                value={raw}
                rows={4}
                onChange={(e) => {
                    setRaw(e.target.value);
                    try {
                        onChange(JSON.parse(e.target.value));
                        setError('');
                    } catch {
                        setError('Invalid JSON');
                    }
                }}
                style={{ width: '100%', padding: '0.7rem', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: `1px solid ${error ? '#ef4444' : 'var(--glass-border)'}`, color: 'var(--text-primary)', fontFamily: 'monospace', boxSizing: 'border-box' }}
            />
            {error && <div style={{ marginTop: 6, color: '#ef4444', fontSize: '0.76rem' }}>{error}</div>}
        </div>
    );
}

function Preview({ items, status, loading, error }: { items: CrawlerPreviewItem[]; status: string; loading: boolean; error: string }) {
    const [open, setOpen] = useState<number | null>(null);
    const [mode, setMode] = useState<'markdown' | 'html'>('markdown');
    if (loading) return <div style={{ color: 'var(--text-secondary)' }}>Running preview...</div>;
    if (error) return <div style={{ color: '#ef4444' }}>{error}</div>;
    if (!items.length) return <div style={{ color: 'var(--text-secondary)' }}>No preview result.</div>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{items.length} items</span>
                {RUN[status as keyof typeof RUN] && <Badge text={RUN[status as keyof typeof RUN].label} color={RUN[status as keyof typeof RUN].color} />}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem' }}>
                    <button className="btn btn-outline" onClick={() => setMode('markdown')}>Markdown</button>
                    <button className="btn btn-outline" onClick={() => setMode('html')}>HTML</button>
                </div>
            </div>
            {items.map((item, index) => (
                <div key={`${item.url}-${index}`} style={{ border: '1px solid var(--glass-border)', borderRadius: 10, padding: '0.9rem' }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{item.title || '(No title)'}</div>
                    <a href={item.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', fontSize: '0.78rem', wordBreak: 'break-all' }}>{item.url}</a>
                    {item.content && <div style={{ marginTop: '0.6rem' }}><button className="btn btn-outline" onClick={() => setOpen(open === index ? null : index)}>{open === index ? 'Collapse' : 'Expand'}</button></div>}
                    <div style={{ marginTop: '0.7rem', color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.6 }}>
                        {open === index && item.content ? (mode === 'html' && item.content_html ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.content_html}</pre> : <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>) : item.content_preview}
                    </div>
                </div>
            ))}
        </div>
    );
}

function FormModal({ form, setForm, categories, onSave, onClose, saving }: {
    form: CrawlerForm;
    setForm: (next: CrawlerForm) => void;
    categories: Category[];
    onSave: () => void;
    onClose: () => void;
    saving: boolean;
}) {
    const [items, setItems] = useState<CrawlerPreviewItem[]>([]);
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const set = <K extends keyof CrawlerForm>(key: K, value: CrawlerForm[K]) => setForm({ ...form, [key]: value });
    const field = { width: '100%', padding: '0.68rem 0.8rem', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', boxSizing: 'border-box' } as const;
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 480px) minmax(0, 1fr)', gap: '1rem', width: '100%', maxWidth: 1200, height: '88vh' }}>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--glass-border)', color: 'var(--accent-primary)', fontWeight: 700 }}>{form.id ? 'Edit Source' : 'Add Source'}</div>
                    <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                            <div><div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Name</div><input style={field} value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
                            <div><div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Type</div><select style={field} value={form.source_type} onChange={(e) => set('source_type', e.target.value as CrawlerForm['source_type'])}><option value="rss">RSS / Atom</option><option value="html">HTML</option></select></div>
                        </div>
                        <div><div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>URL</div><input style={field} value={form.url} onChange={(e) => set('url', e.target.value)} /></div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                            <div><div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Category</div><select style={field} value={form.category ?? ''} onChange={(e) => set('category', e.target.value ? Number(e.target.value) : null)}><option value="">None</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                            <div><div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Interval (min)</div><input style={field} type="number" min={5} value={form.crawl_interval} onChange={(e) => set('crawl_interval', Number(e.target.value))} /></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.8rem' }}>
                            <div><div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Retries</div><input style={field} type="number" min={0} value={form.max_retries} onChange={(e) => set('max_retries', Number(e.target.value))} /></div>
                            <div><div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Backoff (min)</div><input style={field} type="number" min={0} value={form.retry_backoff_minutes} onChange={(e) => set('retry_backoff_minutes', Number(e.target.value))} /></div>
                            <div><div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Disable After</div><input style={field} type="number" min={1} value={form.auto_disable_after_failures} onChange={(e) => set('auto_disable_after_failures', Number(e.target.value))} /></div>
                        </div>
                        <label style={{ display: 'flex', gap: '0.5rem', color: 'var(--text-primary)' }}><input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />Enable scheduler</label>
                        <label style={{ display: 'flex', gap: '0.5rem', color: 'var(--text-primary)' }}><input type="checkbox" checked={form.fetch_full_content} onChange={(e) => set('fetch_full_content', e.target.checked)} />Fetch full content</label>
                        {form.fetch_full_content && (<><div><div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Full Content Selector</div><input style={field} value={form.full_content_selector} onChange={(e) => set('full_content_selector', e.target.value)} /></div><div><div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Exclude Selectors</div><input style={field} value={form.exclude_selectors} onChange={(e) => set('exclude_selectors', e.target.value)} /></div></>)}
                        {form.source_type === 'html' && (<>
                            <div><div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>HTTP Method</div><select style={field} value={form.http_method} onChange={(e) => set('http_method', e.target.value as CrawlerForm['http_method'])}><option value="GET">GET</option><option value="POST">POST</option></select></div>
                            <JsonField key={`headers-${JSON.stringify(form.request_headers)}`} label="Request Headers" value={form.request_headers} onChange={(v) => set('request_headers', v as Record<string, string>)} />
                            {form.http_method === 'POST' && <JsonField key={`body-${JSON.stringify(form.request_body)}`} label="Request Body" value={form.request_body} onChange={(v) => set('request_body', v)} />}
                            {SELECTORS.map(([key, label, placeholder]) => <div key={key}><div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{label}</div><input style={field} value={form[key]} placeholder={placeholder} onChange={(e) => set(key, e.target.value)} /></div>)}
                        </>)}
                    </div>
                    <div style={{ padding: '0.9rem 1.25rem', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button className="btn btn-outline" onClick={async () => { if (!form.url.trim()) { toast.error('URL is required'); return; } setLoading(true); setError(''); setItems([]); try { const r = await previewCrawl(payload(form)); setItems(r.items); setStatus(r.status); } catch (e: unknown) { setError(getErrorMessage(e, 'Preview failed')); } finally { setLoading(false); } }}>Preview</button>
                        <button className="btn btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Saving' : 'Save'}</button>
                    </div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontWeight: 700 }}>Preview</div>
                    <div style={{ padding: '1rem 1.25rem', overflowY: 'auto' }}><Preview items={items} status={status} loading={loading} error={error} /></div>
                </div>
            </div>
        </div>
    );
}

function Summary({ title, value, helper }: { title: string; value: number; helper: string }) {
    return <div className="glass-panel" style={{ padding: '1rem 1.1rem' }}><div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{title}</div><div style={{ marginTop: '0.35rem', color: 'var(--text-primary)', fontSize: '1.65rem', fontWeight: 800 }}>{value}</div><div style={{ marginTop: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.76rem' }}>{helper}</div></div>;
}

export default function CrawlerSourcesPage() {
    const router = useRouter();
    const [sources, setSources] = useState<CrawlerSource[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<CrawlerForm>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [crawlingId, setCrawlingId] = useState<number | null>(null);
    const [expandedLogs, setExpandedLogs] = useState<number | null>(null);
    const [expandedRuns, setExpandedRuns] = useState<number | null>(null);
    const [preferredRunIds, setPreferredRunIds] = useState<Record<number, number>>({});
    const [searchText, setSearchText] = useState('');
    const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
    const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
    const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceTypeFilter>('all');
    const [sortKey, setSortKey] = useState<SortKey>('attention');

    useEffect(() => {
        const init = async () => {
            try {
                const user = await fetchProfile();
                if (!user.is_superuser) { router.push('/'); return; }
                const [sourceData, categoryData] = await Promise.all([fetchCrawlerSources(), fetchCategories()]);
                setSources(sourceData);
                setCategories(categoryData);
            } catch {
                router.push('/login');
            } finally {
                setLoading(false);
            }
        };
        void init();
    }, [router]);

    const refresh = async () => setSources(await fetchCrawlerSources());
    const openNew = () => { setForm({ ...EMPTY_FORM }); setShowForm(true); };
    const openEdit = (s: CrawlerSource) => { setForm({ id: s.id, name: s.name, url: s.url, source_type: s.source_type, is_active: s.is_active, category: s.category, crawl_interval: s.crawl_interval, max_retries: s.max_retries, retry_backoff_minutes: s.retry_backoff_minutes, auto_disable_after_failures: s.auto_disable_after_failures, http_method: s.http_method, request_headers: s.request_headers, request_body: s.request_body, article_list_selector: s.article_list_selector, article_link_selector: s.article_link_selector, title_selector: s.title_selector, content_selector: s.content_selector, date_selector: s.date_selector, fetch_full_content: s.fetch_full_content, full_content_selector: s.full_content_selector, exclude_selectors: s.exclude_selectors }); setShowForm(true); };

    const save = async () => {
        if (!form.name.trim() || !form.url.trim()) { toast.error('Name and URL are required'); return; }
        setSaving(true);
        try {
            const data = payload(form);
            if (form.id) {
                const updated = await updateCrawlerSource(form.id, data);
                setSources((current) => current.map((item) => item.id === updated.id ? updated : item));
            } else {
                const created = await createCrawlerSource(data);
                setSources((current) => [created, ...current]);
            }
            setShowForm(false);
            toast.success('Saved');
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Save failed'));
        } finally {
            setSaving(false);
        }
    };

    const remove = (source: CrawlerSource) => {
        toast((t) => <div><p style={{ margin: '0 0 10px', fontWeight: 600 }}>Delete &quot;{source.name}&quot;?</p><div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={() => toast.dismiss(t.id)}>Cancel</button><button className="btn btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444' }} onClick={async () => { toast.dismiss(t.id); try { await deleteCrawlerSource(source.id); setSources((current) => current.filter((item) => item.id !== source.id)); toast.success('Deleted'); } catch (error: unknown) { toast.error(getErrorMessage(error, 'Delete failed')); } }}>Delete</button></div></div>, { duration: Infinity });
    };

    const crawl = async (source: CrawlerSource) => {
        setCrawlingId(source.id);
        try {
            const result = await runCrawl(source.id);
            if (result.status === 'running') toast.error(result.error || 'Already running');
            else toast.success(`created ${result.created}, found ${result.found}, attempts ${result.attempt_count}, ${result.duration_seconds}s`);
            if (result.run_id) {
                setPreferredRunIds((current) => ({ ...current, [source.id]: result.run_id as number }));
                setExpandedRuns(source.id);
            }
            await refresh();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Crawl failed'));
        } finally {
            setCrawlingId(null);
        }
    };

    if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading crawler sources...</div>;

    const active = sources.filter((s) => s.is_active).length;
    const running = sources.filter((s) => s.is_running).length;
    const healthy = sources.filter((s) => s.health_status === 'healthy').length;
    const attention = sources.filter((s) => ['warning', 'error', 'disabled'].includes(s.health_status)).length;
    const dueNow = sources.filter((s) => s.is_active && due(s.next_crawl_at)).length;
    const failed = sources.filter((s) => s.health_status === 'error').length;
    const paused = sources.filter((s) => !s.is_active).length;
    const query = searchText.trim().toLowerCase();
    const filteredSources = sortSources(
        sources.filter((source) => {
            const searchable = `${source.name} ${source.url} ${source.category_name || ''}`.toLowerCase();
            return (
                (!query || searchable.includes(query))
                && matchesHealthFilter(source, healthFilter)
                && matchesActiveFilter(source, activeFilter)
                && (sourceTypeFilter === 'all' || source.source_type === sourceTypeFilter)
            );
        }),
        sortKey,
    );
    const hasActiveFilters = Boolean(query) || healthFilter !== 'all' || activeFilter !== 'all' || sourceTypeFilter !== 'all' || sortKey !== 'attention';
    const resetFilters = () => {
        setSearchText('');
        setHealthFilter('all');
        setActiveFilter('all');
        setSourceTypeFilter('all');
        setSortKey('attention');
    };

    return (
        <div className="container" style={{ maxWidth: 1180, margin: '40px auto', padding: '0 1rem 4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div><h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.9rem' }}>Crawler Operations</h1><p style={{ margin: '0.45rem 0 0', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>Scheduler, retry, failure streak, and source health in one page.</p></div>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}><button className="btn btn-outline" onClick={() => void refresh()}>Refresh</button><button className="btn btn-primary" onClick={openNew}>Add Source</button></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.9rem', marginBottom: '1.5rem' }}>
                <Summary title="Total" value={sources.length} helper="all sources" />
                <Summary title="Active" value={active} helper="scheduler enabled" />
                <Summary title="Running" value={running} helper="lock protected" />
                <Summary title="Due Now" value={dueNow} helper="ready to run" />
                <Summary title="Healthy" value={healthy} helper="last run success" />
                <Summary title="Failed" value={failed} helper="last run error" />
                <Summary title="Paused" value={paused} helper="scheduler off" />
                <Summary title="Attention" value={attention} helper="warning or error" />
            </div>

            <div className="glass-panel" style={{ padding: '1rem 1.2rem', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.5fr) repeat(4, minmax(140px, 1fr)) auto', gap: '0.75rem', alignItems: 'end' }}>
                    <div>
                        <div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Search</div>
                        <input
                            aria-label="Search crawler sources"
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                            placeholder="Name, URL, category"
                            style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: 8, background: 'rgba(0,0,0,0.28)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div>
                        <div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Health</div>
                        <select aria-label="Health filter" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as HealthFilter)} style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: 8, background: 'rgba(0,0,0,0.28)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}>
                            <option value="all">All health</option>
                            <option value="attention">Needs attention</option>
                            <option value="due">Due now</option>
                            <option value="healthy">Healthy</option>
                            <option value="warning">Fallback</option>
                            <option value="error">Error</option>
                            <option value="running">Running</option>
                            <option value="paused">Paused</option>
                            <option value="disabled">Disabled</option>
                            <option value="pending">Pending</option>
                            <option value="idle">Idle</option>
                        </select>
                    </div>
                    <div>
                        <div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Scheduler</div>
                        <select aria-label="Scheduler filter" value={activeFilter} onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)} style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: 8, background: 'rgba(0,0,0,0.28)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}>
                            <option value="all">All states</option>
                            <option value="active">Active only</option>
                            <option value="paused">Paused only</option>
                        </select>
                    </div>
                    <div>
                        <div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Type</div>
                        <select aria-label="Source type filter" value={sourceTypeFilter} onChange={(event) => setSourceTypeFilter(event.target.value as SourceTypeFilter)} style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: 8, background: 'rgba(0,0,0,0.28)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}>
                            <option value="all">All types</option>
                            <option value="rss">RSS / Atom</option>
                            <option value="html">HTML</option>
                        </select>
                    </div>
                    <div>
                        <div style={{ marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Sort</div>
                        <select aria-label="Crawler sort" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: 8, background: 'rgba(0,0,0,0.28)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}>
                            <option value="attention">Attention first</option>
                            <option value="due">Due first</option>
                            <option value="latest">Latest run</option>
                            <option value="name">Name</option>
                        </select>
                    </div>
                    <button className="btn btn-outline" onClick={resetFilters} disabled={!hasActiveFilters}>Reset</button>
                </div>
                <div style={{ marginTop: '0.8rem', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                    Showing {filteredSources.length} of {sources.length} sources.
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem 1.2rem', marginBottom: '1.5rem' }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: '0.35rem' }}>Scheduler Command</div>
                <code style={{ color: 'var(--accent-primary)', fontSize: '0.84rem' }}>python backend/manage.py run_crawler_scheduler --poll-seconds 60</code>
            </div>

            {!sources.length ? <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No crawler sources.</div> : filteredSources.length === 0 ? <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No sources match the current filters.</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filteredSources.map((source) => {
                    const health = HEALTH[source.health_status];
                    return (
                        <div key={source.id} className="glass-panel" style={{ padding: '1.2rem 1.4rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
                                        <Badge text={source.source_type.toUpperCase()} color={source.source_type === 'rss' ? '#38bdf8' : '#fb923c'} />
                                        <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.04rem' }}>{source.name}</h3>
                                        <Badge text={health.label} color={health.color} />
                                        {source.category_name && <Badge text={source.category_name} color="#14b8a6" />}
                                        {!source.is_active && <Badge text="Scheduler Off" color="#94a3b8" />}
                                        {source.is_active && !source.is_running && due(source.next_crawl_at) && <Badge text="Due Now" color="#22c55e" />}
                                    </div>
                                    <div style={{ marginBottom: '0.45rem', fontSize: '0.83rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}><a href={source.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)' }}>{source.url}</a></div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                                        <Meta label="Next Run" value={source.is_active ? fmt(source.next_crawl_at) : 'Off'} />
                                        <Meta label="Last Run" value={fmt(source.last_crawled_at)} />
                                        <Meta label="Last Success" value={fmt(source.last_success_at)} />
                                        <Meta label="Last Start" value={fmt(source.last_run_started_at)} />
                                        <Meta label="Interval" value={`${source.crawl_interval} min`} />
                                        <Meta label="Retry" value={`${source.max_retries} / ${source.retry_backoff_minutes} min`} />
                                        <Meta label="Fail Streak" value={`${source.consecutive_failures}`} />
                                        <Meta label="Auto Disable" value={`${source.auto_disable_after_failures}`} />
                                    </div>
                                    {source.last_error_message && <div style={{ marginTop: '0.9rem', padding: '0.8rem 0.9rem', borderRadius: 10, border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(127,29,29,0.18)', color: '#fecaca', fontSize: '0.8rem', lineHeight: 1.55 }}><strong style={{ display: 'block', marginBottom: '0.25rem' }}>Last Error</strong>{source.last_error_message}</div>}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <button className="btn btn-outline" onClick={() => setExpandedLogs(expandedLogs === source.id ? null : source.id)}>Logs</button>
                                    <button className="btn btn-outline" onClick={() => setExpandedRuns(expandedRuns === source.id ? null : source.id)}>Runs</button>
                                    <button className="btn btn-outline" onClick={() => openEdit(source)}>Edit</button>
                                    <button className="btn btn-primary" onClick={() => crawl(source)} disabled={!source.is_active || source.is_running || crawlingId === source.id}>{crawlingId === source.id || source.is_running ? 'Running' : 'Run Now'}</button>
                                    <button className="btn btn-outline" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={() => remove(source)}>Delete</button>
                                </div>
                            </div>
                            {expandedLogs === source.id && <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                                {!source.logs.length ? <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>No logs yet.</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                                    {source.logs.slice(0, 8).map((log) => <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap', padding: '0.65rem 0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: 10 }}>
                                        <Badge text={RUN[log.status].label} color={RUN[log.status].color} />
                                        <Badge text={log.triggered_by === 'scheduled' ? 'Scheduled' : 'Manual'} color={log.triggered_by === 'scheduled' ? '#0ea5e9' : '#8b5cf6'} />
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.79rem' }}>{fmt(log.crawled_at)}</span>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.79rem' }}>found {log.articles_found}</span>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.79rem' }}>created {log.articles_created}</span>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.79rem' }}>attempts {log.attempt_count}</span>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.79rem' }}>{log.duration_seconds}s</span>
                                        {log.error_message && <span style={{ color: '#fca5a5', fontSize: '0.79rem' }}>{log.error_message}</span>}
                                    </div>)}
                                </div>}
                            </div>}
                            {expandedRuns === source.id && <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                                <CrawlerRunDrilldown sourceId={source.id} preferredRunId={preferredRunIds[source.id]} />
                            </div>}
                        </div>
                    );
                })}
            </div>}

            {showForm && <FormModal form={form} setForm={setForm} categories={categories} onSave={save} onClose={() => setShowForm(false)} saving={saving} />}
        </div>
    );
}

function Meta({ label, value }: { label: string; value: string }) {
    return <div><div style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', marginBottom: '0.2rem' }}>{label}</div><div style={{ color: 'var(--text-primary)', fontSize: '0.82rem', wordBreak: 'break-word' }}>{value}</div></div>;
}
