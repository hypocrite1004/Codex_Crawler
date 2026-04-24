"use client";

import Link from "next/link";

import type { Post } from "@/lib/api";

interface SummaryJSON {
    title?: string;
    brief?: string;
    summary?: string;
    hashtag?: string[];
}

function parseSummary(summary: string | null): SummaryJSON | null {
    if (!summary) return null;

    try {
        return JSON.parse(summary) as SummaryJSON;
    } catch {
        return { summary };
    }
}

function truncate(value: string, limit = 220) {
    const clean = value.replace(/\s+/g, " ").trim();
    if (clean.length <= limit) return clean;
    return `${clean.slice(0, limit).trim()}...`;
}

function keywordFromTag(tag: string) {
    return tag.replace(/^#/, "").trim();
}

function discoveryHref(query: string) {
    return `/?search=${encodeURIComponent(query)}&has_security_context=true`;
}

function formatDate(value?: string | null) {
    if (!value) return "Unknown date";
    return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function severityColor(severity: string) {
    const normalized = severity.toUpperCase();
    if (["CRITICAL", "HIGH"].includes(normalized)) return "#fb7185";
    if (normalized === "MEDIUM") return "#fbbf24";
    if (normalized === "LOW") return "#38bdf8";
    return "var(--text-secondary)";
}

function Signal({ label, value }: { label: string; value: string | number }) {
    return (
        <div style={{ padding: "0.75rem 0.85rem", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid var(--glass-border)" }}>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
            <div style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "0.95rem" }}>{value}</div>
        </div>
    );
}

export default function PostUnderstandingCard({ post }: { post: Post }) {
    const summary = parseSummary(post.summary);
    const summaryText = summary?.brief || summary?.summary || summary?.title || "";
    const keywords = (summary?.hashtag || []).map(keywordFromTag).filter(Boolean).slice(0, 6);
    const cveMentions = post.cve_mentions || [];
    const iocs = post.iocs || [];
    const relatedPosts = post.related_posts_list || [];
    const publishedDate = post.published_at || post.created_at;
    const hasEnrichedContext = Boolean(summaryText || cveMentions.length || iocs.length || relatedPosts.length);

    return (
        <section
            aria-label="Why this post matters"
            style={{
                marginBottom: "2rem",
                padding: "1.35rem",
                borderRadius: 18,
                border: "1px solid rgba(56,189,248,0.28)",
                background: "linear-gradient(135deg, rgba(14,165,233,0.12), rgba(15,23,42,0.72) 46%, rgba(20,184,166,0.08))",
                boxShadow: "0 18px 45px rgba(2,6,23,0.28)",
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                <div>
                    <div style={{ color: "#38bdf8", fontSize: "0.76rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                        Security context
                    </div>
                    <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.35rem" }}>
                        Why this matters
                    </h2>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-start" }}>
                    {post.is_shared && <span style={{ color: "#34d399", border: "1px solid rgba(52,211,153,0.35)", background: "rgba(52,211,153,0.1)", borderRadius: 999, padding: "0.35rem 0.7rem", fontSize: "0.78rem", fontWeight: 700 }}>Curated</span>}
                    {post.is_summarized && <span style={{ color: "#38bdf8", border: "1px solid rgba(56,189,248,0.35)", background: "rgba(56,189,248,0.1)", borderRadius: 999, padding: "0.35rem 0.7rem", fontSize: "0.78rem", fontWeight: 700 }}>Summarized</span>}
                </div>
            </div>

            <p style={{ margin: "0 0 1rem", color: "var(--text-secondary)", lineHeight: 1.65, fontSize: "0.98rem" }}>
                {hasEnrichedContext
                    ? truncate(summaryText || `This post has ${cveMentions.length} CVE, ${iocs.length} IOC, and ${relatedPosts.length} related coverage signal(s).`)
                    : "No enriched security metadata is available yet. Use the source, date, and article body to judge whether to continue reading."}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.7rem", marginBottom: "1rem" }}>
                <Signal label="CVE" value={cveMentions.length} />
                <Signal label="IOC" value={iocs.length} />
                <Signal label="Related" value={relatedPosts.length} />
                <Signal label="Published" value={formatDate(publishedDate)} />
                <Signal label="Source" value={post.site || "Unknown"} />
            </div>

            {cveMentions.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem", marginBottom: "0.9rem" }}>
                    {cveMentions.slice(0, 5).map((mention) => (
                        <Link
                            key={mention.id}
                            href={`/cves/${mention.cve}`}
                            style={{
                                textDecoration: "none",
                                padding: "0.55rem 0.75rem",
                                borderRadius: 12,
                                border: "1px solid rgba(248,113,113,0.28)",
                                background: "rgba(127,29,29,0.16)",
                                color: "var(--text-primary)",
                                fontSize: "0.84rem",
                                fontWeight: 700,
                            }}
                        >
                            {mention.cve_id}
                            {mention.severity && <span style={{ color: severityColor(mention.severity), marginLeft: 8 }}>{mention.severity}</span>}
                        </Link>
                    ))}
                </div>
            )}

            {(iocs.length > 0 || keywords.length > 0) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {iocs.slice(0, 6).map((ioc) => (
                        <Link key={ioc} href={discoveryHref(ioc)} style={{ color: "#93c5fd", border: "1px solid rgba(147,197,253,0.28)", background: "rgba(59,130,246,0.1)", borderRadius: 999, padding: "0.35rem 0.65rem", textDecoration: "none", fontSize: "0.78rem" }}>
                            IOC: {ioc}
                        </Link>
                    ))}
                    {keywords.map((keyword) => (
                        <Link key={keyword} href={discoveryHref(keyword)} style={{ color: "#5eead4", border: "1px solid rgba(94,234,212,0.28)", background: "rgba(20,184,166,0.1)", borderRadius: 999, padding: "0.35rem 0.65rem", textDecoration: "none", fontSize: "0.78rem" }}>
                            #{keyword}
                        </Link>
                    ))}
                </div>
            )}
        </section>
    );
}
