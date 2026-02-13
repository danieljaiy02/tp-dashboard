"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ───

interface SourceItem {
  title: string;
  url: string;
  score: number;
  comments: number;
  source: string;
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
  "QUICK BRIEF": {
    icon: "⚡",
    gradient: "from-amber-400/10 to-orange-500/5",
  },
  "COMMUNITY PULSE": {
    icon: "📡",
    gradient: "from-amber-500/10 to-transparent",
  },
  "KEY DEVELOPMENTS": {
    icon: "🔑",
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

// ─── Source styling ───

const SOURCE_COLORS: Record<
  string,
  { dot: string; text: string; bg: string; label: string }
> = {
  reddit: {
    dot: "bg-orange-400",
    text: "text-orange-400/90",
    bg: "bg-orange-400/10",
    label: "Reddit",
  },
  hackernews: {
    dot: "bg-amber-400",
    text: "text-amber-400/90",
    bg: "bg-amber-400/10",
    label: "HN",
  },
  techcrunch: {
    dot: "bg-green-400",
    text: "text-green-400/90",
    bg: "bg-green-400/10",
    label: "TC",
  },
  arxiv: {
    dot: "bg-purple-400",
    text: "text-purple-400/90",
    bg: "bg-purple-400/10",
    label: "arXiv",
  },
  stanford: {
    dot: "bg-purple-400",
    text: "text-purple-400/90",
    bg: "bg-purple-400/10",
    label: "Stanford",
  },
  deepmind: {
    dot: "bg-cyan-400",
    text: "text-cyan-400/90",
    bg: "bg-cyan-400/10",
    label: "DeepMind",
  },
  anthropic: {
    dot: "bg-cyan-400",
    text: "text-cyan-400/90",
    bg: "bg-cyan-400/10",
    label: "Anthropic",
  },
  openai: {
    dot: "bg-cyan-400",
    text: "text-cyan-400/90",
    bg: "bg-cyan-400/10",
    label: "OpenAI",
  },
  mckinsey: {
    dot: "bg-blue-400",
    text: "text-blue-400/90",
    bg: "bg-blue-400/10",
    label: "McKinsey",
  },
  bcg: {
    dot: "bg-blue-400",
    text: "text-blue-400/90",
    bg: "bg-blue-400/10",
    label: "BCG",
  },
  bain: {
    dot: "bg-blue-400",
    text: "text-blue-400/90",
    bg: "bg-blue-400/10",
    label: "Bain",
  },
  bessemer: {
    dot: "bg-pink-400",
    text: "text-pink-400/90",
    bg: "bg-pink-400/10",
    label: "BVP",
  },
  theverge: {
    dot: "bg-emerald-400",
    text: "text-emerald-400/90",
    bg: "bg-emerald-400/10",
    label: "Verge",
  },
  arstechnica: {
    dot: "bg-emerald-400",
    text: "text-emerald-400/90",
    bg: "bg-emerald-400/10",
    label: "Ars",
  },
};

const DEFAULT_SOURCE_STYLE = {
  dot: "bg-zinc-500",
  text: "text-zinc-400/90",
  bg: "bg-zinc-400/10",
  label: "",
};

function getSourceStyle(source: string) {
  return SOURCE_COLORS[source.toLowerCase()] || DEFAULT_SOURCE_STYLE;
}

type SourceFilter =
  | "all"
  | "reddit"
  | "hackernews"
  | "techcrunch"
  | "research"
  | "consulting";

const FILTER_TABS: { key: SourceFilter; label: string; sources: string[] }[] =
  [
    { key: "all", label: "All", sources: [] },
    { key: "reddit", label: "Reddit", sources: ["reddit"] },
    { key: "hackernews", label: "HN", sources: ["hackernews"] },
    { key: "techcrunch", label: "TechCrunch", sources: ["techcrunch"] },
    {
      key: "research",
      label: "Research",
      sources: ["arxiv", "stanford", "deepmind"],
    },
    {
      key: "consulting",
      label: "Consulting",
      sources: ["mckinsey", "bcg", "bain"],
    },
  ];

// ─── Helpers ───

function parseSections(markdown: string) {
  const sections: {
    title: string;
    content: string;
    icon: string;
    gradient: string;
  }[] = [];

  const lines = markdown.split("\n");
  let currentTitle = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headerMatch) {
      if (currentTitle && currentContent.length > 0) {
        const trimmedContent = currentContent.join("\n").trim();
        const match = Object.entries(SECTION_CONFIG).find(([key]) =>
          currentTitle.toUpperCase().includes(key)
        );
        if (match && trimmedContent) {
          sections.push({
            title: match[0],
            content: trimmedContent,
            icon: match[1].icon,
            gradient: match[1].gradient,
          });
        }
      }
      currentTitle = headerMatch[1].replace(/\*+/g, "").trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentTitle && currentContent.length > 0) {
    const trimmedContent = currentContent.join("\n").trim();
    const match = Object.entries(SECTION_CONFIG).find(([key]) =>
      currentTitle.toUpperCase().includes(key)
    );
    if (match && trimmedContent) {
      sections.push({
        title: match[0],
        content: trimmedContent,
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

function formatBullets(text: string, large = false) {
  const textClass = large
    ? "text-[15px] sm:text-base text-zinc-300 leading-relaxed"
    : "text-[15px] sm:text-sm text-zinc-400 leading-relaxed";

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
            className={textClass}
            dangerouslySetInnerHTML={{ __html: cleanLine }}
          />
        </div>
      );
    }

    return (
      <p
        key={i}
        className={`${textClass} mb-3`}
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

function getReadTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

// ─── SVG Icons ───

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

function ArrowUpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M9 14V4m0 0L5 8m4-4l4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Main Dashboard ───

export default function Dashboard() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(
    new Set()
  );
  const [timeAgo, setTimeAgo] = useState("");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sourceFeedExpanded, setSourceFeedExpanded] = useState(false);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [actionInput, setActionInput] = useState("");
  const [notes, setNotes] = useState("");

  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const isInitialMount = useRef(true);

  // ─── Fetch briefing data ───
  const fetchBriefing = useCallback(async () => {
    try {
      const res = await fetch(`/briefing.json?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      const d = Array.isArray(data) ? data[0] : data;
      setBriefing(d);
    } catch {
      // silently fail on refetch
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchBriefing().then(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchBriefing]);

  // ─── Mobile: default collapse extended read sections ───
  useEffect(() => {
    if (window.innerWidth < 640) {
      setCollapsedSections(new Set([0, 1, 2]));
    }
  }, []);

  // ─── Load action items + notes from localStorage ───
  useEffect(() => {
    try {
      const storedItems = localStorage.getItem(LS_KEY);
      if (storedItems) setActionItems(JSON.parse(storedItems));
    } catch {
      // ignore
    }
    try {
      const storedNotes = localStorage.getItem(LS_NOTES_KEY);
      if (storedNotes) setNotes(storedNotes);
    } catch {
      // ignore
    }
  }, []);

  // ─── Persist action items ───
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    localStorage.setItem(LS_KEY, JSON.stringify(actionItems));
  }, [actionItems]);

  // ─── Persist notes (debounced) ───
  useEffect(() => {
    if (isInitialMount.current) return;
    const timeout = setTimeout(() => {
      localStorage.setItem(LS_NOTES_KEY, notes);
    }, 400);
    return () => clearTimeout(timeout);
  }, [notes]);

  // ─── Time ago ticker ───
  useEffect(() => {
    if (!briefing) return;
    const tick = () => setTimeAgo(getTimeAgo(briefing.generated_at));
    const interval = setInterval(tick, 30_000);
    tick();
    return () => clearInterval(interval);
  }, [briefing]);

  // ─── Scroll: progress bar + back-to-top ───
  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docHeight > 0 ? scrollTop / docHeight : 0);
      setShowBackToTop(scrollTop > 400);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ─── Keyboard shortcuts: 1, 2, 3 ───
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

  // ─── Handlers ───

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    await fetchBriefing();
    setRefreshing(false);
  }

  function toggleSection(index: number) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handleAddAction(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = actionInput.trim();
    if (!trimmed) return;
    setActionItems((prev) => [
      ...prev,
      { id: Date.now().toString(), text: trimmed, completed: false },
    ]);
    setActionInput("");
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

  // ─── Derived data ───

  const allSections = parseSections(briefing.summary);
  const quickBrief = allSections.find((s) => s.title === "QUICK BRIEF");
  const extendedSections = allSections.filter(
    (s) => s.title !== "QUICK BRIEF"
  );
  const readTime = getReadTime(briefing.summary);

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

  const sources = briefing.sources || [];
  const availableFilters = FILTER_TABS.filter(
    (tab) =>
      tab.key === "all" ||
      sources.some((s) => tab.sources.includes(s.source))
  );
  const filteredSources =
    sourceFilter === "all"
      ? sources
      : sources.filter((s) => {
          const tab = FILTER_TABS.find((t) => t.key === sourceFilter);
          return tab ? tab.sources.includes(s.source) : false;
        });
  const sortedSources = [...filteredSources].sort((a, b) => b.score - a.score);

  const cardDelays = ["animate-card-1", "animate-card-2", "animate-card-3"];

  return (
    <div className="min-h-screen bg-zinc-950 text-white safe-top safe-bottom">
      {/* Reading progress bar */}
      <div
        className="fixed left-0 h-0.5 bg-amber-500 z-60 transition-[width] duration-150 ease-out"
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

      {/* Ambient gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="orb-1 absolute -top-32 left-1/4 w-[500px] h-[500px] bg-amber-500 rounded-full blur-[120px]" />
        <div className="orb-2 absolute -bottom-48 right-1/5 w-[400px] h-[400px] bg-orange-600 rounded-full blur-[100px]" />
        <div className="orb-3 absolute top-1/2 -right-24 w-[350px] h-[350px] bg-amber-700 rounded-full blur-[110px]" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* ─── Header ─── */}
        <header className="mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-linear-to-br from-amber-400 to-orange-600 rounded-lg flex items-center justify-center text-[11px] font-bold tracking-tight text-white shadow-lg shadow-amber-500/20">
                TP
              </div>
              <span className="text-zinc-500 text-[11px] tracking-[0.2em] uppercase font-medium">
                Tiger Pinnacle Intelligence
              </span>
            </div>

            {/* Live indicator */}
            <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-500/8 border border-emerald-500/20 rounded-full">
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

          {/* Timestamp row with read time */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 animate-fade-in-delay-2">
            <span className="text-zinc-500 text-sm">{formattedDate}</span>
            <span className="text-zinc-700 hidden sm:inline">&bull;</span>
            <span className="text-zinc-600 text-sm">
              Generated {formattedTime}
            </span>
            <span className="text-zinc-700 hidden sm:inline">&bull;</span>
            <span className="text-zinc-600 text-xs">
              {readTime} min read
            </span>
            <span className="text-zinc-700">&bull;</span>
            <span className="text-zinc-600 text-xs">Updated {timeAgo}</span>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-zinc-500 hover:text-amber-400 transition-colors min-h-12 min-w-12 sm:min-h-0 sm:min-w-0 sm:p-1 rounded-md hover:bg-white/4 disabled:opacity-40 flex items-center justify-center"
              title="Refresh briefing"
            >
              <RefreshIcon spinning={refreshing} />
            </button>
          </div>
        </header>

        {/* ─── Sticky Quick Links ─── */}
        <div
          className="sticky z-40 -mx-4 px-4 sm:-mx-6 sm:px-6 py-2 mb-8 bg-zinc-950/85 backdrop-blur-md border-b border-white/4 animate-quick-links"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 4px)" }}
        >
          <div className="flex gap-2 overflow-x-auto scrollbar-none sm:flex-wrap sm:overflow-visible">
            {QUICK_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-3 min-h-12 sm:min-h-0 sm:py-1.5 flex items-center rounded-full text-[11px] font-medium text-zinc-400 bg-white/3 border border-white/6 backdrop-blur-sm hover:border-amber-500/20 hover:text-zinc-200 transition-all"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* ─── Quick Brief Hero Card ─── */}
        {quickBrief && (
          <section className="glass-card relative bg-white/3 border border-white/6 rounded-2xl p-5 sm:p-6 backdrop-blur-sm overflow-hidden animate-card-0 mb-6">
            <div
              className={`absolute inset-0 rounded-2xl bg-linear-to-br ${quickBrief.gradient} pointer-events-none`}
            />
            {/* Amber left accent */}
            <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full bg-amber-500/40" />
            <div className="relative pl-4">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-lg">{quickBrief.icon}</span>
                <h2 className="text-[11px] font-semibold tracking-[0.15em] text-zinc-400 uppercase">
                  {quickBrief.title}
                </h2>
              </div>
              {formatBullets(quickBrief.content, true)}
            </div>
          </section>
        )}

        {/* ─── Extended Read Divider ─── */}
        {extendedSections.length > 0 && (
          <div className="flex items-center gap-3 mt-10 mb-6 animate-divider">
            <div className="h-px flex-1 bg-white/6" />
            <span className="text-[11px] font-semibold tracking-[0.2em] text-zinc-600 uppercase whitespace-nowrap">
              Extended Read{" "}
              <span className="text-zinc-700">
                ({extendedSections.length} sections)
              </span>
            </span>
            <div className="h-px flex-1 bg-white/6" />
          </div>
        )}

        {/* ─── Extended Read Section Cards ─── */}
        <div className="space-y-6">
          {extendedSections.map((section, i) => {
            const isCollapsed = collapsedSections.has(i);
            return (
              <section
                key={i}
                ref={(el) => {
                  sectionRefs.current[i] = el;
                }}
                id={`section-${i}`}
                className={`glass-card relative bg-white/3 border border-white/6 rounded-2xl p-5 sm:p-6 backdrop-blur-sm ${cardDelays[i] || "animate-card-3"}`}
              >
                <div
                  className={`absolute inset-0 rounded-2xl bg-linear-to-br ${section.gradient} pointer-events-none`}
                />

                <div className="relative">
                  <button
                    onClick={() => toggleSection(i)}
                    className="flex items-center justify-between w-full text-left group min-h-12 sm:min-h-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{section.icon}</span>
                      <h2 className="text-[11px] font-semibold tracking-[0.15em] text-zinc-400 uppercase group-hover:text-zinc-300 transition-colors">
                        {section.title}
                      </h2>
                    </div>
                    <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors p-2 -m-2">
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

        {/* ─── Source Feed ─── */}
        {sources.length > 0 && (
          <section className="glass-card relative bg-white/3 border border-white/6 rounded-2xl p-5 sm:p-6 backdrop-blur-sm animate-card-4 mt-6">
            <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-amber-500/5 to-transparent pointer-events-none" />
            <div className="relative">
              <button
                onClick={() => setSourceFeedExpanded((v) => !v)}
                className="flex items-center justify-between w-full text-left group min-h-12 sm:min-h-0"
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
                <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors p-2 -m-2">
                  <ChevronIcon collapsed={!sourceFeedExpanded} />
                </span>
              </button>

              <div
                className={`collapsible-wrapper ${sourceFeedExpanded ? "" : "collapsed"} mt-5`}
              >
                <div className="collapsible-inner">
                  {/* Filter tabs */}
                  <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-none -mx-1 px-1">
                    {availableFilters.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setSourceFilter(tab.key)}
                        className={`shrink-0 px-3 min-h-11 sm:min-h-0 sm:py-1 flex items-center rounded-md text-[11px] font-medium transition-colors ${
                          sourceFilter === tab.key
                            ? "bg-white/8 text-zinc-200"
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-white/4"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-0.5">
                    {sortedSources.map((item, i) => {
                      const style = getSourceStyle(item.source);
                      return (
                        <a
                          key={i}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-3 py-3 sm:py-2.5 -mx-3 rounded-lg hover:bg-white/4 transition-colors group"
                        >
                          {/* Colored dot */}
                          <span
                            className={`shrink-0 w-2 h-2 rounded-full ${style.dot}`}
                          />
                          {/* Source label */}
                          <span
                            className={`shrink-0 text-[9px] font-semibold uppercase tracking-wider w-14 sm:w-10 ${style.text}`}
                          >
                            {style.label || item.source}
                          </span>
                          {/* Title */}
                          <span className="text-[15px] sm:text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors truncate min-w-0 flex-1">
                            {item.title}
                          </span>
                          {/* Score badge */}
                          {item.score > 0 && (
                            <span
                              className={`shrink-0 text-[11px] font-medium tabular-nums px-1.5 py-0.5 rounded ${style.text} ${style.bg}`}
                            >
                              {item.score >= 1000
                                ? `${(item.score / 1000).toFixed(1)}k`
                                : item.score}
                            </span>
                          )}
                          {/* Comments */}
                          {item.comments > 0 && (
                            <span className="shrink-0 text-[11px] text-zinc-600 tabular-nums w-12 text-right">
                              {item.comments}
                              <span className="text-zinc-700 ml-0.5">c</span>
                            </span>
                          )}
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ─── Action Items ─── */}
        <section className="glass-card relative bg-white/3 border border-white/6 rounded-2xl p-5 sm:p-6 backdrop-blur-sm animate-card-5 mt-6">
          <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-amber-600/5 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-lg">📌</span>
              <h2 className="text-[11px] font-semibold tracking-[0.15em] text-zinc-400 uppercase">
                Action Items
              </h2>
              {actionItems.length > 0 && (
                <span className="text-[10px] text-zinc-600 tabular-nums">
                  {actionItems.filter((i) => !i.completed).length} remaining
                </span>
              )}
            </div>

            <form onSubmit={handleAddAction} className="mb-4">
              <input
                type="text"
                value={actionInput}
                onChange={(e) => setActionInput(e.target.value)}
                placeholder="Add an action item..."
                className="w-full bg-white/3 border border-white/6 rounded-lg px-3 py-2.5 text-base sm:text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/30 transition-colors"
              />
            </form>

            {actionItems.length === 0 ? (
              <p className="text-zinc-600 text-xs">
                No items yet. Type above and press Enter.
              </p>
            ) : (
              <div className="space-y-1">
                {actionItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2 -mx-3 rounded-lg hover:bg-white/4 transition-colors group"
                  >
                    <button
                      onClick={() => toggleActionItem(item.id)}
                      className={`shrink-0 w-6 h-6 sm:w-4 sm:h-4 rounded border transition-colors flex items-center justify-center ${
                        item.completed
                          ? "bg-amber-500/20 border-amber-500/40"
                          : "border-white/12 hover:border-amber-500/30"
                      }`}
                    >
                      {item.completed && (
                        <svg
                          className="w-3 h-3 sm:w-2.5 sm:h-2.5"
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

                    <span
                      className={`flex-1 text-[15px] sm:text-sm min-w-0 transition-colors ${
                        item.completed
                          ? "line-through text-zinc-600"
                          : "text-zinc-300"
                      }`}
                    >
                      {item.text}
                    </span>

                    <button
                      onClick={() => deleteActionItem(item.id)}
                      className="touch-visible shrink-0 text-zinc-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-xs min-w-12 min-h-12 sm:min-w-0 sm:min-h-0 sm:p-2 flex items-center justify-center"
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

        {/* ─── Notes & Ideas ─── */}
        <section className="glass-card relative bg-white/3 border border-white/6 rounded-2xl p-5 sm:p-6 backdrop-blur-sm animate-card-6 mt-6">
          <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-amber-500/5 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-lg">💡</span>
              <h2 className="text-[11px] font-semibold tracking-[0.15em] text-zinc-400 uppercase">
                Notes &amp; Ideas
              </h2>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Jot down notes, ideas, follow-ups..."
              rows={6}
              className="w-full bg-white/3 border border-white/6 rounded-lg px-3 py-2.5 text-base sm:text-sm text-zinc-300 placeholder:text-zinc-600 leading-relaxed resize-y focus:outline-none focus:border-amber-500/30 transition-colors"
            />
          </div>
        </section>

        {/* ─── Previous Briefings ─── */}
        <div className="mt-6 rounded-2xl border border-white/4 bg-white/[0.015] p-5 sm:p-6 animate-card-7">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-lg opacity-50">📂</span>
            <h2 className="text-[11px] font-semibold tracking-[0.15em] text-zinc-600 uppercase">
              Previous Briefings
            </h2>
          </div>
          <p className="text-zinc-600 text-xs leading-relaxed">
            Archive coming soon — briefings will appear here after 7 days of
            data.
          </p>
        </div>

        {/* ─── Footer ─── */}
        <footer className="mt-14 sm:mt-16 pt-6 pb-4 border-t border-white/6 animate-fade-in-footer safe-bottom">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <p className="text-zinc-600 text-xs">
              Automated via n8n &bull; Claude Sonnet 4.5 &bull; Reddit + Hacker
              News
            </p>
            <p className="text-zinc-700 text-xs">Internal use only</p>
          </div>
        </footer>
      </div>

      {/* ─── Back to top floating button ─── */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed right-6 z-50 w-12 h-12 rounded-full bg-white/6 border border-white/10 backdrop-blur-md text-zinc-400 hover:text-amber-400 hover:border-amber-500/30 transition-all flex items-center justify-center animate-back-to-top"
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)",
          }}
        >
          <ArrowUpIcon />
        </button>
      )}
    </div>
  );
}
