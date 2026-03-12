"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { skillsApi } from "@/lib/api";
import ReactMarkdown from "react-markdown";

export default function SkillConfigPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();

    // Basic Skill info (name, icon) - ideally fetched from API, but we'll skeleton load it
    const [skillInfo, setSkillInfo] = useState({ name: "Market Analyst", icon: "📈", description: "Monitors asset prices & market trends. Alerts you when critical thresholds are met." });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ analysis: string; sources: any[] } | null>(null);
    const [testError, setTestError] = useState("");

    const [activeTab, setActiveTab] = useState<"test" | "history">("test");
    const [logs, setLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [selectedLog, setSelectedLog] = useState<any | null>(null);

    const [config, setConfig] = useState({
        market_type: "crypto",
        custom_prompt: "",
        notify_channel: "email",
        notify_target: "",
        notify_country_code: "+1",
        notify_time: "08:00",
        notify_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        is_active: false,
    });

    useEffect(() => {
        // 1. Fetch skill config
        skillsApi.getConfig(id).then((res) => {
            if (res.data) {
                setConfig({
                    market_type: res.data.market_type || "crypto",
                    custom_prompt: res.data.custom_prompt || "",
                    notify_channel: res.data.notify_channel || "email",
                    notify_target: res.data.notify_target || "",
                    notify_country_code: res.data.notify_country_code || "+1",
                    notify_time: res.data.notify_time || "08:00",
                    notify_timezone: res.data.notify_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
                    is_active: res.data.is_active || false,
                });
            }
            setLoading(false);
        }).catch(() => setLoading(false));

        // 2. Fetch all skills to get this skill's title/icon
        skillsApi.list().then((res) => {
            const s = res.data?.find((x: any) => x.id === id);
            if (s) {
                setSkillInfo({ name: s.name, icon: s.icon, description: s.description });
            }
        });
    }, [id]);

    const fetchLogs = () => {
        setLoadingLogs(true);
        skillsApi.getLogs(id).then((res) => {
            setLogs(res.data);
            setLoadingLogs(false);
        }).catch(() => setLoadingLogs(false));
    };

    useEffect(() => {
        if (activeTab === "history") {
            fetchLogs();
        }
    }, [activeTab, id]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await skillsApi.saveConfig(id, config);
            // Show success toast here if you have one
        } catch (e) {
            console.error(e);
        }
        setSaving(false);
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        setTestError("");
        try {
            const res = await skillsApi.test(id, {
                market_type: config.market_type,
                custom_prompt: config.custom_prompt,
            });
            setTestResult(res.data);
        } catch (e: any) {
            setTestError(e.response?.data?.detail || "An error occurred during testing.");
        }
        setTesting(false);
    };

    if (loading) {
        return (
            <div className="flex justify-center py-24">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto pb-24">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => router.push("/dashboard/autonomous")}
                    className="w-10 h-10 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                >
                    ←
                </button>
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-2xl shadow-lg">
                        {skillInfo.icon}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{skillInfo.name}</h1>
                        <p className="text-slate-400 text-sm">{skillInfo.description}</p>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Left Col: Config Form */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
                        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <span>⚙️</span> Skill Configuration
                        </h2>

                        <div className="space-y-6">
                            {/* Market Type */}
                            <div>
                                <label className="text-sm font-medium text-slate-300 mb-3 block">Target Market</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        { id: "crypto", label: "Crypto", icon: "₿" },
                                        { id: "indian", label: "Indian Market", icon: "₹" },
                                        { id: "forex", label: "Forex", icon: "💱" },
                                        { id: "custom", label: "Custom", icon: "🎯" },
                                    ].map((m) => (
                                        <button
                                            key={m.id}
                                            onClick={() => setConfig({ ...config, market_type: m.id })}
                                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${config.market_type === m.id
                                                ? "bg-indigo-500/20 border-indigo-500 text-indigo-400"
                                                : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-500"
                                                }`}
                                        >
                                            <span className="text-xl">{m.icon}</span>
                                            <span className="text-xs font-semibold">{m.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Custom Prompt */}
                            <div>
                                <label className="text-sm font-medium text-slate-300 mb-2 block">
                                    Specific Assets or Query (Optional)
                                </label>
                                <textarea
                                    value={config.custom_prompt}
                                    onChange={(e) => setConfig({ ...config, custom_prompt: e.target.value })}
                                    placeholder="e.g. BTC, ETH, and SOL or 'Top mid-cap IT stocks in India'"
                                    className="w-full h-24 px-4 py-3 rounded-xl bg-slate-900 border border-slate-700/50 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                                />
                            </div>

                            <div className="grid sm:grid-cols-2 gap-6">
                                {/* Notification Channel */}
                                <div>
                                    <label className="text-sm font-medium text-slate-300 mb-3 block">Delivery Channel</label>
                                    <div className="space-y-2">
                                        {[
                                            { id: "email", label: "Email", icon: "✉️" },
                                            { id: "whatsapp", label: "WhatsApp", icon: "💬" },
                                            { id: "telegram", label: "Telegram", icon: "✈️" },
                                        ].map((c) => (
                                            <label
                                                key={c.id}
                                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${config.notify_channel === c.id
                                                    ? "bg-indigo-500/10 border-indigo-500"
                                                    : "bg-slate-800/50 border-slate-700/50 hover:border-slate-600"
                                                    }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="channel"
                                                    checked={config.notify_channel === c.id}
                                                    onChange={() => setConfig({ ...config, notify_channel: c.id })}
                                                    className="text-indigo-500 bg-slate-900 border-slate-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-lg">{c.icon}</span>
                                                <span className="text-sm text-slate-200 font-medium">{c.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Target & Time */}
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-sm font-medium text-slate-300 mb-2 block">
                                            {config.notify_channel === "email" ? "Email Address" : "Phone Number"}
                                        </label>
                                        <div className="flex gap-3">
                                            {config.notify_channel !== "email" && (
                                                <select
                                                    value={config.notify_country_code}
                                                    onChange={(e) => setConfig({ ...config, notify_country_code: e.target.value })}
                                                    className="w-28 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700/50 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all appearance-none"
                                                >
                                                    <option value="+1">+1 (US/CA)</option>
                                                    <option value="+44">+44 (UK)</option>
                                                    <option value="+91">+91 (IN)</option>
                                                    <option value="+61">+61 (AU)</option>
                                                    <option value="+81">+81 (JP)</option>
                                                    <option value="+49">+49 (DE)</option>
                                                    <option value="+33">+33 (FR)</option>
                                                    <option value="+86">+86 (CN)</option>
                                                    <option value="+55">+55 (BR)</option>
                                                    <option value="+27">+27 (ZA)</option>
                                                    <option value="+971">+971 (AE)</option>
                                                </select>
                                            )}
                                            <input
                                                type={config.notify_channel === "email" ? "email" : "tel"}
                                                value={config.notify_target}
                                                onChange={(e) => setConfig({ ...config, notify_target: e.target.value })}
                                                placeholder={config.notify_channel === "email" ? "you@example.com" : "1234567890"}
                                                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/50 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="text-sm font-medium text-slate-300 mb-2 block">Schedule Time</label>
                                            <input
                                                type="time"
                                                value={config.notify_time}
                                                onChange={(e) => setConfig({ ...config, notify_time: e.target.value })}
                                                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/50 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-sm font-medium text-slate-300 mb-2 block">Timezone</label>
                                            <select
                                                value={config.notify_timezone}
                                                onChange={(e) => setConfig({ ...config, notify_timezone: e.target.value })}
                                                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/50 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                            >
                                                {Intl.supportedValuesOf('timeZone').map(tz => (
                                                    <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Active Toggle & Save */}
                            <div className="flex items-center justify-between pt-6 border-t border-slate-700/50">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={config.is_active}
                                        onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
                                    />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                    <span className="ml-3 text-sm font-medium text-slate-300">
                                        {config.is_active ? "Skill Active" : "Skill Paused"}
                                    </span>
                                </label>

                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-500 text-white hover:bg-indigo-600 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg"
                                >
                                    {saving ? "Saving..." : "💾 Save Configuration"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Col: Testing / History Panel */}
                <div className="space-y-6 flex flex-col h-full min-h-[600px]">
                    <div className="bg-gradient-to-b from-[#0f172a]/80 to-[#020617]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4 shrink-0">
                            <div className="flex gap-6">
                                <button
                                    onClick={() => setActiveTab("test")}
                                    className={`text-sm font-semibold pb-4 -mb-[17px] transition-colors ${activeTab === "test" ? "text-white border-b-2 border-indigo-500" : "text-slate-500 hover:text-slate-300"}`}
                                >
                                    🧪 Live Test
                                </button>
                                <button
                                    onClick={() => setActiveTab("history")}
                                    className={`text-sm font-semibold pb-4 -mb-[17px] transition-colors ${activeTab === "history" ? "text-white border-b-2 border-indigo-500" : "text-slate-500 hover:text-slate-300"}`}
                                >
                                    📜 Run History
                                </button>
                            </div>
                        </div>

                        {activeTab === "test" ? (
                            <div className="flex flex-col flex-1 h-full">
                                <p className="text-xs text-slate-400 mb-6 shrink-0">
                                    Run this skill right now to see the exact report you will receive via {config.notify_channel}.
                                </p>

                                <button
                                    onClick={handleTest}
                                    disabled={testing}
                                    className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 mb-6 shrink-0"
                                >
                                    {testing ? (
                                        <>
                                            <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                            Generating Report...
                                        </>
                                    ) : (
                                        "▶ Run Skill Now"
                                    )}
                                </button>

                                {/* Test Results */}
                                {testError && (
                                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4 shrink-0">
                                        ❌ {testError}
                                    </div>
                                )}

                                {testResult && (
                                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
                                        <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-3 sticky top-0 bg-[#060b17]/90 py-1 backdrop-blur-md">
                                            Analysis Output
                                        </div>
                                        <div className="prose prose-invert prose-sm max-w-none prose-p:text-slate-300 prose-headings:text-white prose-a:text-indigo-400 prose-strong:text-indigo-200">
                                            <ReactMarkdown>{testResult.analysis}</ReactMarkdown>
                                        </div>

                                        {testResult.sources && testResult.sources.length > 0 && (
                                            <div className="mt-8 pt-6 border-t border-slate-800">
                                                <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-3">
                                                    Sources Searched
                                                </div>
                                                <ul className="space-y-2">
                                                    {testResult.sources.map((s: any, idx: number) => (
                                                        <li key={idx}>
                                                            <a
                                                                href={s.url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-xs text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-1"
                                                            >
                                                                🔗 {s.title}
                                                            </a>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Run History Tab */
                            <div className="flex-1 flex flex-col h-full min-h-0">
                                {loadingLogs ? (
                                    <div className="flex justify-center py-12 shrink-0">
                                        <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                                    </div>
                                ) : selectedLog ? (
                                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 relative">
                                        <div className="sticky top-0 bg-[#060b17]/90 py-3 backdrop-blur-md z-10 border-b border-slate-800 mb-4">
                                            <button
                                                onClick={() => setSelectedLog(null)}
                                                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors border border-indigo-500/20 mb-3"
                                            >
                                                ← Back to history list
                                            </button>
                                            <div className="text-xs text-slate-400 flex items-center gap-2">
                                                <span className="text-white font-medium">{new Date(selectedLog.created_at).toLocaleString()}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-600" />
                                                <span className="capitalize">{selectedLog.channel} delivery</span>
                                            </div>
                                        </div>
                                        <div className="prose prose-invert prose-sm max-w-none prose-p:text-slate-300 prose-headings:text-white prose-a:text-indigo-400 prose-strong:text-indigo-200">
                                            <ReactMarkdown>{selectedLog.content}</ReactMarkdown>
                                        </div>
                                    </div>
                                ) : logs.length === 0 ? (
                                    <div className="text-center py-16 flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/20 shrink-0">
                                        <div className="text-4xl mb-3 opacity-50">📭</div>
                                        <p className="text-slate-300 font-medium">No run history yet</p>
                                        <p className="text-slate-500 text-xs mt-1 max-w-[200px]">Run a live test or wait for the schedule to trigger to see logs appear here.</p>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-3 pb-4">
                                        {logs.map((log) => (
                                            <div
                                                key={log.id}
                                                onClick={() => setSelectedLog(log)}
                                                className="p-4 rounded-xl bg-slate-800/20 border border-slate-700/40 hover:bg-slate-800/60 hover:border-slate-600 transition-all cursor-pointer group flex flex-col gap-2"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-medium text-slate-300">
                                                        {new Date(log.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                                                            {log.channel}
                                                        </span>
                                                        <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                            Success
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
                                                    {log.content.replace(/[#*`_]/g, '') /* strip basic markdown for preview */}
                                                </p>
                                                <div className="mt-1 text-[10px] font-bold text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                    READ FULL REPORT <span className="text-lg">→</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
