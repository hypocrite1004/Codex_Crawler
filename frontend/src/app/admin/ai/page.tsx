"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
    fetchAIConfig,
    fetchAIModels,
    fetchProfile,
    getErrorMessage,
    testClustering,
    updateAIConfig,
    type AIConfig,
    type AIModelItem,
    type ClusteringTestResult,
} from '@/lib/api';

type AISettingsForm = Omit<AIConfig, 'id' | 'updated_at'>;

const DEFAULT_FORM: AISettingsForm = {
    model: '',
    system_prompt: '',
    max_tokens: 500,
    temperature: 0.3,
    similarity_threshold: 0.2,
    telegram_bot_token: '',
    telegram_chat_id: '',
};

export default function AISettingsPage() {
    const router = useRouter();
    const [config, setConfig] = useState<AIConfig | null>(null);
    const [form, setForm] = useState<AISettingsForm>(DEFAULT_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [modelList, setModelList] = useState<AIModelItem[]>([]);
    const [modelSource, setModelSource] = useState<'openai' | 'fallback'>('fallback');
    const [modelLoading, setModelLoading] = useState(true);
    const [testResult, setTestResult] = useState<ClusteringTestResult | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [activeTab, setActiveTab] = useState<'model' | 'similarity' | 'telegram'>('model');

    useEffect(() => {
        const init = async () => {
            try {
                const user = await fetchProfile();
                if (!user.is_superuser) {
                    toast.error('관리자만 접근할 수 있습니다.');
                    router.push('/');
                    return;
                }

                setIsAdmin(true);

                const [nextConfig, modelsData] = await Promise.all([
                    fetchAIConfig(),
                    fetchAIModels().catch(() => ({ models: [] as AIModelItem[], source: 'fallback' as const })),
                ]);

                setConfig(nextConfig);
                setForm({
                    model: nextConfig.model,
                    system_prompt: nextConfig.system_prompt,
                    max_tokens: nextConfig.max_tokens,
                    temperature: nextConfig.temperature,
                    similarity_threshold: nextConfig.similarity_threshold ?? 0.2,
                    telegram_bot_token: nextConfig.telegram_bot_token ?? '',
                    telegram_chat_id: nextConfig.telegram_chat_id ?? '',
                });
                setModelList(modelsData.models);
                setModelSource(modelsData.source);
            } catch {
                toast.error('AI 설정을 불러오지 못했습니다.');
                router.push('/login');
            } finally {
                setModelLoading(false);
                setLoading(false);
            }
        };

        void init();
    }, [router]);

    const updateField = <K extends keyof AISettingsForm>(field: K, value: AISettingsForm[K]) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const handleTestClustering = async () => {
        setIsTesting(true);
        setTestResult(null);

        try {
            const result = await testClustering(form.similarity_threshold);
            setTestResult(result);
            toast.success('군집 테스트를 완료했습니다.');
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, '군집 테스트에 실패했습니다.'));
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);

        try {
            const updated = await updateAIConfig(form);
            setConfig(updated);
            toast.success('AI 설정을 저장했습니다.');
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'AI 설정 저장에 실패했습니다.'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="container" style={{ padding: '4rem 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                AI 설정 로딩 중...
            </div>
        );
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <div className="container" style={{ maxWidth: '820px', padding: '3rem 24px' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ margin: 0, fontSize: '2rem', color: 'var(--text-primary)' }}>AI 설정 관리</h1>
                <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    요약 모델, 군집화 임계값, Telegram 알림 설정을 관리합니다.
                </p>
                {config && (
                    <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        마지막 저장: {new Date(config.updated_at).toLocaleString('ko-KR')}
                    </p>
                )}
            </div>

            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
                {[
                    { id: 'model', label: '모델' },
                    { id: 'similarity', label: '유사도' },
                    { id: 'telegram', label: 'Telegram' },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        style={{
                            padding: '0.7rem 1rem',
                            border: 'none',
                            background: 'transparent',
                            borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                            color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontWeight: activeTab === tab.id ? 600 : 400,
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {activeTab === 'model' && (
                    <>
                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                요약 모델
                            </label>
                            {modelLoading ? (
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>모델 목록 로딩 중...</div>
                            ) : (
                                <>
                                    <select
                                        value={form.model}
                                        onChange={(event) => updateField('model', event.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.7rem 1rem',
                                            borderRadius: '8px',
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid var(--glass-border)',
                                            color: 'var(--text-primary)',
                                        }}
                                    >
                                        {Array.from(new Set(modelList.map((item) => item.category))).map((category) => (
                                            <optgroup key={category} label={category}>
                                                {modelList
                                                    .filter((item) => item.category === category)
                                                    .map((item) => (
                                                        <option key={item.id} value={item.id}>
                                                            {item.id}
                                                        </option>
                                                    ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                    <p style={{ margin: '0.6rem 0 0.4rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                        모델 소스: {modelSource === 'openai' ? 'OpenAI 실시간 목록' : '기본 목록'}
                                    </p>
                                </>
                            )}
                            <input
                                type="text"
                                value={form.model}
                                onChange={(event) => updateField('model', event.target.value)}
                                placeholder="예: gpt-4o-mini"
                                style={{
                                    marginTop: '0.6rem',
                                    width: '100%',
                                    padding: '0.65rem 1rem',
                                    borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid var(--glass-border)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                        </div>

                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                System Prompt
                            </label>
                            <textarea
                                value={form.system_prompt}
                                onChange={(event) => updateField('system_prompt', event.target.value)}
                                rows={10}
                                style={{
                                    width: '100%',
                                    padding: '0.8rem',
                                    borderRadius: '8px',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid var(--glass-border)',
                                    color: 'var(--text-primary)',
                                    fontFamily: 'monospace',
                                    resize: 'vertical',
                                }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.6rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                    최대 토큰 수
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={form.max_tokens}
                                    onChange={(event) => updateField('max_tokens', Number(event.target.value))}
                                    style={{
                                        width: '100%',
                                        padding: '0.65rem 1rem',
                                        borderRadius: '8px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--glass-border)',
                                        color: 'var(--text-primary)',
                                    }}
                                />
                            </div>
                            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.6rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                    Temperature
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    max={2}
                                    step={0.1}
                                    value={form.temperature}
                                    onChange={(event) => updateField('temperature', Number(event.target.value))}
                                    style={{
                                        width: '100%',
                                        padding: '0.65rem 1rem',
                                        borderRadius: '8px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--glass-border)',
                                        color: 'var(--text-primary)',
                                    }}
                                />
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'similarity' && (
                    <>
                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.6rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                유사도 임계값
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={1}
                                step={0.01}
                                value={form.similarity_threshold}
                                onChange={(event) => updateField('similarity_threshold', Number(event.target.value))}
                                style={{
                                    width: '100%',
                                    padding: '0.65rem 1rem',
                                    borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--glass-border)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                            <p style={{ margin: '0.6rem 0 0', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                                값이 낮을수록 더 많은 기사들이 하나의 이슈로 묶입니다.
                            </p>
                        </div>

                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                <div>
                                    <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>군집 테스트</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                                        현재 임계값으로 샘플 군집 결과를 미리 확인합니다.
                                    </div>
                                </div>
                                <button className="btn btn-outline" onClick={handleTestClustering} disabled={isTesting}>
                                    {isTesting ? '테스트 중...' : '군집 테스트 실행'}
                                </button>
                            </div>

                            {testResult && (
                                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                        테스트 기사 수: {testResult.total_tested}건, 군집 제외: {testResult.unclustered_count}건
                                    </div>
                                    {testResult.clusters.length === 0 ? (
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>생성된 군집이 없습니다.</div>
                                    ) : (
                                        testResult.clusters.map((cluster, index) => (
                                            <div key={`${cluster.parent}-${index}`} style={{ border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.9rem' }}>
                                                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{cluster.parent}</div>
                                                <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                    {cluster.children.map((child) => (
                                                        <li key={child}>{child}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'telegram' && (
                    <>
                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.6rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                Bot Token
                            </label>
                            <input
                                type="text"
                                value={form.telegram_bot_token}
                                onChange={(event) => updateField('telegram_bot_token', event.target.value)}
                                placeholder="123456789:ABCDEF..."
                                style={{
                                    width: '100%',
                                    padding: '0.65rem 1rem',
                                    borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--glass-border)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                        </div>

                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.6rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                Chat ID
                            </label>
                            <input
                                type="text"
                                value={form.telegram_chat_id}
                                onChange={(event) => updateField('telegram_chat_id', event.target.value)}
                                placeholder="-1001234567890"
                                style={{
                                    width: '100%',
                                    padding: '0.65rem 1rem',
                                    borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--glass-border)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                        </div>
                    </>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? '저장 중...' : '설정 저장'}
                </button>
            </div>
        </div>
    );
}
