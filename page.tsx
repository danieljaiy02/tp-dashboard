"use client";

import { useState, useEffect } from "react";

interface BriefingData {
  summary: string;
  generated_at: string;
}

function parseSections(markdown: string) {
  const sections: { title: string; content: string; icon: string }[] = [];

  const sectionMap: Record<string, string> = {
    "COMMUNITY PULSE": "📡",
    "KEY DEVELOPMENTS": "⚡",
    "WHAT THIS MEANS FOR TP": "🎯",
  };

  const parts = markdown.split(/###\s+/);

  for (const part of parts) {
    if (!part.trim()) continue;
    const lines = part.trim().split("\n");
    const title = lines[0].replace(/\*+/g, "").trim();
    const content = lines.slice(1).join("\n").trim();

    const icon =
      Object.entries(sectionMap).find(([key]) =>
        title.toUpperCase().includes(key)
      )?.[1] || "📋";

    if (content) {
      sections.push({ title, content, icon });
    }
  }

  return sections;
}

function formatBullets(text: string) {
  return text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Bold markers
    const formatted = trimmed
      .replace(/^\d+\.\s*/, "")
      .replace(/\*\*(.*?)\*\*/g, '<span class="text-white font-semibold">$1</span>');

    const isBullet = trimmed.startsWith("-") || trimmed.startsWith("•");
    const cleanLine = isBullet ? formatted.replace(/^[-•]\s*/, "") : formatted;

    return (
      <div key={i} className={`${isBullet ? "flex gap-3 items-start" : ""} mb-3`}>
        {isBullet && (
          <span className="text-amber-500 mt-1 text-xs">▸</span>
        )}
        <p
          className="text-zinc-300 leading-relaxed text-sm"
          dangerouslySetInnerHTML={{ __html: cleanLine }}
        />
      </div>
    );
  });
}

export default function Dashboard() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/briefing.json")
      .then((res) => res.json())
      .then((data) => {
        setBriefing(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          <span className="text-zinc-400 text-sm tracking-wide">Loading briefing...</span>
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

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Ambient gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-600/3 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-amber-700 rounded-lg flex items-center justify-center text-xs font-bold">
              TP
            </div>
            <span className="text-zinc-500 text-xs tracking-widest uppercase">
              Tiger Pinnacle Intelligence
            </span>
          </div>
          <h1 className="text-3xl font-light tracking-tight mt-4">
            Morning Briefing
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-zinc-500 text-sm">{formattedDate}</span>
            <span className="text-zinc-700">•</span>
            <span className="text-zinc-600 text-sm">Generated {formattedTime}</span>
            <span className="inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-xs">Live</span>
            </span>
          </div>
        </header>

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((section, i) => (
            <section
              key={i}
              className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 backdrop-blur-sm"
            >
              <div className="flex items-center gap-3 mb-5">
                <span className="text-lg">{section.icon}</span>
                <h2 className="text-sm font-medium tracking-wide text-zinc-300 uppercase">
                  {section.title}
                </h2>
              </div>
              <div>{formatBullets(section.content)}</div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-white/[0.06]">
          <div className="flex items-center justify-between">
            <p className="text-zinc-600 text-xs">
              Automated via n8n • Claude Sonnet 4.5 • Reddit + Hacker News
            </p>
            <p className="text-zinc-700 text-xs">Internal use only</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
