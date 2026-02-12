"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ───

interface SourceItem {
  title: string;
  url: string;
  score: number;
  comments: number;
  source: "reddit" | "hackernews";
}

interface BriefingData {
  summary: string;
  sources?: SourceItem[];
  generated_at: string;
}

interface ActionItem {
  id: string;
  text: string;
  completed: boolean;
}

// ─── Constants ───

const SECTION_CONFIG: Record<string, { icon: string; gradient: string }> = {
  "COMMUNITY PULSE": {
    icon: "📡",
    gradient: "from-amber-500/10 to-transparent",
  },
  "KEY DEVELOPMENTS": {
    icon: "⚡",
    gradient: "from-orange-500/10 to-transparent",
  },
  "WHAT THIS MEANS FOR TP": {
    icon: "🎯",
    gradient: "from-amber-600/10 to-transparent",
  },
};

const QUICK_LINKS = [
  { label: "n8n", url: "http://localhost:5678" },
  { label: "Vercel", url: "https://vercel.com/dashboard" },
  { label: "Anthropic", url: "https://console.anthropic.com" },
  { label: "Tiger Pinnacle", url: "https://tigerpinnacle.com" },
  { label: "Claude", url: "https://claude.ai" },
];

const LS_KEY = "tp-action-items";
const LS_NOTES_KEY = "tp-notes";

// ─── Helpers ───

function parseSections(markdown: string) {
  const sections: {
    title: string;
    content: string;
    icon: string;
    gradient: string;
  }[] = [];
  const parts = markdown.split(/###\s+/);

  for (const part of parts) {
    if (!part.trim()) continue;
    const lines = part.trim().split("\n");
    const title = lines[0].replace(/\*+/g, "").trim();
    const content = lines.slice(1).join("\n").trim();

    const match = Object.entries(SECTION_CONFIG).find(([key]) =>
      title.toUpperCase().includes(key)
    );

    if (content && match) {
      sections.push({
        title: match[0],
        content,
        icon: match[1].icon,
        gradient: match[1].gradient,
      });
    }
  }

  return sections;
}

function highlightNumbers(html: string) {
  return html.replace(
    /(?<![<\w\d#/])(\d[\d,]*\.?\d*(?:\+|↑|↓|%|B|K|M|x)?)/g,
    '<span class="text-amber-400 font-medium tabular-nums">$1</span>'
  );
}

function formatBullets(text: string) {
  return text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    let formatted = trimmed
      .replace(/^\d+\.\s*/, "")
      .replace(
        /\*\*(.*?)\*\*/g,
        '<span class="text-white font-semibold">$1</span>'
      );

    formatted = highlightNumbers(formatted);

    const isBullet = trimmed.startsWith("-") || trimmed.startsWith("•");
    const isNumbered = /^\d+\./.test(trimmed);
    const cleanLine =
      isBullet || isNumbered ? formatted.replace(/^[-•]\s*/, "") : formatted;

    if (isBullet || isNumbered) {
      return (
        <div key={i} className="flex gap-3 items-start mb-3 group">
          <span className="text-amber-500/80 mt-[3px] text-[10px] shrink-0 group-hover:text-amber-400 transition-colors">
            ▸
          </span>
          <p
            className="text-zinc-400 leading-relaxed text-sm"
            dangerouslySetInnerHTML={{ __html: cleanLine }}
          />
        </div>
      );
    }

    return (
      <p
        key={i}
        className="text-zinc-400 leading-relaxed text-sm mb-3"
        dangerouslySetInnerHTML={{ __html: formatted }}
      />
    );
  });
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Inline SVG icons ───

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={`transition-transform duration-300 ${collapsed ? "-rotate-90" : "rotate-0"}`}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      className={spinning ? "animate-spin-slow" : ""}
    >
      <path
        d="M2 8a6 6 0 0 1 10.472-4M14 8a6 6 0 0 1-10.472 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M13 2v3h-3M3 14v-3h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Sub-components ───

type SourceFilter = "all" | "reddit" | "hackernews";

const FILTER_TABS: { key: SourceFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "reddit", label: "Reddit" },
  { key: "hackernews", label: "Hacker News" },
];

function SourceFeed({
  sources,
  filter,
  onFilterChange,
}: {
  sources: SourceItem[];
  filter: SourceFilter;
  onFilterChange: (f: SourceFilter) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const filtered =
    filter === "all" ? sources : sources.filter((s) => s.source === filter);
  const sorted = [...filtered].sort((a, b) => b.score - a.score);

  return (
    <section className="glass-card relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 sm:p-6 backdrop-blur-sm animate-card-3 mt-6">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
      <div className="relative">
        {/* Clickable header — collapsed by default */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center justify-between w-full text-left group"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">📰</span>
            <h2 className="text-[11px] font-semibold tracking-[0.15em] text-zinc-400 uppercase group-hover:text-zinc-300 transition-colors">
              Source Feed
            </h2>
            <span className="text-[10px] text-zinc-600 tabular-nums">
              {sources.length} sources
            </span>
          </div>
          <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors">
            <ChevronIcon collapsed={!expanded} />
          </span>
        </button>

        {/* Collapsible body */}
        <div
          className={`collapsible-wrapper ${expanded ? "" : "collapsed"} mt-5`}
        >
          <div className="collapsible-inner">
            {/* Filter tabs */}
            <div className="flex gap-1 mb-4">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => onFilterChange(tab.key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    filter === tab.key
                      ? "bg-white/[0.08] text-zinc-200"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-0.5">
              {sorted.map((item, i) => {
                const isReddit = item.source === "reddit";
                return (
                  <a
                    key={i}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 -mx-3 rounded-lg hover:bg-white/[0.04] transition-colors group"
                  >
                    <span
                      className={`shrink-0 text-[9px] font-semibold uppercase tracking-wider w-8 text-center ${
                        isReddit ? "text-orange-400/70" : "text-amber-400/70"
                      }`}
                    >
                      {isReddit ? "R" : "HN"}
                    </span>
                    <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors truncate min-w-0 flex-1">
                      {item.title}
                    </span>
                    <span
                      className={`shrink-0 text-[11px] font-medium tabular-nums px-1.5 py-0.5 rounded ${
                        isReddit
                          ? "text-orange-400/90 bg-orange-400/[0.08]"
                          : "text-amber-400/90 bg-amber-400/[0.08]"
                      }`}
                    >
                      {item.score >= 1000
                        ? `${(item.score / 1000).toFixed(1)}k`
                        : item.score}
                    </span>
                    <span className="shrink-0 text-[11px] text-zinc-600 tabular-nums w-12 text-right">
                      {item.comments}
                      <span className="text-zinc-700 ml-0.5">c</span>
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickLinksBar() {
  return (
    <div className="flex flex-wrap gap-2 mb-8 animate-quick-links">
      {QUICK_LINKS.map((link) => (
        <a
          key={link.label}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-full text-[11px] font-medium text-zinc-400 bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm hover:border-amber-500/20 hover:text-zinc-200 hover:shadow-[0_0_12px_-3px_rgba(245,158,11,0.1)] transition-all"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}

function ActionItemsSection({
  items,
  onAdd,
  onToggle,
  onDelete,
}: {
  items: ActionItem[];
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [input, setInput] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setInput("");
  }

  return (
    <section className="glass-card relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 sm:p-6 backdrop-blur-sm animate-card-4 mt-6">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-600/5 to-transparent pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-lg">📌</span>
          <h2 className="text-[11px] font-semibold tracking-[0.15em] text-zinc-400 uppercase">
            Action Items
          </h2>
          {items.length > 0 && (
            <span className="text-[10px] text-zinc-600 tabular-nums">
              {items.filter((i) => !i.completed).length} remaining
            </span>
          )}
        </div>

        {/* Add input */}
        <form onSubmit={handleSubmit} className="mb-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add an action item..."
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/30 transition-colors"
          />
        </form>

        {/* Item list */}
        {items.length === 0 ? (
          <p className="text-zinc-600 text-xs">
            No items yet. Type above and press Enter.
          </p>
        ) : (
          <div className="space-y-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-3 py-2 -mx-3 rounded-lg hover:bg-white/[0.04] transition-colors group"
              >
                {/* Checkbox */}
                <button
                  onClick={() => onToggle(item.id)}
                  className={`shrink-0 w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                    item.completed
                      ? "bg-amber-500/20 border-amber-500/40"
                      : "border-white/[0.12] hover:border-amber-500/30"
                  }`}
                >
                  {item.completed && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                    >
                      <path
                        d="M2 5l2.5 2.5L8 3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-amber-400"
                      />
                    </svg>
                  )}
                </button>

                {/* Text */}
                <span
                  className={`flex-1 text-sm min-w-0 transition-colors ${
                    item.completed
                      ? "line-through text-zinc-600"
                      : "text-zinc-300"
                  }`}
                >
                  {item.text}
                </span>

                {/* Delete */}
                <button
                  onClick={() => onDelete(item.id)}
                  className="shrink-0 text-zinc-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-xs"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function NotesSection({
  notes,
  onChange,
}: {
  notes: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="glass-card relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 sm:p-6 backdrop-blur-sm animate-card-5 mt-6">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-lg">💡</span>
          <h2 className="text-[11px] font-semibold tracking-[0.15em] text-zinc-400 uppercase">
            Notes &amp; Ideas
          </h2>
        </div>
        <textarea
          value={notes}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Jot down notes, ideas, follow-ups..."
          rows={6}
          className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-zinc-300 placeholder:text-zinc-600 leading-relaxed resize-y focus:outline-none focus:border-amber-500/30 transition-colors"
        />
      </div>
    </section>
  );
}

function WeekArchive() {
  return (
    <div className="mt-6 rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5 sm:p-6 animate-card-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-lg opacity-50">📂</span>
        <h2 className="text-[11px] font-semibold tracking-[0.15em] text-zinc-600 uppercase">
          Previous Briefings
        </h2>
      </div>
      <p className="text-zinc-600 text-xs leading-relaxed">
        Archive coming soon — briefings will appear here after 7 days of data.
      </p>
    </div>
  );
}

// ─── Main dashboard ───

export default function Dashboard() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(
    new Set()
  );
  const [timeAgo, setTimeAgo] = useState("");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [notes, setNotes] = useState("");

  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  // ─── Fetch briefing data ───
  const fetchBriefing = useCallback(async () => {
    try {
      const res = await fetch("/briefing.json", { cache: "no-store" });
      const data = await res.json();
      const d = Array.isArray(data) ? data[0] : data;
      setBriefing(d);
    } catch {
      // silently fail on refetch
    }
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    fetchBriefing().then(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchBriefing]);

  // ─── Load action items from localStorage on mount ───
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) setActionItems(JSON.parse(stored));
    } catch {
      // ignore corrupt data
    }
  }, []);

  // ─── Persist action items to localStorage on change ───
  const isInitialMount = useRef(true);
  useEffect(() => {
    // Skip the first render so we don't overwrite with empty array
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    localStorage.setItem(LS_KEY, JSON.stringify(actionItems));
  }, [actionItems]);

  // ─── Load notes from localStorage on mount ───
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_NOTES_KEY);
      if (stored) setNotes(stored);
    } catch {
      // ignore
    }
  }, []);

  // ─── Persist notes to localStorage on change (debounced) ───
  useEffect(() => {
    if (isInitialMount.current) return;
    const timeout = setTimeout(() => {
      localStorage.setItem(LS_NOTES_KEY, notes);
    }, 400);
    return () => clearTimeout(timeout);
  }, [notes]);

  // ─── "Last updated: X ago" ticker ───
  useEffect(() => {
    if (!briefing) return;
    const tick = () => setTimeAgo(getTimeAgo(briefing.generated_at));
    const interval = setInterval(tick, 30_000);
    tick();
    return () => clearInterval(interval);
  }, [briefing]);

  // ─── Scroll progress bar ───
  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docHeight > 0 ? scrollTop / docHeight : 0);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ─── Keyboard shortcuts: 1, 2, 3 to jump to sections ───
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx <= 2) {
        sectionRefs.current[idx]?.scrollIntoView({ behavior: "smooth" });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ─── Refresh handler ───
  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    await fetchBriefing();
    setRefreshing(false);
  }

  // ─── Toggle collapse ───
  function toggleSection(index: number) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  // ─── Action item handlers ───
  function addActionItem(text: string) {
    setActionItems((prev) => [
      ...prev,
      { id: Date.now().toString(), text, completed: false },
    ]);
  }

  function toggleActionItem(id: string) {
    setActionItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  }

  function deleteActionItem(id: string) {
    setActionItems((prev) => prev.filter((item) => item.id !== id));
  }

  // ─── Loading / empty states ───

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          <span className="text-zinc-500 text-sm tracking-wide">
            Loading briefing...
          </span>
        </div>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500">No briefing available yet.</p>
      </div>
    );
  }

  const sections = parseSections(briefing.summary);
  const date = new Date(briefing.generated_at);
  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const cardDelays = ["animate-card-0", "animate-card-1", "animate-card-2"];

  return (
    <div className="min-h-screen bg-zinc-950 text-white safe-top safe-bottom">
      {/* Reading progress bar — sits below the safe area on notched iPhones */}
      <div
        className="fixed left-0 h-[2px] bg-amber-500 z-[60] transition-[width] duration-150 ease-out"
        style={{
          top: "env(safe-area-inset-top, 0px)",
          width: `${scrollProgress * 100}%`,
        }}
      />

      {/* Top gradient accent bar */}
      <div
        className="top-gradient-bar fixed left-0 right-0 h-px z-50"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 2px)" }}
      />

      {/* Grid overlay */}
      <div className="grid-overlay fixed inset-0 pointer-events-none z-0" />

      {/* Animated ambient gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="orb-1 absolute -top-32 left-1/4 w-[500px] h-[500px] bg-amber-500 rounded-full blur-[120px]" />
        <div className="orb-2 absolute -bottom-48 right-1/5 w-[400px] h-[400px] bg-orange-600 rounded-full blur-[100px]" />
        <div className="orb-3 absolute top-1/2 -right-24 w-[350px] h-[350px] bg-amber-700 rounded-full blur-[110px]" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <header className="mb-10 sm:mb-12 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-600 rounded-lg flex items-center justify-center text-[11px] font-bold tracking-tight text-white shadow-lg shadow-amber-500/20">
                TP
              </div>
              <span className="text-zinc-500 text-[11px] tracking-[0.2em] uppercase font-medium">
                Tiger Pinnacle Intelligence
              </span>
            </div>

            {/* Live indicator */}
            <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="live-pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                <span className="live-dot relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-emerald-400 text-[11px] font-medium">
                Live
              </span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-light tracking-tight animate-text-reveal">
            Morning Briefing
          </h1>

          {/* Timestamp row */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 animate-fade-in-delay-2">
            <span className="text-zinc-500 text-sm">{formattedDate}</span>
            <span className="text-zinc-700 hidden sm:inline">&bull;</span>
            <span className="text-zinc-600 text-sm">
              Generated {formattedTime}
            </span>
            <span className="text-zinc-700 hidden sm:inline">&bull;</span>
            <span className="text-zinc-600 text-xs">Updated {timeAgo}</span>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-zinc-500 hover:text-amber-400 transition-colors p-1 rounded-md hover:bg-white/[0.04] disabled:opacity-40"
              title="Refresh briefing"
            >
              <RefreshIcon spinning={refreshing} />
            </button>
          </div>
        </header>

        {/* Quick Links */}
        <QuickLinksBar />

        {/* Briefing Section Cards */}
        <div className="space-y-6">
          {sections.map((section, i) => {
            const isCollapsed = collapsedSections.has(i);
            return (
              <section
                key={i}
                ref={(el) => {
                  sectionRefs.current[i] = el;
                }}
                id={`section-${i}`}
                className={`glass-card relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 sm:p-6 backdrop-blur-sm ${cardDelays[i] || "animate-card-2"}`}
              >
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${section.gradient} pointer-events-none`}
                />

                <div className="relative">
                  <button
                    onClick={() => toggleSection(i)}
                    className="flex items-center justify-between w-full text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{section.icon}</span>
                      <h2 className="text-[11px] font-semibold tracking-[0.15em] text-zinc-400 uppercase group-hover:text-zinc-300 transition-colors">
                        {section.title}
                      </h2>
                    </div>
                    <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors">
                      <ChevronIcon collapsed={isCollapsed} />
                    </span>
                  </button>

                  <div
                    className={`collapsible-wrapper ${isCollapsed ? "collapsed" : ""} mt-5`}
                  >
                    <div className="collapsible-inner">
                      {formatBullets(section.content)}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {/* Source Feed */}
        {briefing.sources && briefing.sources.length > 0 && (
          <SourceFeed
            sources={briefing.sources}
            filter={sourceFilter}
            onFilterChange={setSourceFilter}
          />
        )}

        {/* Action Items */}
        <ActionItemsSection
          items={actionItems}
          onAdd={addActionItem}
          onToggle={toggleActionItem}
          onDelete={deleteActionItem}
        />

        {/* Notes & Ideas */}
        <NotesSection notes={notes} onChange={setNotes} />

        {/* Week Archive */}
        <WeekArchive />

        {/* Footer */}
        <footer className="mt-14 sm:mt-16 pt-6 border-t border-white/[0.06] animate-fade-in-footer">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <p className="text-zinc-600 text-xs">
              Automated via n8n &bull; Claude Sonnet 4.5 &bull; Reddit + Hacker
              News
            </p>
            <p className="text-zinc-700 text-xs">Internal use only</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
