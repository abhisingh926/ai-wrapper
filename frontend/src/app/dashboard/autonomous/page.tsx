"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { skillsApi } from "@/lib/api";

/* ── Fallback skills (shown while API loads) ── */
const fallbackSkills = [
    { id: "1", icon: "📈", title: "Market Analyst", description: "Monitors asset prices & market trends. Alerts you when critical thresholds are met.", tags: ["Web Search", "Proactive Alerts"], schedule: "Hourly", gradient: "from-emerald-500/20 to-teal-500/10", iconBg: "from-emerald-500 to-teal-400" },
    { id: "2", icon: "📰", title: "News Sentinel", description: "Scans global news for keywords or entities and alerts you of important developments.", tags: ["Web Search", "Proactive Alerts"], schedule: "Daily at 8 AM", gradient: "from-blue-500/20 to-indigo-500/10", iconBg: "from-blue-500 to-indigo-400" },
    { id: "3", icon: "🔍", title: "Competitor Watcher", description: "Checks competitor websites for major updates, product launches, or pricing changes.", tags: ["Web Search", "Proactive Alerts"], schedule: "Weekly", gradient: "from-violet-500/20 to-purple-500/10", iconBg: "from-violet-500 to-purple-400" },
    { id: "4", icon: "🐙", title: "GitHub Issue Triage", description: "Scans your repos for unassigned or critical issues and summarizes them for you.", tags: ["GitHub Data", "Proactive Alerts"], schedule: "Hourly (9-5)", gradient: "from-orange-500/20 to-amber-500/10", iconBg: "from-orange-500 to-amber-400" },
    { id: "5", icon: "☀️", title: "Daily Briefing", description: "Gathers your schedule, weather, and breaking news into one concise morning alert.", tags: ["Calendar", "Weather", "News"], schedule: "Daily at 7 AM", gradient: "from-cyan-500/20 to-sky-500/10", iconBg: "from-cyan-500 to-sky-400" },
    { id: "6", icon: "🧬", title: "Deep Researcher", description: "Performs multi-step web research on a topic and synthesizes a comprehensive report.", tags: ["Multi-Step Search", "Reports"], schedule: "Custom", gradient: "from-rose-500/20 to-pink-500/10", iconBg: "from-rose-500 to-pink-400" },
];

interface Skill {
    id: string;
    icon: string;
    title: string;
    description: string;
    tags: string[];
    schedule: string;
    gradient: string;
    iconBg: string;
}

export default function AutonomousPage() {
    const router = useRouter();
    const [skills, setSkills] = useState<Skill[]>(fallbackSkills);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        skillsApi
            .list()
            .then((res) => {
                if (Array.isArray(res.data) && res.data.length > 0) {
                    setSkills(
                        res.data.map((s: any) => ({
                            id: s.id,
                            icon: s.icon,
                            title: s.name,
                            description: s.description,
                            tags: s.tags || [],
                            schedule: s.schedule,
                            gradient: s.gradient || "from-slate-500/20 to-slate-600/10",
                            iconBg: s.icon_bg || "from-slate-500 to-slate-400",
                        }))
                    );
                }
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">
                    Autonomous <span className="text-gradient">Agents</span> ⚡
                </h1>
                <p className="text-slate-400">
                    Schedule background skills that monitor, analyze, and alert you proactively.
                </p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 rounded-2xl p-5 border border-white/5">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">⚡</span>
                        <div>
                            <div className="text-2xl font-bold text-white">{skills.length}</div>
                            <div className="text-sm text-slate-400">Active Skills</div>
                        </div>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 rounded-2xl p-5 border border-white/5">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📋</span>
                        <div>
                            <div className="text-2xl font-bold text-white">{skills.reduce((acc, s) => acc + s.tags.length, 0)}</div>
                            <div className="text-sm text-slate-400">Total Capabilities</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Skills Grid */}
            {skills.length === 0 ? (
                <div className="text-center py-16">
                    <div className="text-4xl mb-3">⚡</div>
                    <p className="text-slate-400 mb-2">No active skills available.</p>
                    <p className="text-slate-500 text-sm">Contact your admin to enable skills.</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {skills.map((skill) => (
                        <div
                            key={skill.id}
                            onClick={() => router.push(`/dashboard/autonomous/${skill.id}`)}
                            className={`rounded-2xl p-6 bg-gradient-to-br ${skill.gradient} border border-white/5
                cursor-pointer hover:border-indigo-500/50 hover:-translate-y-1 transition-all duration-300 group flex flex-col`}
                        >
                            {/* Icon + Title */}
                            <div className="flex items-start gap-4 mb-3">
                                <div
                                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${skill.iconBg} flex items-center justify-center text-xl shrink-0 shadow-lg`}
                                >
                                    {skill.icon}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                                        {skill.title}
                                    </h3>
                                    <p className="text-slate-400 text-sm leading-relaxed mt-1">
                                        {skill.description}
                                    </p>
                                </div>
                            </div>

                            {/* Meta Row */}
                            <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                                <span className="flex items-center gap-1">
                                    <span>⏱</span> {skill.schedule}
                                </span>
                            </div>

                            {/* Tags */}
                            <div className="flex items-center gap-2 flex-wrap mt-auto">
                                {skill.tags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/5 text-slate-400 border border-white/5"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
