'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchCrawlerRunItems, fetchCrawlerRuns, getErrorMessage, type CrawlItem, type CrawlerRun } from '@/lib/api';

const RUN_META: Record<CrawlerRun['status'], { label: string; color: string }> = {
  running: { label: 'Running', color: '#3b82f6' },
  success: { label: 'Success', color: '#10b981' },
  playwright_fallback: { label: 'Playwright', color: '#f59e0b' },
  error: { label: 'Error', color: '#ef4444' },
};

const ITEM_META: Record<CrawlItem['item_status'], { label: string; color: string }> = {
  created: { label: 'Created', color: '#10b981' },
  duplicate: { label: 'Duplicate', color: '#f59e0b' },
  filtered: { label: 'Filtered', color: '#94a3b8' },
  error: { label: 'Error', color: '#ef4444' },
};

function Badge({ text, color }: { text: string; color: string }) {
  return <span style={{ padding: '0.16rem 0.48rem', borderRadius: 999, color, background: `${color}1f`, border: `1px solid ${color}40`, fontSize: '0.72rem', fontWeight: 700 }}>{text}</span>;
}

function fmt(date: string | null | undefined) {
  return date ? new Date(date).toLocaleString('ko-KR') : 'None';
}

function metric(label: string, value: number) {
  return (
    <div style={{ padding: '0.65rem 0.75rem', borderRadius: 8, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)' }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function itemTitle(item: CrawlItem) {
  const title = item.title || (typeof item.payload.title === 'string' ? item.payload.title : '');
  return title || '(No title)';
}

export function CrawlerRunDrilldown({ sourceId, preferredRunId }: { sourceId: number; preferredRunId?: number | null }) {
  const [runs, setRuns] = useState<CrawlerRun[]>([]);
  const [items, setItems] = useState<CrawlItem[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(preferredRunId ?? null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadRuns = async () => {
      setLoadingRuns(true);
      setError('');
      try {
        const data = await fetchCrawlerRuns(sourceId);
        if (!active) return;
        setRuns(data);
        const selected = preferredRunId && data.some((run) => run.id === preferredRunId)
          ? preferredRunId
          : data[0]?.id ?? null;
        setSelectedRunId(selected);
      } catch (err: unknown) {
        if (!active) return;
        setError(getErrorMessage(err, 'Failed to load crawler runs'));
      } finally {
        if (active) setLoadingRuns(false);
      }
    };
    void loadRuns();
    return () => { active = false; };
  }, [sourceId, preferredRunId]);

  useEffect(() => {
    let active = true;
    const loadItems = async () => {
      if (!selectedRunId) {
        setItems([]);
        return;
      }
      setLoadingItems(true);
      setError('');
      try {
        const data = await fetchCrawlerRunItems(selectedRunId);
        if (active) {
          setItems(data);
        }
      } catch (err: unknown) {
        if (active) setError(getErrorMessage(err, 'Failed to load crawl items'));
      } finally {
        if (active) setLoadingItems(false);
      }
    };
    void loadItems();
    return () => { active = false; };
  }, [selectedRunId]);

  if (loadingRuns) {
    return <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Loading run history...</div>;
  }

  if (error) {
    return <div style={{ color: '#fca5a5', fontSize: '0.82rem' }}>{error}</div>;
  }

  if (!runs.length) {
    return <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>No run history yet.</div>;
  }

  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0];
  const grouped = items.reduce<Record<CrawlItem['item_status'], CrawlItem[]>>(
    (acc, item) => {
      acc[item.item_status].push(item);
      return acc;
    },
    { created: [], duplicate: [], filtered: [], error: [] },
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)', gap: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {runs.map((run) => {
          const meta = RUN_META[run.status];
          const active = run.id === selectedRun.id;
          return (
            <button
              key={run.id}
              type="button"
              onClick={() => setSelectedRunId(run.id)}
              style={{
                padding: '0.75rem',
                borderRadius: 8,
                border: active ? `1px solid ${meta.color}` : '1px solid var(--glass-border)',
                background: active ? `${meta.color}17` : 'rgba(0,0,0,0.18)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                <Badge text={meta.label} color={meta.color} />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>#{run.id}</span>
              </div>
              <div style={{ marginTop: '0.45rem', color: 'var(--text-primary)', fontSize: '0.8rem' }}>{fmt(run.started_at)}</div>
              <div style={{ marginTop: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                {run.triggered_by} · created {run.articles_created} · errors {run.error_count}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge text={RUN_META[selectedRun.status].label} color={RUN_META[selectedRun.status].color} />
              <Badge text={selectedRun.triggered_by === 'scheduled' ? 'Scheduled' : 'Manual'} color={selectedRun.triggered_by === 'scheduled' ? '#0ea5e9' : '#8b5cf6'} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Run #{selectedRun.id}</span>
            </div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700, marginTop: '0.45rem' }}>{fmt(selectedRun.started_at)}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '0.2rem' }}>finished {fmt(selectedRun.finished_at)}</div>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{selectedRun.duration_seconds}s · attempts {selectedRun.attempt_count}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: '0.55rem', marginBottom: '0.9rem' }}>
          {metric('Found', selectedRun.articles_found)}
          {metric('Created', selectedRun.articles_created)}
          {metric('Duplicate', selectedRun.duplicate_count)}
          {metric('Filtered', selectedRun.filtered_count)}
          {metric('Errors', selectedRun.error_count)}
          {metric('Items', selectedRun.item_count)}
        </div>

        {selectedRun.error_message && (
          <div style={{ marginBottom: '0.9rem', padding: '0.75rem 0.85rem', borderRadius: 8, border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(127,29,29,0.16)', color: '#fecaca', fontSize: '0.8rem', lineHeight: 1.55 }}>
            {selectedRun.error_message}
          </div>
        )}

        {loadingItems ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Loading crawl items...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(['created', 'duplicate', 'filtered', 'error'] as const).map((status) => (
              <div key={status} style={{ border: '1px solid var(--glass-border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.04)' }}>
                  <Badge text={ITEM_META[status].label} color={ITEM_META[status].color} />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.76rem' }}>{grouped[status].length}</span>
                </div>
                {!grouped[status].length ? (
                  <div style={{ padding: '0.7rem 0.75rem', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>No items.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {grouped[status].map((item) => (
                      <div key={item.id} style={{ padding: '0.7rem 0.75rem', borderTop: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <div style={{ color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 700, minWidth: 0 }}>{itemTitle(item)}</div>
                          {item.post_id && <Link href={`/posts/${item.post_id}`} style={{ color: 'var(--accent-primary)', fontSize: '0.78rem' }}>Open post</Link>}
                        </div>
                        {item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: '0.25rem', color: 'var(--accent-primary)', fontSize: '0.74rem', wordBreak: 'break-all' }}>{item.source_url}</a>}
                        {item.error_message && <div style={{ marginTop: '0.35rem', color: '#fca5a5', fontSize: '0.76rem' }}>{item.error_message}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
