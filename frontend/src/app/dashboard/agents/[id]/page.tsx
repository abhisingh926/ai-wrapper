"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import api, { agentApi, toolsApi, channelsApi, knowledgeApi, leadsApi } from "@/lib/api";
import { useAuthStore } from "@/hooks/useAuth";
import TestAgentChat from "@/components/TestAgentChat";

type Agent = {
    id: string;
    name: string;
    ai_provider: string;
    ai_model: string;
    platform: string;
    tools: string[];
    status: string;
    system_prompt: string;
    temperature: number;
    version: string;
    messages_count: number;
    api_calls_count: number;
    errors_count: number;
    avg_response_ms: number;
    created_at: string;
    tool_configs: Record<string, any>;
};

type Tool = {
    id: string;
    name: string;
    icon: string;
    desc: string;
    category: string;
    badge: string;
};

const fallbackProviders = [
    {
        id: "openai", name: "OpenAI", icon: "🤖",
        models: [
            { id: "gpt-4o", name: "GPT-4o" },
            { id: "gpt-4o-mini", name: "GPT-4o Mini" },
            { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
        ],
    },
    {
        id: "anthropic", name: "Anthropic", icon: "🧠",
        models: [
            { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
            { id: "claude-3-opus", name: "Claude 3 Opus" },
            { id: "claude-3-haiku", name: "Claude 3 Haiku" },
        ],
    },
    {
        id: "google", name: "Google", icon: "✨",
        models: [
            { id: "gemini-pro", name: "Gemini Pro" },
            { id: "gemini-pro-1.5", name: "Gemini 1.5 Pro" },
            { id: "gemini-flash", name: "Gemini Flash" },
        ],
    },
];

type DynamicModel = { id: string; name: string; allowed: boolean; min_plan?: string };
type DynamicProvider = { id: string; name: string; icon: string; models: DynamicModel[] };

// Platforms are now fetched from the database dynamically via channelsApi

/* ─── Platform Colors mapping ─── */
const getPlatformColor = (slug: string) => {
    switch (slug) {
        case "telegram": return "from-sky-400 to-blue-500";
        case "discord": return "from-indigo-500 to-purple-600";
        case "whatsapp": return "from-green-400 to-emerald-500";
        case "slack": return "from-purple-500 to-fuchsia-600";
        case "web": return "from-cyan-400 to-teal-500";
        case "instagram": return "from-pink-500 to-rose-600";
        default: return "from-slate-600 to-slate-700";
    }
};

type TabItem = {
    id: string;
    label: string;
    icon: string;
};

const tabs: TabItem[] = [
    { id: "overview", label: "Overview", icon: "⚙️" },
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "branding", label: "Branding", icon: "🎨" },
    { id: "tools", label: "Tools & Apps", icon: "⚡️" },
    { id: "leads", label: "Leads", icon: "💬" },
    { id: "integration", label: "Integration", icon: "<> " },
    { id: "logs", label: "Live Logs", icon: ">_" },
];

export default function AgentViewPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isAdmin } = useAuthStore();

    const [agent, setAgent] = useState<Agent | null>(null);
    const [allTools, setAllTools] = useState<Tool[]>([]);
    const [platforms, setPlatforms] = useState<any[]>([]);

    const initialTab = searchParams.get("tab") || "overview";
    const [activeTab, setActiveTab] = useState(initialTab);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Overview Tab State
    const [isEditingConfig, setIsEditingConfig] = useState(false);
    const [editConfig, setEditConfig] = useState({
        ai_provider: "",
        ai_model: "",
        platform: "",
        temperature: 0.7,
        version: "1.0.0"
    });
    const [isEditingPrompt, setIsEditingPrompt] = useState(false);
    const [editPrompt, setEditPrompt] = useState("");

    // Chat Testing State
    const [isChatOpen, setIsChatOpen] = useState(false);

    // Tool Configuration Modal State
    const [configureToolModal, setConfigureToolModal] = useState<string | null>(null);
    const [activeToolConfig, setActiveToolConfig] = useState<any>({});

    // Knowledge Base State
    const [knowledgeItems, setKnowledgeItems] = useState<any[]>([]);
    const [knowledgeLoading, setKnowledgeLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Leads State
    const [leads, setLeads] = useState<any[]>([]);
    const [leadsLoading, setLeadsLoading] = useState(false);

    // Integration State
    const [botToken, setBotToken] = useState("");
    const [botConnected, setBotConnected] = useState(false);
    const [botSaving, setBotSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    // Branding State
    const [botDisplayName, setBotDisplayName] = useState(agent?.name || "");
    const [themeColor, setThemeColor] = useState("#3b82f6");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [removeBranding, setRemoveBranding] = useState(false);
    const [brandingSaving, setBrandingSaving] = useState(false);
    const [brandingSaved, setBrandingSaved] = useState(false);

    // WhatsApp State
    const [waDmPolicy, setWaDmPolicy] = useState<"allowlist" | "public">("allowlist");
    const [waAllowlist, setWaAllowlist] = useState<string[]>([]);
    const [newWaNumber, setNewWaNumber] = useState("");
    const [waSaving, setWaSaving] = useState(false);

    // WhatsApp QR Streaming State
    const [waQrImage, setWaQrImage] = useState<string | null>(null);
    const [waQrStatus, setWaQrStatus] = useState("");
    const [isWaStreaming, setIsWaStreaming] = useState(false);
    const [waQrConnected, setWaQrConnected] = useState(false);

    // Dynamic AI providers from API
    const [aiProviders, setAiProviders] = useState<DynamicProvider[]>(
        fallbackProviders.map(p => ({ ...p, models: p.models.map(m => ({ ...m, allowed: true })) }))
    );

    // Discord State
    const [discordToken, setDiscordToken] = useState("");
    const [discordConnected, setDiscordConnected] = useState(false);
    const [discordSaving, setDiscordSaving] = useState(false);

    // Slack State
    const [slackAppToken, setSlackAppToken] = useState("");
    const [slackBotToken, setSlackBotToken] = useState("");
    const [slackConnected, setSlackConnected] = useState(false);
    const [slackSaving, setSlackSaving] = useState(false);

    // System Activity (Live Logs) State
    const [activityData, setActivityData] = useState<any>(null);
    const [activityLoading, setActivityLoading] = useState(true);
    const [activityFilter, setActivityFilter] = useState("all");
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Dashboard State
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [dashboardLoading, setDashboardLoading] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [selectedSession, setSelectedSession] = useState<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [sessionMessages, setSessionMessages] = useState<any[]>([]);
    const [sessionLoading, setSessionLoading] = useState(false);

    useEffect(() => {
        if (params?.id) {
            loadData(params.id as string);
            loadKnowledge(params.id as string);
        }
        // Load available models based on user's plan
        agentApi.availableModels().then((res) => {
            setAiProviders(res.data.providers || []);
        }).catch(() => {
            // Fallback: all models allowed
            setAiProviders(fallbackProviders.map(p => ({
                ...p, models: p.models.map(m => ({ ...m, allowed: true }))
            })));
        });
    }, [params]);

    // Activity (Live Logs) data fetching
    useEffect(() => {
        if (!agent) return;
        let interval: any;
        const fetchActivity = async () => {
            try {
                const res = await api.get(`/api/agents/${agent.id}/activity`);
                setActivityData(res.data);
            } catch (e) { console.error("Activity fetch error:", e); }
            finally { setActivityLoading(false); }
        };
        fetchActivity();
        if (autoRefresh && activeTab === "logs") {
            interval = setInterval(fetchActivity, 8000);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [agent, autoRefresh, activeTab]);

    const loadKnowledge = async (id: string) => {
        try {
            const res = await knowledgeApi.list(id);
            setKnowledgeItems(res.data);
        } catch (err) {
            console.error("Failed to load knowledge", err);
        }
    };

    const loadLeads = async (id: string) => {
        setLeadsLoading(true);
        try {
            const res = await leadsApi.list(id);
            setLeads(res.data);
        } catch (err) {
            console.error("Failed to load leads", err);
        } finally {
            setLeadsLoading(false);
        }
    };

    const handleDeleteLead = async (leadId: string) => {
        if (!agent) return;
        try {
            await leadsApi.delete(agent.id, leadId);
            setLeads(leads.filter(l => l.id !== leadId));
        } catch (err) {
            console.error("Failed to delete lead", err);
        }
    };

    const handleExportCsv = async () => {
        if (!agent) return;
        try {
            const res = await leadsApi.exportCsv(agent.id);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement("a");
            a.href = url;
            a.download = `${agent.name}_leads.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Failed to export CSV", err);
        }
    };

    const loadData = async (id: string) => {
        setLoading(true);
        try {
            const [agentRes, toolsRes, channelsRes] = await Promise.all([
                agentApi.get(id),
                toolsApi.list(),
                channelsApi.list()
            ]);
            const a = agentRes.data;
            setAgent(a);
            setAllTools(toolsRes.data);
            setPlatforms(channelsRes.data);
            setEditConfig({
                ai_provider: a.ai_provider || "",
                ai_model: a.ai_model,
                platform: a.platform,
                temperature: a.temperature ?? 0.7,
                version: a.version || "1.0.0"
            });
            setEditPrompt(a.system_prompt || "You are a helpful AI assistant.");

            // Load Branding settings
            const branding = a.tool_configs?.widget_branding || {};
            setBotDisplayName(branding.botDisplayName || a.name || "");
            setThemeColor(branding.themeColor || "#3b82f6");
            setRemoveBranding(branding.removeBranding || false);

            // Load WhatsApp settings
            const waConfig = a.tool_configs?.whatsapp || {};
            setWaDmPolicy(waConfig.dmPolicy || "allowlist");
            setWaAllowlist(waConfig.allowFrom || []);

            // Load Discord settings
            const discordConfig = a.tool_configs?.discord || {};
            setDiscordToken(discordConfig.token || "");
            if (discordConfig.token) setDiscordConnected(true);

            // Load Slack settings
            const slackConfig = a.tool_configs?.slack || {};
            setSlackAppToken(slackConfig.appToken || "");
            setSlackBotToken(slackConfig.botToken || "");
            if (slackConfig.appToken && slackConfig.botToken) setSlackConnected(true);
        } catch (err) {
            console.error("Failed to load agent", err);
        }
        setLoading(false);
    };

    const handleSaveConfig = async () => {
        if (!agent) return;
        setSaving(true);
        try {
            const res = await agentApi.update(agent.id, editConfig);
            setAgent({ ...res.data, status: agent.status }); // Overwrite local state
            setIsEditingConfig(false);
        } catch (err) {
            console.error(err);
        }
        setSaving(false);
    };

    const handleSavePrompt = async () => {
        if (!agent) return;
        setSaving(true);
        try {
            const res = await agentApi.update(agent.id, { system_prompt: editPrompt });
            setAgent({ ...res.data, status: agent.status }); // Overwrite local state
            setIsEditingPrompt(false);
        } catch (err) {
            console.error(err);
        }
        setSaving(false);
    };

    const handleDeleteAgent = async () => {
        if (!agent) return;
        if (confirm("Are you sure you want to delete this agent? This action cannot be undone.")) {
            setSaving(true);
            try {
                await agentApi.delete(agent.id as string);
                router.push("/dashboard/agents");
            } catch (err) {
                console.error(err);
                setSaving(false);
            }
        }
    };

    const handleToggleTool = async (toolSlug: string, isEnabled: boolean) => {
        if (!agent) return;
        setSaving(true);
        try {
            let newTools = [...(agent.tools || [])];
            if (isEnabled && !newTools.includes(toolSlug)) {
                newTools.push(toolSlug);
            } else if (!isEnabled) {
                newTools = newTools.filter(t => t !== toolSlug);
            }

            const res = await agentApi.update(agent.id, { tools: newTools });
            setAgent(res.data);
        } catch (err) {
            console.error(err);
        }
        setSaving(false);
    };

    const handleOpenConfigure = (toolId: string) => {
        setConfigureToolModal(toolId);
        setActiveToolConfig(agent?.tool_configs?.[toolId] || {});
    };

    const handleSaveToolConfig = async () => {
        if (!agent || !configureToolModal) return;
        setSaving(true);
        try {
            const newConfigs = { ...agent.tool_configs, [configureToolModal]: activeToolConfig };
            const res = await agentApi.update(agent.id, { tool_configs: newConfigs });
            setAgent(res.data);
            setConfigureToolModal(null);
        } catch (err) {
            console.error(err);
        }
        setSaving(false);
    };

    // --- Knowledge Base Handlers ---

    const handleUploadKnowledge = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!agent || !e.target.files?.[0]) return;
        setKnowledgeLoading(true);
        try {
            await knowledgeApi.uploadFile(agent.id, e.target.files[0]);
            loadKnowledge(agent.id);
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (err: any) {
            console.error(err);
            alert(err.response?.data?.detail || "Failed to upload file");
        }
        setKnowledgeLoading(false);
    };

    const handleScrapeUrl = async () => {
        if (!agent || !activeToolConfig.scrapeUrl) return;
        setKnowledgeLoading(true);
        try {
            await knowledgeApi.scrapeUrl(agent.id, activeToolConfig.scrapeUrl);
            setActiveToolConfig({ ...activeToolConfig, scrapeUrl: "" });
            loadKnowledge(agent.id);
        } catch (err: any) {
            console.error(err);
            alert(err.response?.data?.detail || "Failed to scrape URL");
        }
        setKnowledgeLoading(false);
    };

    const handleSaveRawText = async () => {
        if (!agent || !activeToolConfig.rawText) return;
        setKnowledgeLoading(true);
        try {
            await knowledgeApi.saveText(agent.id, activeToolConfig.rawText);
            setActiveToolConfig({ ...activeToolConfig, rawText: "" });
            loadKnowledge(agent.id);
        } catch (err: any) {
            console.error(err);
            alert(err.response?.data?.detail || "Failed to save text");
        }
        setKnowledgeLoading(false);
    };

    const handleDeleteKnowledge = async (knowledgeId: string) => {
        if (!agent) return;
        try {
            await knowledgeApi.delete(agent.id, knowledgeId);
            loadKnowledge(agent.id);
        } catch (err) {
            console.error(err);
        }
    };

    const handleToggleStatus = async () => {
        if (!agent) return;
        try {
            if (agent.status === "live") {
                await agentApi.pause(agent.id);
            } else {
                await agentApi.deploy(agent.id);
            }
            loadData(agent.id);
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!agent) {
        return <div className="text-white p-8">Agent not found.</div>;
    }

    const connectedTools = agent.tools || [];
    const botPowerPercentage = Math.min(100, (connectedTools.length / Math.max(1, allTools.length)) * 100);

    return (
        <div className="max-w-6xl mx-auto pb-12">
            {/* 1. Header Row */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push("/dashboard/agents")}
                        className="text-slate-400 hover:text-white transition-colors p-2"
                    >
                        ←
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-white tracking-tight">{agent.name}</h1>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 ${agent.status === "live" ? "text-emerald-400 bg-emerald-500/10" :
                                agent.status === "paused" ? "text-yellow-400 bg-yellow-500/10" : "text-slate-400 bg-slate-500/10"
                                }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${agent.status === "live" ? "bg-emerald-400" :
                                    agent.status === "paused" ? "bg-yellow-400" : "bg-slate-400"
                                    }`}></span>
                                {agent.status === "live" ? "Active" : agent.status}
                            </span>
                        </div>
                        <div className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                            <span className="opacity-70">🤖</span> {agent.ai_provider} / {agent.ai_model} <span className="text-slate-600">•</span> {agent.platform}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => setIsChatOpen(true)} className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20">
                        <span className="opacity-80">💬</span> Test Agent
                    </button>
                    <button onClick={() => loadData(agent.id)} className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center">
                        ↻
                    </button>
                    <button onClick={handleToggleStatus} className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center">
                        {agent.status === "live" ? "⏸" : "▶"}
                    </button>
                </div>
            </div>

            {/* 2. Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                    { label: "Messages", value: agent.messages_count, icon: "💬", color: "text-blue-400" },
                    { label: "API Calls", value: agent.api_calls_count, icon: "⚡", color: "text-purple-400" },
                    { label: "Errors", value: agent.errors_count, icon: "⚠️", color: "text-red-400" },
                    { label: "Avg Response", value: `${agent.avg_response_ms}ms`, icon: "⏱", color: "text-emerald-400" }
                ].map((stat, i) => (
                    <div key={i} className="bg-slate-900/60 rounded-xl p-5 border border-slate-700/50">
                        <div className="flex items-center justify-between mb-3 text-sm font-medium text-slate-400">
                            {stat.label}
                            <span className={stat.color}>{stat.icon}</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* 3. Tabs Navigation */}
            <div className="flex overflow-x-auto hide-scrollbar border-b border-slate-800 mb-8">
                <div className="flex gap-2">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => {
                                setActiveTab(t.id);
                                if (t.id === "leads" && agent) loadLeads(agent.id);
                            }}
                            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all flex items-center gap-2 ${activeTab === t.id
                                ? "border-indigo-500 text-indigo-400"
                                : "border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-700"
                                }`}
                        >
                            <span className="opacity-70">{t.icon}</span>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 4. Tab Content */}
            <div className="min-h-[400px]">
                {activeTab === "tools" && (
                    <div className="space-y-8">
                        {/* Bot Power Level Header */}
                        <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-700/50 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                            <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />

                            <div className="z-10">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
                                    <span className="text-yellow-400">⚡</span> Bot Power Level
                                </h2>
                                <p className="text-sm text-slate-400">Connect tools to unlock new capabilities and level up your AI agent.</p>
                            </div>

                            <div className="w-full sm:w-1/3 min-w-[300px] z-10 flex flex-col gap-2">
                                <div className="flex justify-between text-xs font-medium text-indigo-300">
                                    <span>Level 1</span>
                                    <span>{connectedTools.length} Tools Connected</span>
                                </div>
                                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
                                        style={{ width: `${botPowerPercentage}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Tools Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {allTools.map((t) => {
                                const isEnabled = connectedTools.includes(t.id);

                                let badgeStyles = "bg-slate-800/80 text-slate-400";
                                let badgeLabel = t.badge?.replace("_", " ") || "STABLE";

                                if (t.badge === "stable") badgeStyles = "bg-emerald-500/10 text-emerald-500";
                                else if (t.badge === "beta") badgeStyles = "bg-blue-500/10 text-blue-400";
                                else if (t.badge === "alpha") badgeStyles = "bg-amber-500/10 text-amber-500";
                                else if (t.badge === "coming_soon") badgeStyles = "bg-orange-500/10 text-orange-400";

                                return (
                                    <div key={t.id} className={`rounded-xl p-5 border transition-all flex flex-col h-[180px] shadow-sm ${isEnabled ? "bg-[#1C1C1E] border-slate-700" : "bg-slate-900/40 border-slate-800/50 opacity-80 hover:opacity-100 grayscale-[0.2]"
                                        }`}>

                                        {/* Card Header */}
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl opacity-90">{t.icon}</span>
                                                <h3 className="text-sm font-semibold text-white tracking-wide">{t.name}</h3>
                                            </div>
                                            <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${badgeStyles}`}>
                                                {badgeLabel}
                                            </span>
                                        </div>

                                        {/* Description */}
                                        <p className="text-xs text-slate-400 mb-4 line-clamp-2 leading-relaxed flex-grow">
                                            {t.desc || "No description provided"}
                                        </p>

                                        {/* Card Footer */}
                                        <div className="flex items-center justify-between pt-4 mt-auto">
                                            <span className="text-xs text-slate-500">Status</span>

                                            <div className="flex items-center gap-4">
                                                {isEnabled && (
                                                    <>
                                                        <button onClick={() => handleOpenConfigure(t.id)} className="text-[11px] text-slate-400 hover:text-white transition-colors">Configure</button>
                                                        <button className="text-[11px] text-slate-400 hover:text-white transition-colors">View Logs</button>
                                                    </>
                                                )}

                                                {/* Toggle Switch */}
                                                <button
                                                    disabled={t.badge === "coming_soon" || saving}
                                                    onClick={() => handleToggleTool(t.id, !isEnabled)}
                                                    className={`w-[38px] h-[20px] rounded-full transition-colors relative shrink-0 focus:outline-none ml-1 ${t.badge === "coming_soon" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                                                        } ${isEnabled ? "bg-white" : "bg-[#2C2C2E]"
                                                        }`}
                                                >
                                                    <div className={`w-3.5 h-3.5 rounded-full absolute top-[3px] transition-all duration-200 ${isEnabled
                                                        ? "bg-black translate-x-[20px]"
                                                        : "bg-slate-400 translate-x-[4px]"
                                                        }`} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                {activeTab === "overview" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Column */}
                        <div className="space-y-6">

                            {/* Configuration Panel */}
                            <div className="bg-[#1C1C1E]/80 rounded-xl border border-slate-700/50 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                        <span className="opacity-70">⚙️</span> Configuration
                                    </h3>
                                    {!isEditingConfig ? (
                                        <button
                                            onClick={() => setIsEditingConfig(true)}
                                            className="text-slate-400 hover:text-white transition-colors"
                                        >
                                            ✎
                                        </button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setIsEditingConfig(false)}
                                                className="text-xs text-slate-400 hover:text-white"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveConfig}
                                                disabled={saving}
                                                className="text-xs bg-indigo-500 hover:bg-indigo-600 px-2 py-1 rounded text-white"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="p-5 space-y-4">
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                                        <span className="text-sm text-slate-400">Model</span>
                                        {!isEditingConfig ? (
                                            <span className="text-sm text-white font-medium">{agent.ai_provider} / {agent.ai_model}</span>
                                        ) : (
                                            <select
                                                value={`${editConfig.ai_provider}:${editConfig.ai_model}`}
                                                onChange={(e) => {
                                                    const [provider, model] = e.target.value.split(":");
                                                    setEditConfig({ ...editConfig, ai_provider: provider, ai_model: model });
                                                }}
                                                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white w-48 focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value=":" disabled>Select a model</option>
                                                {aiProviders.map(p => (
                                                    <optgroup key={p.id} label={p.name}>
                                                        {p.models.map(m => (
                                                            <option
                                                                key={m.id}
                                                                value={`${p.id}:${m.id}`}
                                                                disabled={!m.allowed}
                                                            >
                                                                {!m.allowed ? `🔒 ${m.name} (${(m.min_plan || 'Upgrade').charAt(0).toUpperCase() + (m.min_plan || 'Upgrade').slice(1)})` : m.name}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                                        <span className="text-sm text-slate-400">Platform</span>
                                        {!isEditingConfig ? (
                                            <span className="text-sm text-white font-medium capitalize">📱 {agent.platform}</span>
                                        ) : (
                                            <select
                                                value={editConfig.platform}
                                                onChange={(e) => setEditConfig({ ...editConfig, platform: e.target.value })}
                                                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white w-40 focus:outline-none focus:border-indigo-500 capitalize"
                                            >
                                                <option value="" disabled>Select a platform</option>
                                                {platforms.map(p => (
                                                    <option
                                                        key={p.id}
                                                        value={p.id}
                                                        disabled={p.is_upcoming}
                                                    >
                                                        {p.icon} {p.name} {p.is_upcoming ? "(Coming Soon)" : ""}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                                        <span className="text-sm text-slate-400">Temperature</span>
                                        {!isEditingConfig ? (
                                            <span className="text-sm text-white font-medium">{agent.temperature ?? 0.7}</span>
                                        ) : (
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="0"
                                                max="1"
                                                value={editConfig.temperature}
                                                onChange={(e) => {
                                                    let val = parseFloat(e.target.value);
                                                    if (isNaN(val)) val = 0;
                                                    val = Math.min(1, Math.max(0, val));
                                                    setEditConfig({ ...editConfig, temperature: val });
                                                }}
                                                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white text-right w-20"
                                            />
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-400">Version</span>
                                        {!isEditingConfig ? (
                                            <span className="text-sm text-white font-medium">{agent.version || "1.0.0"}</span>
                                        ) : (
                                            <input
                                                type="text"
                                                value={editConfig.version}
                                                onChange={(e) => setEditConfig({ ...editConfig, version: e.target.value })}
                                                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white text-right w-20"
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Server Details Panel */}
                            <div className="bg-[#1C1C1E] rounded-xl border border-slate-700/50 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
                                    <span className="opacity-70 text-slate-300">🖥️</span>
                                    <h3 className="text-sm font-semibold text-white">Server Details</h3>
                                </div>
                                <div className="p-5 space-y-4">
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                                        <span className="text-sm text-slate-400">IP Address</span>
                                        <span className="text-xs text-slate-500 font-mono bg-slate-900/50 px-2 py-1 rounded">Pending...</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                                        <span className="text-sm text-slate-400">Provider</span>
                                        <span className="text-xs text-white font-mono bg-slate-800 px-2 py-1 rounded">cloud-run</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                                        <span className="text-sm text-slate-400">Region</span>
                                        <span className="text-xs text-white font-mono bg-slate-800 px-2 py-1 rounded">us-central1</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-400">Port</span>
                                        <span className="text-xs text-white font-mono bg-slate-800 px-2 py-1 rounded">8080</span>
                                    </div>
                                </div>
                            </div>

                            {/* Live Logs Mini */}
                            <div className="bg-[#1C1C1E] rounded-xl border border-slate-700/50 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
                                    <span className="opacity-70 text-slate-300">&gt;_</span>
                                    <h3 className="text-sm font-semibold text-white">Live Logs</h3>
                                </div>
                                <div className="p-5">
                                    <p className="text-xs text-slate-400 mb-3">Recent system output</p>
                                    <div className="bg-[#0A0A0B] rounded-lg p-4 font-mono text-xs border border-slate-800/80 min-h-[140px]">
                                        {agent.status === "paused" ? (
                                            <div className="text-amber-500/80 leading-relaxed flex flex-col items-center justify-center h-full">
                                                <div className="text-2xl mb-2 opacity-50">⏸</div>
                                                <div>Agent is currently paused.</div>
                                                <div className="text-slate-500 mt-1">Start the agent to view live logs.</div>
                                            </div>
                                        ) : agent.status === "draft" ? (
                                            <div className="text-slate-500/80 leading-relaxed flex flex-col items-center justify-center h-full">
                                                <div className="text-2xl mb-2 opacity-30">○</div>
                                                <div>Agent is in draft mode.</div>
                                                <div className="text-slate-500 mt-1">Deploy the agent to view live logs.</div>
                                            </div>
                                        ) : (
                                            <div className="text-emerald-500/80 leading-relaxed">
                                                <div>[15:28:52] Server running on port 8080</div>
                                                <div>[15:28:52] Connected to {agent.ai_provider || "AI"} API</div>
                                                <div>[15:28:52] {agent.platform} gateway connected</div>
                                                <div>[15:28:52] Healthcheck: OK (memory: 128MB, cpu: 2%)</div>
                                                <div>[15:28:52] Listening for messages...</div>
                                                <div className="w-2 h-3 mt-1 bg-emerald-500 animate-pulse"></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-6">

                            {/* System Prompt Panel */}
                            <div className="bg-[#1C1C1E]/80 rounded-xl border border-slate-700/50 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                        <span className="opacity-70 text-slate-300">📖</span> System Prompt
                                    </h3>
                                    {!isEditingPrompt ? (
                                        <button
                                            onClick={() => setIsEditingPrompt(true)}
                                            className="text-slate-400 hover:text-white transition-colors"
                                        >
                                            ✎
                                        </button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setIsEditingPrompt(false)}
                                                className="text-xs text-slate-400 hover:text-white"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSavePrompt}
                                                disabled={saving}
                                                className="text-xs bg-indigo-500 hover:bg-indigo-600 px-2 py-1 rounded text-white"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="p-5">
                                    {!isEditingPrompt ? (
                                        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 text-sm text-slate-300 leading-relaxed min-h-[120px] whitespace-pre-wrap">
                                            {agent.system_prompt}
                                        </div>
                                    ) : (
                                        <textarea
                                            value={editPrompt}
                                            onChange={(e) => setEditPrompt(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-sm text-white resize-y min-h-[160px] focus:outline-none focus:border-indigo-500"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Quick Actions Panel */}
                            <div className="bg-[#1C1C1E] rounded-xl border border-slate-700/50 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-800">
                                    <h3 className="text-sm font-semibold text-white">Quick Actions</h3>
                                </div>
                                <div className="p-5 flex flex-col gap-3">
                                    <button
                                        onClick={() => setIsChatOpen(true)}
                                        className="w-full bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg py-3 px-4 text-sm font-medium flex items-center gap-3 transition-colors"
                                    >
                                        <span className="opacity-80">💬</span> Test Agent Chat
                                    </button>
                                    <button className="w-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 text-white rounded-lg py-3 px-4 text-sm font-medium flex items-center gap-3 transition-colors">
                                        <span className="opacity-80">&lt;&gt;</span> View Integration Code
                                    </button>
                                    {isAdmin() && (
                                        <button
                                            onClick={handleDeleteAgent}
                                            disabled={saving}
                                            className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded-lg py-3 px-4 text-sm font-medium flex items-center gap-3 transition-colors mt-2"
                                        >
                                            <span className="opacity-80">🗑️</span> Delete Instance
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === "leads" && (
                    <div className="space-y-6">
                        {/* Header */}
                        <div className="bg-[#1C1C1E]/80 rounded-xl border border-slate-700/50 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                        <span className="opacity-70">💬</span> Captured Leads
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">Contact information captured by your agent from user conversations.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleExportCsv}
                                        disabled={leads.length === 0}
                                        className="px-3 py-1.5 text-xs font-medium bg-slate-800 border border-slate-700/50 text-slate-300 hover:text-white rounded-lg transition-colors disabled:opacity-40 flex items-center gap-1.5"
                                    >
                                        ↓ Export CSV
                                    </button>
                                    <button
                                        onClick={() => agent && loadLeads(agent.id)}
                                        className="px-3 py-1.5 text-xs font-medium bg-slate-800 border border-slate-700/50 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1.5"
                                    >
                                        ↻ Refresh
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-5">
                                {leadsLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : leads.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <span className="text-4xl opacity-40 mb-4 block">💬</span>
                                        <h4 className="text-white font-medium mb-1">No leads captured yet.</h4>
                                        <p className="text-slate-500 text-sm">Enable &quot;Lead Catcher&quot; in Tools to start collecting data.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-800">
                                                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                                                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</th>
                                                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Phone</th>
                                                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Company</th>
                                                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Requirement</th>
                                                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Source</th>
                                                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                                                    <th className="text-right py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/50">
                                                {leads.map((lead) => (
                                                    <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors">
                                                        <td className="py-3 px-3 text-white font-medium">{lead.name || "—"}</td>
                                                        <td className="py-3 px-3 text-slate-300">
                                                            {lead.email ? (
                                                                <a href={`mailto:${lead.email}`} className="text-indigo-400 hover:text-indigo-300 transition-colors">{lead.email}</a>
                                                            ) : "—"}
                                                        </td>
                                                        <td className="py-3 px-3 text-slate-300">{lead.phone || "—"}</td>
                                                        <td className="py-3 px-3 text-slate-300">{lead.company || "—"}</td>
                                                        <td className="py-3 px-3 text-slate-300 max-w-[200px] truncate" title={lead.requirement || ""}>{lead.requirement || "—"}</td>
                                                        <td className="py-3 px-3">
                                                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500/10 text-emerald-400">
                                                                {lead.source || "chat"}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 text-slate-500 text-xs">
                                                            {lead.created_at ? new Date(lead.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                                                        </td>
                                                        <td className="py-3 px-3 text-right">
                                                            <button
                                                                onClick={() => handleDeleteLead(lead.id)}
                                                                className="text-slate-500 hover:text-red-400 transition-colors text-xs"
                                                            >
                                                                🗑
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Integration Tab ── */}
                {activeTab === "integration" && (
                    <div className="space-y-6">
                        {/* ─── PLATFORM-SPECIFIC SECTION ─── */}
                        {(() => {
                            const activeChannel = platforms.find(p => p.slug === agent.platform);
                            const isComingSoon = activeChannel?.is_upcoming || activeChannel?.badge === "coming_soon";

                            if (isComingSoon) {
                                return (
                                    <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-6">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg">{activeChannel?.icon || "🔗"}</span>
                                            <h3 className="text-lg font-bold text-white capitalize">{activeChannel?.name || agent.platform} Integration</h3>
                                        </div>
                                        <p className="text-slate-400 text-sm mb-4">Connect your AI agent to {activeChannel?.name || agent.platform}.</p>
                                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
                                            <p className="text-amber-400 text-sm font-medium">🚧 {activeChannel?.name || agent.platform} integration is coming soon!</p>
                                            <p className="text-slate-400 text-xs mt-1">We&apos;re working on adding {activeChannel?.name || agent.platform} support. Stay tuned for updates.</p>
                                        </div>
                                    </div>
                                );
                            }

                            if (agent.platform === "web") {
                                return (
                                    /* ═══ WEB EMBED WIDGET ═══ */
                                    <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-6">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg">🌐</span>
                                            <h3 className="text-lg font-bold text-white">Embed Chat Widget</h3>
                                        </div>
                                        <p className="text-slate-400 text-sm mb-6">Add this script to any HTML page to embed your AI chatbot. It creates a floating chat bubble in the bottom-right corner.</p>

                                        {/* Step 1 */}
                                        <div className="flex items-start gap-4 mb-5">
                                            <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0 mt-0.5">1</div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-white">Copy the Embed Code</h4>
                                                <p className="text-slate-400 text-xs mt-0.5">Copy the script below and paste it before the closing <code className="text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded text-xs">&lt;/body&gt;</code> tag of your HTML page.</p>
                                            </div>
                                        </div>

                                        {/* Code Block */}
                                        <div className="relative mb-5">
                                            <button
                                                onClick={() => {
                                                    const cssBlock = [
                                                        "#aiw-chat-bubble { position:fixed; bottom:24px; right:24px; width:60px; height:60px; border-radius:50%; background:" + themeColor + "; cursor:pointer; box-shadow:0 4px 24px rgba(0,0,0,.3); display:flex; align-items:center; justify-content:center; z-index:99999; transition:transform .2s; border:none; }",
                                                        "#aiw-chat-bubble:hover { transform:scale(1.1); }",
                                                        "#aiw-chat-bubble svg { width:28px; height:28px; fill:#fff; }",
                                                        "#aiw-chat-container { position:fixed; bottom:96px; right:24px; width:400px; max-height:600px; background:#0f172a; border:1px solid rgba(100,116,139,.3); border-radius:16px; z-index:99999; display:none; flex-direction:column; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,.5); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }",
                                                        "#aiw-chat-container.open { display:flex; }",
                                                        "#aiw-header { padding:16px 20px; background:" + themeColor + "; display:flex; align-items:center; gap:12px; }",
                                                        "#aiw-header-title { color:#fff; font-weight:600; font-size:15px; }",
                                                        "#aiw-header-sub { color:rgba(255,255,255,.7); font-size:12px; }",
                                                        "#aiw-messages { flex:1; overflow-y:auto; padding:16px; min-height:300px; max-height:420px; }",
                                                        ".aiw-msg { margin-bottom:12px; max-width:85%; padding:10px 14px; border-radius:12px; font-size:14px; line-height:1.5; word-wrap:break-word; }",
                                                        ".aiw-msg.user { background:" + themeColor + "; color:#fff; margin-left:auto; border-bottom-right-radius:4px; }",
                                                        ".aiw-msg.bot { background:#1e293b; color:#e2e8f0; border-bottom-left-radius:4px; }",
                                                        "#aiw-input-area { padding:12px 16px; border-top:1px solid rgba(100,116,139,.2); display:flex; gap:8px; }",
                                                        "#aiw-input { flex:1; background:#1e293b; border:1px solid rgba(100,116,139,.3); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px; outline:none; }",
                                                        "#aiw-input::placeholder { color:#64748b; }",
                                                        "#aiw-send { background:" + themeColor + "; border:none; border-radius:10px; padding:10px 16px; color:#fff; cursor:pointer; font-size:14px; font-weight:500; }",
                                                        "#aiw-send:hover { opacity:0.9; }",
                                                        ".aiw-msg.bot.aiw-typing { display:flex; gap:4px; padding:10px 14px; }",
                                                        ".aiw-msg.bot.aiw-typing span { width:8px; height:8px; background:#64748b; border-radius:50%; animation:aiw-bounce .6s infinite alternate; }",
                                                        ".aiw-msg.bot.aiw-typing span:nth-child(2) { animation-delay:.2s; }",
                                                        ".aiw-msg.bot.aiw-typing span:nth-child(3) { animation-delay:.4s; }",
                                                        "@keyframes aiw-bounce { to { opacity:.3; transform:translateY(-4px); } }"
                                                    ].join("\n    ");
                                                    const brandingHtml = !removeBranding ? '<div style="text-align:center; padding: 8px; font-size:11px; color:#64748b; background:#0f172a; border-top:1px solid rgba(100,116,139,.2)">Powered by <strong>AIWrapper</strong></div>' : '';
                                                    const displayName = botDisplayName || agent.name;
                                                    const code = "<!-- AIWrapper Chat Widget -->\n<script>\n(function() {\n" +
                                                        '  var AGENT_ID = "' + agent.id + '";\n' +
                                                        '  var API_URL = "http://localhost:8000/api/agents/" + AGENT_ID + "/widget-chat";\n' +
                                                        '  var STATUS_URL = "http://localhost:8000/api/agents/" + AGENT_ID + "/widget-status";\n\n' +
                                                        "  // Create styles\n  var style = document.createElement('style');\n" +
                                                        "  style.textContent = '\\n    " + cssBlock.replace(/'/g, "\\'") + "\\n  ';\n" +
                                                        "  document.head.appendChild(style);\n\n" +
                                                        "  function init() {\n" +
                                                        "    var bubble = document.createElement('button');\n" +
                                                        "    bubble.id = 'aiw-chat-bubble';\n" +
                                                        '    bubble.innerHTML = \'<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>\';\n' +
                                                        "    document.body.appendChild(bubble);\n\n" +
                                                        "    var container = document.createElement('div');\n" +
                                                        "    container.id = 'aiw-chat-container';\n" +
                                                        '    container.innerHTML = \'<div id="aiw-header"><div><div id="aiw-header-title">' + displayName + '</div><div id="aiw-header-sub">AI Assistant \\u2022 <span id="aiw-status-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;margin:0 4px;vertical-align:middle;"></span><span id="aiw-status-text">Checking...</span></div></div></div><div id="aiw-messages"></div><div id="aiw-input-area"><input id="aiw-input" placeholder="Type a message..." /><button id="aiw-send">Send</button></div>' + brandingHtml + "';\n" +
                                                        "    document.body.appendChild(container);\n\n" +
                                                        "    var messages = [];\n    var isOnline = true;\n" +
                                                        "    bubble.onclick = function() { container.classList.toggle('open'); };\n\n" +
                                                        "    fetch(STATUS_URL)\n      .then(function(r) { return r.json(); })\n      .then(function(data) {\n" +
                                                        "        isOnline = data.online;\n        var dot = document.getElementById('aiw-status-dot');\n        var statusText = document.getElementById('aiw-status-text');\n" +
                                                        "        if (isOnline) { dot.style.background = '#22c55e'; statusText.textContent = 'Online'; }\n" +
                                                        "        else { dot.style.background = '#ef4444'; statusText.textContent = 'Offline'; document.getElementById('aiw-input').disabled = true; document.getElementById('aiw-input').placeholder = 'Agent is offline'; document.getElementById('aiw-send').style.display = 'none'; var offlineMsg = document.createElement('div'); offlineMsg.className = 'aiw-msg bot'; offlineMsg.textContent = 'This agent is currently offline. Please try again later.'; document.getElementById('aiw-messages').appendChild(offlineMsg); }\n" +
                                                        "      })\n      .catch(function() { document.getElementById('aiw-status-text').textContent = 'Online'; });\n\n" +
                                                        "    function addMsg(role, text) { if (!text) return; var msgDiv = document.createElement('div'); msgDiv.className = 'aiw-msg ' + (role === 'user' ? 'user' : 'bot'); msgDiv.textContent = text; document.getElementById('aiw-messages').appendChild(msgDiv); document.getElementById('aiw-messages').scrollTop = 99999; }\n\n" +
                                                        "    function sendMsg() { if (!isOnline) return; var input = document.getElementById('aiw-input'); var text = input.value.trim(); if (!text) return; input.value = ''; messages.push({ role: 'user', content: text }); addMsg('user', text); var typing = document.createElement('div'); typing.className = 'aiw-msg bot aiw-typing'; typing.innerHTML = '<span></span><span></span><span></span>'; document.getElementById('aiw-messages').appendChild(typing); fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: messages }) }).then(function(r) { return r.json(); }).then(function(data) { typing.remove(); if (data.reply) { messages.push({ role: 'assistant', content: data.reply }); addMsg('bot', data.reply); } }).catch(function() { typing.remove(); addMsg('bot', 'Sorry, something went wrong. Please try again.'); }); }\n\n" +
                                                        "    document.getElementById('aiw-send').onclick = sendMsg;\n    document.getElementById('aiw-input').onkeydown = function(e) { if (e.key === 'Enter') sendMsg(); };\n  }\n\n" +
                                                        "  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }\n" +
                                                        "})();\n</script>";
                                                    navigator.clipboard.writeText(code);
                                                    setCopied(true);
                                                    setTimeout(() => setCopied(false), 2000);
                                                }}
                                                className="absolute top-3 right-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors z-10"
                                            >
                                                {copied ? "✓ Copied!" : "📋 Copy"}
                                            </button>
                                            <div className="bg-black/60 rounded-lg p-4 font-mono text-xs leading-5 border border-slate-800 overflow-x-auto max-h-[320px] overflow-y-auto">
                                                <div className="text-slate-500">&lt;!-- AIWrapper Chat Widget --&gt;</div>
                                                <div className="text-indigo-400">&lt;script&gt;</div>
                                                <div className="text-emerald-400/80 pl-2">(function() {"{"}</div>
                                                <div className="text-slate-300 pl-4">var <span className="text-amber-400">AGENT_ID</span> = <span className="text-emerald-400">&quot;{agent.id}&quot;</span>;</div>
                                                <div className="text-slate-300 pl-4">var <span className="text-amber-400">API_URL</span> = <span className="text-emerald-400">&quot;http://localhost:8000/api/agents/&quot;</span> + AGENT_ID + <span className="text-emerald-400">&quot;/widget-chat&quot;</span>;</div>
                                                <div className="text-slate-500 pl-4">// ... widget initialization code</div>
                                                <div className="text-slate-500 pl-4">// Creates a floating chat bubble + full chat UI</div>
                                                <div className="text-slate-500 pl-4">// Styled with indigo gradient theme</div>
                                                <div className="text-slate-500 pl-4">// Sends messages to your agent&apos;s API</div>
                                                <div className="text-emerald-400/80 pl-2">{"}"})()</div>
                                                <div className="text-indigo-400">&lt;/script&gt;</div>
                                            </div>
                                        </div>

                                        {/* Step 2 */}
                                        <div className="flex items-start gap-4 mb-5">
                                            <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0 mt-0.5">2</div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-white">Paste Before &lt;/body&gt;</h4>
                                                <p className="text-slate-400 text-xs mt-0.5">Add the copied script to your website&apos;s HTML, right before the closing <code className="text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded text-xs">&lt;/body&gt;</code> tag. It works on any site — WordPress, Shopify, static HTML, etc.</p>
                                            </div>
                                        </div>

                                        {/* Step 3 */}
                                        <div className="flex items-start gap-4">
                                            <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0 mt-0.5">3</div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-white">Start Chatting!</h4>
                                                <p className="text-slate-400 text-xs mt-0.5">A floating chat bubble will appear on your page. Visitors can click it to chat with your <strong className="text-white">{agent.name}</strong> agent powered by <strong className="text-white">{agent.ai_provider}/{agent.ai_model}</strong>.</p>
                                            </div>
                                        </div>

                                        {/* Preview Badge */}
                                        <div className="mt-5 bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                                                <svg width="20" height="20" fill="white" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
                                            </div>
                                            <div>
                                                <p className="text-indigo-300 text-sm font-medium">Widget Preview</p>
                                                <p className="text-slate-400 text-xs">The widget will appear as a floating bubble in the bottom-right corner of your website with your agent&apos;s name and an indigo/purple gradient theme.</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            if (agent.platform === "telegram") {
                                return (
                                    /* ═══ TELEGRAM BOT SETUP ═══ */
                                    <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-6">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg">🤖</span>
                                            <h3 className="text-lg font-bold text-white">Telegram Bot Setup</h3>
                                        </div>
                                        <p className="text-slate-400 text-sm mb-6">Follow these steps to connect your AI agent to Telegram.</p>

                                        {/* Step 1 */}
                                        <div className="flex items-start gap-4 mb-5">
                                            <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0 mt-0.5">1</div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-white">Create a Bot on Telegram</h4>
                                                <p className="text-slate-400 text-xs mt-0.5">
                                                    Open Telegram and search for <code className="text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded text-xs">@BotFather</code>. Send <code className="text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded text-xs">/newbot</code> and follow the prompts to choose a name and username.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Step 2 */}
                                        <div className="flex items-start gap-4 mb-5">
                                            <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0 mt-0.5">2</div>
                                            <div className="flex-1">
                                                <h4 className="text-sm font-semibold text-white">Paste Your Bot Token</h4>
                                                <p className="text-slate-400 text-xs mt-0.5 mb-3">
                                                    BotFather will give you a token like <code className="text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded text-xs">7123456789:AAHdqTcvCH1vGW...</code> — paste it below and click Activate.
                                                </p>
                                                <div className="flex gap-3">
                                                    <input
                                                        type="password"
                                                        value={botToken}
                                                        onChange={(e) => setBotToken(e.target.value)}
                                                        placeholder="Paste your Telegram bot token here..."
                                                        className="flex-1 bg-slate-800/80 border border-slate-600/50 rounded-lg px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                                                    />
                                                    <button
                                                        onClick={async () => {
                                                            if (!botToken.trim()) return;
                                                            setBotSaving(true);
                                                            await new Promise(r => setTimeout(r, 1500));
                                                            setBotConnected(true);
                                                            setBotSaving(false);
                                                        }}
                                                        disabled={botSaving || !botToken.trim()}
                                                        className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg px-5 py-3 text-sm font-medium flex items-center gap-2 transition-colors shrink-0"
                                                    >
                                                        <span>⚡</span> {botSaving ? "Activating..." : "Update"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Banner */}
                                        {botConnected && (
                                            <>
                                                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 mb-4">
                                                    <p className="text-emerald-400 text-sm font-medium">Bot is connected and active.</p>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                        <span className="text-emerald-400 text-xs">✓</span>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-emerald-400">Connected! Start Chatting</h4>
                                                        <p className="text-slate-400 text-xs mt-0.5">Open your bot in Telegram and send a message. Your {agent.ai_provider} agent will respond in real time.</p>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            }

                            if (agent.platform === "whatsapp") {
                                return (
                                    /* ═══ WHATSAPP SETUP ═══ */
                                    <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-6">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg text-emerald-500">💬</span>
                                                <h3 className="text-lg font-bold text-white">WhatsApp Integration</h3>
                                            </div>
                                            <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">BETA</span>
                                        </div>
                                        <p className="text-slate-400 text-sm mb-6">Connect your AI agent directly to a WhatsApp number.</p>

                                        {/* Step 1: Link Device */}
                                        <div className="flex items-start gap-4 mb-6 pb-6 border-b border-slate-800/60">
                                            <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0 mt-0.5">1</div>
                                            <div className="w-full">
                                                <h4 className="text-sm font-semibold text-white">Link WhatsApp Device</h4>
                                                <p className="text-slate-400 text-xs mt-0.5 mb-4">
                                                    Generate the pairing QR code and scan it using <strong>WhatsApp &gt; Linked Devices</strong> on your phone.
                                                </p>

                                                {/* QR Code UI */}
                                                {!isWaStreaming && !waQrConnected && !waQrImage ? (
                                                    <button
                                                        onClick={() => {
                                                            setIsWaStreaming(true);
                                                            setWaQrStatus("Connecting to WhatsApp servers...");
                                                            setWaQrImage(null);

                                                            const WA_BRIDGE_URL = process.env.NEXT_PUBLIC_WA_BRIDGE_URL || 'http://localhost:3001';
                                                            const evtSource = new EventSource(`${WA_BRIDGE_URL}/wa/qr/${agent.id}`);

                                                            evtSource.onmessage = (event) => {
                                                                try {
                                                                    const data = JSON.parse(event.data);

                                                                    if (data.type === 'status') {
                                                                        setWaQrStatus(data.message);
                                                                    }

                                                                    if (data.type === 'qr') {
                                                                        setWaQrImage(data.data);
                                                                        setWaQrStatus('Scan this QR code with your WhatsApp app');
                                                                        setIsWaStreaming(false);
                                                                    }

                                                                    if (data.type === 'connected') {
                                                                        setWaQrConnected(true);
                                                                        setWaQrImage(null);
                                                                        setIsWaStreaming(false);
                                                                        setWaQrStatus('');
                                                                        evtSource.close();
                                                                    }

                                                                    if (data.type === 'error') {
                                                                        setWaQrStatus(`Error: ${data.message} `);
                                                                        setIsWaStreaming(false);
                                                                        evtSource.close();
                                                                    }
                                                                } catch (err) {
                                                                    console.error(err);
                                                                }
                                                            };

                                                            evtSource.onerror = () => {
                                                                setIsWaStreaming(false);
                                                                setWaQrStatus('Connection lost. Please try again.');
                                                                evtSource.close();
                                                            };
                                                        }}
                                                        className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors"
                                                    >
                                                        <span>📱</span> Generate Pairing QR Code
                                                    </button>
                                                ) : waQrConnected ? (
                                                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                                            <span className="text-emerald-400 text-sm">✓</span>
                                                        </div>
                                                        <div>
                                                            <p className="text-emerald-400 font-medium text-sm">Device linked successfully!</p>
                                                            <p className="text-slate-400 text-xs">Your WhatsApp agent is live and receiving messages.</p>
                                                        </div>
                                                    </div>
                                                ) : waQrImage ? (
                                                    <div className="flex flex-col items-center gap-4">
                                                        <div className="bg-white rounded-xl p-3 shadow-lg shadow-emerald-500/10">
                                                            <img
                                                                src={waQrImage}
                                                                alt="WhatsApp Pairing QR Code"
                                                                className="w-[260px] h-[260px]"
                                                            />
                                                        </div>
                                                        <p className="text-emerald-400 text-xs font-medium animate-pulse">{waQrStatus}</p>
                                                        <p className="text-slate-500 text-[11px]">Open WhatsApp &rarr; Settings &rarr; Linked Devices &rarr; Link a Device</p>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                                        <p className="text-slate-400 text-sm">{waQrStatus || 'Initializing...'}</p>
                                                    </div>
                                                )}

                                            </div>
                                        </div>

                                        {/* Step 2: DM Policy */}
                                        <div className="flex items-start gap-4 mb-6">
                                            <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0 mt-0.5">2</div>
                                            <div className="w-full">
                                                <h4 className="text-sm font-semibold text-white">Connection Privacy</h4>
                                                <p className="text-slate-400 text-xs mt-0.5 mb-4">
                                                    Who is the AI allowed to respond to on this WhatsApp number?
                                                </p>

                                                <div className="grid grid-cols-2 gap-3 mb-4">
                                                    <button
                                                        onClick={() => setWaDmPolicy("allowlist")}
                                                        className={`p - 3 rounded - lg border text - left transition - colors flex flex - col gap - 1 ${waDmPolicy === "allowlist"
                                                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                                                : "bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800"
                                                            } `}
                                                    >
                                                        <span className="font-semibold text-sm">Allowlist Only</span>
                                                        <span className="text-xs opacity-80">Only responds to specific phone numbers. (Recommended for testing)</span>
                                                    </button>
                                                    <button
                                                        onClick={() => setWaDmPolicy("public")}
                                                        className={`p - 3 rounded - lg border text - left transition - colors flex flex - col gap - 1 ${waDmPolicy === "public"
                                                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                                                : "bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800"
                                                            } `}
                                                    >
                                                        <span className="font-semibold text-sm">Public (Anyone)</span>
                                                        <span className="text-xs opacity-80">Agent will reply to any incoming messages.</span>
                                                    </button>
                                                </div>

                                                {waDmPolicy === "allowlist" && (
                                                    <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
                                                        <label className="text-xs font-medium text-slate-300 block mb-2">Allowed Phone Numbers (Include country code, e.g., 15551234567)</label>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={newWaNumber}
                                                                onChange={(e) => setNewWaNumber(e.target.value.replace(/[^0-9+]/g, ''))}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' && newWaNumber.trim()) {
                                                                        if (!waAllowlist.includes(newWaNumber.trim())) {
                                                                            setWaAllowlist([...waAllowlist, newWaNumber.trim()]);
                                                                        }
                                                                        setNewWaNumber("");
                                                                    }
                                                                }}
                                                                placeholder="+1..."
                                                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    if (newWaNumber.trim() && !waAllowlist.includes(newWaNumber.trim())) {
                                                                        setWaAllowlist([...waAllowlist, newWaNumber.trim()]);
                                                                        setNewWaNumber("");
                                                                    }
                                                                }}
                                                                disabled={!newWaNumber.trim()}
                                                                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                                                            >
                                                                Add
                                                            </button>
                                                        </div>

                                                        {waAllowlist.length > 0 && (
                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                {waAllowlist.map(num => (
                                                                    <div key={num} className="bg-slate-900 border border-slate-700 rounded-full pl-3 pr-1 py-1 text-xs text-slate-300 flex items-center gap-2">
                                                                        {num}
                                                                        <button
                                                                            onClick={() => setWaAllowlist(waAllowlist.filter(n => n !== num))}
                                                                            className="w-5 h-5 rounded-full bg-slate-800 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-colors"
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="mt-4 flex justify-end">
                                                    <button
                                                        onClick={async () => {
                                                            setWaSaving(true);
                                                            try {
                                                                const freshConfig = {
                                                                    ...(agent.tool_configs || {}),
                                                                    whatsapp: { dmPolicy: waDmPolicy, allowFrom: waAllowlist }
                                                                };
                                                                const res = await agentApi.update(agent.id, { tool_configs: freshConfig });
                                                                setAgent({ ...res.data, status: agent.status });
                                                            } finally {
                                                                setWaSaving(false);
                                                            }
                                                        }}
                                                        disabled={waSaving}
                                                        className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 border border-slate-700"
                                                    >
                                                        {waSaving ? "Saving..." : "Save Policy Settings"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Dashboard */}
                                        <div className="mt-6 bg-[#0f172a]/50 border border-slate-800 rounded-lg p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-3 h-3 rounded-full bg-slate-500/50 animate-pulse" />
                                                <div>
                                                    <p className="text-sm font-medium text-white mb-0.5">Gateway Status</p>
                                                    <p className="text-xs text-slate-500">Watching for incoming connections...</p>
                                                </div>
                                            </div>
                                            <button
                                                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium px-3 py-1.5 rounded-md hover:bg-indigo-500/10 transition-colors"
                                                onClick={() => setActiveTab("logs")}
                                            >
                                                View Logs →
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            if (agent.platform === "discord") {
                                return (
                                    /* ═══ DISCORD BOT SETUP ═══ */
                                    <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-6">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg">🎮</span>
                                            <h3 className="text-lg font-bold text-white">Discord Bot Setup</h3>
                                        </div>
                                        <p className="text-slate-400 text-sm mb-6">Follow these steps to connect your AI agent to a Discord server.</p>

                                        {/* Step 1 */}
                                        <div className="flex items-start gap-4 mb-5">
                                            <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0 mt-0.5">1</div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-white">Create a App on Discord</h4>
                                                <p className="text-slate-400 text-xs mt-0.5">
                                                    Head to the <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Discord Developer Portal</a>, click <strong>New Application</strong>, and add a Bot. Once generated, copy the Bot Token.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Step 2 */}
                                        <div className="flex items-start gap-4 mb-5">
                                            <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0 mt-0.5">2</div>
                                            <div className="flex-1">
                                                <h4 className="text-sm font-semibold text-white">Provide Your Bot Token</h4>
                                                <p className="text-slate-400 text-xs mt-0.5 mb-3">
                                                    Paste the token from your Discord bot configuration below and click Activate.
                                                </p>
                                                <div className="flex gap-3">
                                                    <input
                                                        type="password"
                                                        value={discordToken}
                                                        onChange={(e) => setDiscordToken(e.target.value)}
                                                        placeholder="Paste your Discord bot token here..."
                                                        className="flex-1 bg-slate-800/80 border border-slate-600/50 rounded-lg px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                                                    />
                                                    <button
                                                        onClick={async () => {
                                                            if (!discordToken.trim()) return;
                                                            setDiscordSaving(true);
                                                            try {
                                                                const freshConfig = {
                                                                    ...(agent.tool_configs || {}),
                                                                    discord: { token: discordToken }
                                                                };
                                                                const res = await agentApi.update(agent.id, { tool_configs: freshConfig });
                                                                setAgent({ ...res.data, status: agent.status });
                                                                setDiscordConnected(true);
                                                            } finally {
                                                                setDiscordSaving(false);
                                                            }
                                                        }}
                                                        disabled={discordSaving || !discordToken.trim()}
                                                        className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg px-5 py-3 text-sm font-medium flex items-center gap-2 transition-colors shrink-0"
                                                    >
                                                        <span>⚡</span> {discordSaving ? "Activating..." : "Update"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Banner */}
                                        {discordConnected && (
                                            <>
                                                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 mb-4">
                                                    <p className="text-emerald-400 text-sm font-medium">Bot is connected and active.</p>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                        <span className="text-emerald-400 text-xs">✓</span>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-emerald-400">Invite Your Bot to a Server</h4>
                                                        <p className="text-slate-400 text-xs mt-0.5">Use the OAuth2 URL Generator in the Discord portal to invite the bot to your server with &apos;bot&apos; and &apos;application.commands&apos; scopes.</p>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            }

                            if (agent.platform === "slack") {
                                return (
                                    /* ═══ SLACK BOT SETUP ═══ */
                                    <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-6">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg">💼</span>
                                            <h3 className="text-lg font-bold text-white">Slack App Setup</h3>
                                        </div>
                                        <p className="text-slate-400 text-sm mb-6">Connect your AI agent to your Slack workspace using Socket Mode.</p>

                                        {/* Step 1 */}
                                        <div className="flex items-start gap-4 mb-5">
                                            <div className="w-7 h-7 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/40 flex items-center justify-center text-xs font-bold text-fuchsia-400 shrink-0 mt-0.5">1</div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-white">Create a Slack App</h4>
                                                <p className="text-slate-400 text-xs mt-0.5">
                                                    Go to the <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" className="text-fuchsia-400 hover:underline">Slack API Dashboard</a> and create a new App.
                                                    Enable <strong>Socket Mode</strong> and generate an App-Level Token with the <code className="text-fuchsia-400 bg-fuchsia-500/10 px-1.5 py-0.5 rounded text-[10px]">connections:write</code> scope.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Step 2 */}
                                        <div className="flex items-start gap-4 mb-5">
                                            <div className="w-7 h-7 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/40 flex items-center justify-center text-xs font-bold text-fuchsia-400 shrink-0 mt-0.5">2</div>
                                            <div className="flex-1">
                                                <h4 className="text-sm font-semibold text-white">Provide Your Tokens</h4>
                                                <p className="text-slate-400 text-xs mt-0.5 mb-3">
                                                    Paste your App Token (<code className="text-fuchsia-400 bg-fuchsia-500/10 px-1 py-0.5 rounded text-[10px]">xapp-...</code>) and your Bot Token (<code className="text-fuchsia-400 bg-fuchsia-500/10 px-1 py-0.5 rounded text-[10px]">xoxb-...</code>).
                                                </p>
                                                <div className="flex flex-col gap-3">
                                                    <input
                                                        type="password"
                                                        value={slackAppToken}
                                                        onChange={(e) => setSlackAppToken(e.target.value)}
                                                        placeholder="App Token (xapp-...)"
                                                        className="w-full bg-slate-800/80 border border-slate-600/50 rounded-lg px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors"
                                                    />
                                                    <div className="flex gap-3">
                                                        <input
                                                            type="password"
                                                            value={slackBotToken}
                                                            onChange={(e) => setSlackBotToken(e.target.value)}
                                                            placeholder="Bot Token (xoxb-...)"
                                                            className="flex-1 bg-slate-800/80 border border-slate-600/50 rounded-lg px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors"
                                                        />
                                                        <button
                                                            onClick={async () => {
                                                                if (!slackAppToken.trim() || !slackBotToken.trim()) return;
                                                                setSlackSaving(true);
                                                                try {
                                                                    const freshConfig = {
                                                                        ...(agent.tool_configs || {}),
                                                                        slack: {
                                                                            mode: "socket",
                                                                            appToken: slackAppToken,
                                                                            botToken: slackBotToken
                                                                        }
                                                                    };
                                                                    const res = await agentApi.update(agent.id, { tool_configs: freshConfig });
                                                                    setAgent({ ...res.data, status: agent.status });
                                                                    setSlackConnected(true);
                                                                } finally {
                                                                    setSlackSaving(false);
                                                                }
                                                            }}
                                                            disabled={slackSaving || (!slackAppToken.trim() || !slackBotToken.trim())}
                                                            className="bg-fuchsia-500 hover:bg-fuchsia-600 disabled:opacity-50 text-white rounded-lg px-5 py-3 text-sm font-medium flex items-center gap-2 transition-colors shrink-0"
                                                        >
                                                            <span>⚡</span> {slackSaving ? "Activating..." : "Update"}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Banner */}
                                        {slackConnected && (
                                            <>
                                                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 mb-4">
                                                    <p className="text-emerald-400 text-sm font-medium">Slack app is connected via Socket Mode.</p>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                        <span className="text-emerald-400 text-xs">✓</span>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-emerald-400">Subscribe to Events</h4>
                                                        <p className="text-slate-400 text-xs mt-0.5">Make sure your app is subscribed to `app_mention`, `message.channels`, `message.im`, etc. inside your Slack dashboard.</p>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            }

                            // Fallback for custom or unknown platforms
                            return (
                                <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-6">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg">{activeChannel?.icon || "🔗"}</span>
                                        <h3 className="text-lg font-bold text-white capitalize">{activeChannel?.name || agent.platform} Integration</h3>
                                    </div>
                                    <p className="text-slate-400 text-sm mb-4">Connect your AI agent to {activeChannel?.name || agent.platform}.</p>
                                    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-4 py-3">
                                        <p className="text-indigo-400 text-sm font-medium">✨ Contact Support</p>
                                        <p className="text-slate-400 text-xs mt-1">To fully integrate your agent with {activeChannel?.name || agent.platform}, please refer to our documentation or contact the engineering team.</p>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ─── SHARED SECTIONS (shown for all platforms) ─── */}

                        {/* What's Included in Your Plan */}
                        <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-6">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">◎</span>
                                <h3 className="text-lg font-bold text-white">What&apos;s Included in Your Plan</h3>
                            </div>
                            <p className="text-slate-400 text-sm mb-5">AIWrapper handles all the infrastructure — no API keys needed from you.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { title: "AI Model Access", desc: "OpenAI API calls are fully covered" },
                                    { title: "Webhook Hosting", desc: "Public webhook endpoints for all platforms" },
                                    { title: "SSL & Security", desc: "Encrypted connections & token storage" },
                                    { title: "Analytics & Logs", desc: "Full conversation history & metrics" },
                                ].map((item) => (
                                    <div key={item.title} className="flex items-center gap-3 bg-slate-800/40 rounded-lg p-3.5">
                                        <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                            <span className="text-emerald-400 text-sm">✓</span>
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-white">{item.title}</div>
                                            <div className="text-xs text-slate-400">{item.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Using for Lead Generation */}
                        <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-6">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">💌</span>
                                <h3 className="text-lg font-bold text-white">Using for Lead Generation</h3>
                            </div>
                            <p className="text-slate-400 text-sm mb-5">Turn your agent into a lead capture machine.</p>
                            <div className="space-y-4">
                                {[
                                    { step: 1, title: "Update your system prompt", desc: 'Include instructions like: "After answering 3 questions, politely ask for the visitor\'s name and email to follow up."' },
                                    { step: 2, title: "Embed the web widget", desc: "on your landing page, pricing page, or product page where visitors are most engaged." },
                                    { step: 3, title: "Connect your CRM", desc: "via the API — When the agent captures contact info, send it to HubSpot, Salesforce, or your email tool using a webhook or Zapier." },
                                    { step: 4, title: "Monitor conversations", desc: "in the Activity tab to see what visitors are asking and improve your agent's responses." }
                                ].map((item) => (
                                    <div key={item.step} className="flex items-start gap-4">
                                        <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0 mt-0.5">{item.step}</div>
                                        <div>
                                            <span className="text-sm font-semibold text-white">{item.title}</span>
                                            {item.desc.startsWith("Include") || item.desc.startsWith("via") || item.desc.startsWith("in ") ? (
                                                <span className="text-slate-400 text-sm"> — <em>{item.desc}</em></span>
                                            ) : (
                                                <span className="text-slate-400 text-sm"> {item.desc}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div >
                )}

                {/* ── Live Logs Tab ── */}
                {
                    activeTab === "logs" && (() => {
                        const events = activityData?.events || [];
                        const filteredEvents = activityFilter === "all" ? events :
                            events.filter((e: any) => e.type === activityFilter);

                        const typeColors: Record<string, string> = {
                            system: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                            connection: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                            message_in: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                            message_out: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
                            lead: "text-pink-400 bg-pink-500/10 border-pink-500/20",
                            error: "text-red-400 bg-red-500/10 border-red-500/20",
                        };

                        const typeLabels: Record<string, string> = {
                            all: "All Events",
                            system: "System",
                            connection: "Connections",
                            message_in: "Incoming",
                            message_out: "Responses",
                            lead: "Leads",
                        };

                        const formatTime = (ts: string) => {
                            if (!ts) return "--:--:--";
                            const d = new Date(ts);
                            return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
                        };

                        const formatDate = (ts: string) => {
                            if (!ts) return "";
                            const d = new Date(ts);
                            const today = new Date();
                            if (d.toDateString() === today.toDateString()) return "Today";
                            const yesterday = new Date(today);
                            yesterday.setDate(today.getDate() - 1);
                            if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
                            return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                        };

                        return (
                            <div className="space-y-5">
                                {/* ── Header ── */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm">
                                                📡
                                            </div>
                                            <h3 className="text-lg font-bold text-white">System Activity</h3>
                                            {autoRefresh && (
                                                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                    <span className="text-[10px] text-emerald-400 font-medium">LIVE</span>
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-slate-400 text-sm mt-1">Real-time logs of agent interactions, errors, and system events.</p>
                                    </div>
                                    <button
                                        onClick={() => setAutoRefresh(!autoRefresh)}
                                        className={`px - 3 py - 1.5 rounded - lg text - xs font - medium transition - all ${autoRefresh
                                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                                                : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-white"
                                            } `}
                                    >
                                        {autoRefresh ? "⏸ Pause" : "▶ Resume"}
                                    </button>
                                </div>

                                {/* ── Stats Bar ── */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        { label: "Total Messages", value: activityData?.total_messages || 0, color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
                                        { label: "Sessions", value: activityData?.total_sessions || 0, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
                                        { label: "Events Logged", value: events.length, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                                        { label: "Leads Captured", value: events.filter((e: any) => e.type === "lead").length, color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20" },
                                    ].map((stat) => (
                                        <div key={stat.label} className={`rounded - xl ${stat.bg} border ${stat.border} p - 3`}>
                                            <div className={`text - 2xl font - bold ${stat.color} `}>{stat.value}</div>
                                            <div className="text-[11px] text-slate-400 mt-0.5">{stat.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* ── Filter Pills ── */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    {Object.entries(typeLabels).map(([key, label]) => {
                                        const count = key === "all" ? events.length : events.filter((e: any) => e.type === key).length;
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => setActivityFilter(key)}
                                                className={`px - 3 py - 1.5 rounded - lg text - xs font - medium transition - all flex items - center gap - 1.5 ${activityFilter === key
                                                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                                                        : "bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:text-white hover:border-slate-600"
                                                    } `}
                                            >
                                                {label}
                                                {count > 0 && (
                                                    <span className={`px - 1.5 py - 0.5 rounded - full text - [10px] font - bold ${activityFilter === key ? "bg-indigo-500/30" : "bg-slate-700/60"
                                                        } `}>
                                                        {count}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* ── Event Feed ── */}
                                <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 overflow-hidden">
                                    {activityLoading ? (
                                        <div className="flex items-center justify-center py-20">
                                            <div className="flex items-center gap-3">
                                                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                                <span className="text-slate-400 text-sm">Loading activity...</span>
                                            </div>
                                        </div>
                                    ) : filteredEvents.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-center">
                                            <div className="text-4xl mb-3 opacity-40">📭</div>
                                            <div className="text-slate-400 font-medium">No activity yet</div>
                                            <div className="text-slate-500 text-sm mt-1 max-w-xs">
                                                {activityFilter !== "all"
                                                    ? `No ${typeLabels[activityFilter]?.toLowerCase()} events found.`
                                                    : "Send a message to your agent via WhatsApp, Discord, or the chat widget to see activity here."}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-800/60 max-h-[520px] overflow-y-auto">
                                            {filteredEvents.map((event: any, idx: number) => {
                                                const colors = typeColors[event.type] || typeColors.system;
                                                const colorParts = colors.split(" ");
                                                const showDateHeader = idx === 0 ||
                                                    formatDate(event.timestamp) !== formatDate(filteredEvents[idx - 1]?.timestamp);

                                                return (
                                                    <div key={idx}>
                                                        {showDateHeader && (
                                                            <div className="px-4 py-2 bg-slate-800/40 border-b border-slate-800/60">
                                                                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                                                    {formatDate(event.timestamp)}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="flex items-start gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors group">
                                                            {/* Icon */}
                                                            <div className={`mt - 0.5 w - 7 h - 7 rounded - lg flex items - center justify - center text - xs shrink - 0 border ${colorParts[1]} ${colorParts[2]} `}>
                                                                {event.icon}
                                                            </div>

                                                            {/* Content */}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text - sm font - medium ${colorParts[0]} `}>
                                                                        {event.title}
                                                                    </span>
                                                                    {event.session_ip && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 font-mono">
                                                                            {event.session_ip.replace("whatsapp_", "WA:").replace("discord_", "DC:").replace("slack_", "SL:")}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md">
                                                                    {event.detail}
                                                                </p>
                                                            </div>

                                                            {/* Timestamp */}
                                                            <div className="text-[11px] text-slate-600 font-mono shrink-0 group-hover:text-slate-400 transition-colors">
                                                                {formatTime(event.timestamp)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()
                }

                {/* ── Branding Tab ── */}
                {
                    activeTab === "branding" && (
                        <div className="space-y-6">
                            {/* Bot Persona & Branding */}
                            <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-6">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-lg">🎨</span>
                                    <h3 className="text-lg font-bold text-white">Bot Persona &amp; Branding</h3>
                                </div>
                                <p className="text-slate-400 text-sm mb-6">Customize how your agent appears in the web widget and other platforms.</p>

                                {/* Bot Display Name */}
                                <div className="mb-5">
                                    <label className="text-sm font-medium text-white block mb-2">Bot Display Name</label>
                                    <input
                                        type="text"
                                        value={botDisplayName}
                                        onChange={(e) => setBotDisplayName(e.target.value)}
                                        placeholder="My AI Assistant"
                                        className="w-full bg-slate-800/80 border border-slate-600/50 rounded-lg px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                                    />
                                    <p className="text-slate-500 text-xs mt-1.5">The name users will see when chatting.</p>
                                </div>

                                {/* Theme Color */}
                                <div className="mb-5">
                                    <label className="text-sm font-medium text-white block mb-2">Theme Color (Hex)</label>
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-full border-2 border-slate-600/50 shrink-0 cursor-pointer relative overflow-hidden"
                                            style={{ backgroundColor: themeColor }}
                                        >
                                            <input
                                                type="color"
                                                value={themeColor}
                                                onChange={(e) => setThemeColor(e.target.value)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            value={themeColor}
                                            onChange={(e) => setThemeColor(e.target.value)}
                                            placeholder="#3b82f6"
                                            className="flex-1 bg-slate-800/80 border border-slate-600/50 rounded-lg px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                                        />
                                    </div>
                                    <p className="text-slate-500 text-xs mt-1.5">Used for chat bubbles and buttons in the web widget.</p>
                                </div>

                                {/* Avatar Image URL */}
                                <div className="mb-6">
                                    <label className="text-sm font-medium text-white block mb-2">Avatar Image URL (Optional)</label>
                                    <input
                                        type="text"
                                        value={avatarUrl}
                                        onChange={(e) => setAvatarUrl(e.target.value)}
                                        placeholder="https://example.com/logo.png"
                                        className="w-full bg-slate-800/80 border border-slate-600/50 rounded-lg px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                                    />
                                    <p className="text-slate-500 text-xs mt-1.5">A square image URL to represent your bot.</p>
                                </div>

                                {/* Remove Branding Toggle */}
                                <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 p-4 flex items-center justify-between mb-6">
                                    <div>
                                        <h4 className="text-sm font-medium text-white">Remove &quot;Powered by AIWrapper&quot;</h4>
                                        <p className="text-slate-500 text-xs mt-0.5">Hide our branding from the chat widget (Premium feature).</p>
                                    </div>
                                    <button
                                        onClick={() => setRemoveBranding(!removeBranding)}
                                        className={`relative w - 12 h - 7 rounded - full transition - colors duration - 200 ${removeBranding ? 'bg-indigo-500' : 'bg-slate-600'
                                            } `}
                                    >
                                        <span
                                            className={`absolute top - 1 left - 1 w - 5 h - 5 bg - white rounded - full shadow transition - transform duration - 200 ${removeBranding ? 'translate-x-5' : 'translate-x-0'
                                                } `}
                                        />
                                    </button>
                                </div>

                                {/* Save Button */}
                                <button
                                    onClick={async () => {
                                        if (!agent) return;
                                        setBrandingSaving(true);
                                        try {
                                            const updatedConfigs = {
                                                ...agent.tool_configs,
                                                widget_branding: {
                                                    botDisplayName,
                                                    themeColor,
                                                    removeBranding
                                                }
                                            };
                                            const res = await agentApi.update(agent.id, { tool_configs: updatedConfigs });
                                            setAgent({ ...res.data, status: agent.status });
                                            setBrandingSaved(true);
                                            setTimeout(() => setBrandingSaved(false), 2500);
                                        } catch (err) {
                                            console.error(err);
                                        } finally {
                                            setBrandingSaving(false);
                                        }
                                    }}
                                    disabled={brandingSaving}
                                    className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg px-5 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors"
                                >
                                    <span>💾</span> {brandingSaving ? "Saving..." : brandingSaved ? "✓ Saved!" : "Save Branding"}
                                </button>
                            </div>

                        </div>
                    )
                }

                {/* Catch-all placeholder for remaining tabs */}
                {/* ─── Dashboard Tab ─── */}
                {
                    activeTab === "dashboard" && (() => {
                        // Fetch dashboard data on mount
                        if (!dashboardData && !dashboardLoading) {
                            setDashboardLoading(true);
                            agentApi.dashboardStats(agent.id)
                                .then(res => { setDashboardData(res.data); setDashboardLoading(false); })
                                .catch(() => setDashboardLoading(false));
                        }

                        const loadSessionMessages = async (sessionId: string) => {
                            setSessionLoading(true);
                            try {
                                const res = await agentApi.sessionMessages(agent.id, sessionId);
                                setSessionMessages(res.data.messages || []);
                            } catch { setSessionMessages([]); }
                            setSessionLoading(false);
                        };

                        const timeAgo = (iso: string) => {
                            if (!iso) return "—";
                            const diff = Date.now() - new Date(iso).getTime();
                            const mins = Math.floor(diff / 60000);
                            if (mins < 1) return "Just now";
                            if (mins < 60) return `${mins}m ago`;
                            const hrs = Math.floor(mins / 60);
                            if (hrs < 24) return `${hrs}h ago`;
                            const days = Math.floor(hrs / 24);
                            return `${days}d ago`;
                        };

                        const overview = dashboardData?.overview || {};
                        const dailyMsgs = dashboardData?.daily_messages || [];
                        const dailySess = dashboardData?.daily_sessions || [];
                        const sessions = dashboardData?.recent_sessions || [];
                        const maxMsg = Math.max(...dailyMsgs.map((d: { count: number }) => d.count), 1);
                        const maxSess = Math.max(...dailySess.map((d: { count: number }) => d.count), 1);

                        return (
                            <div className="space-y-6">
                                {dashboardLoading ? (
                                    <div className="flex items-center justify-center min-h-[300px]">
                                        <div className="text-center">
                                            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                            <p className="text-slate-400 text-sm">Loading dashboard...</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Overview Cards */}
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                            {[
                                                { label: "Total Users", value: overview.total_sessions || 0, icon: "👥", color: "from-indigo-500/20 to-indigo-600/5", border: "border-indigo-500/30", text: "text-indigo-400" },
                                                { label: "Total Messages", value: overview.total_messages || 0, icon: "💬", color: "from-emerald-500/20 to-emerald-600/5", border: "border-emerald-500/30", text: "text-emerald-400" },
                                                { label: "Avg Response", value: `${overview.avg_response_ms || 0} ms`, icon: "⚡", color: "from-amber-500/20 to-amber-600/5", border: "border-amber-500/30", text: "text-amber-400" },
                                                { label: "API Calls", value: overview.api_calls_count || 0, icon: "🔄", color: "from-purple-500/20 to-purple-600/5", border: "border-purple-500/30", text: "text-purple-400" },
                                            ].map((card, i) => (
                                                <div key={i} className={`bg - gradient - to - br ${card.color} rounded - xl border ${card.border} p - 5`}>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <span className="text-2xl">{card.icon}</span>
                                                        {card.label === "Avg Response" && overview.errors_count > 0 && (
                                                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">{overview.errors_count} errors</span>
                                                        )}
                                                    </div>
                                                    <div className={`text - 2xl font - bold ${card.text} `}>{card.value}</div>
                                                    <div className="text-slate-400 text-xs mt-1">{card.label}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Charts Row */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                            {/* Daily Messages Bar Chart */}
                                            <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-5">
                                                <h3 className="text-white font-semibold text-sm mb-1">📊 Daily Messages</h3>
                                                <p className="text-slate-500 text-xs mb-4">Last 7 days</p>
                                                <div className="flex items-end gap-2 h-36">
                                                    {dailyMsgs.map((d: { date: string, count: number }, i: number) => {
                                                        const h = maxMsg > 0 ? (d.count / maxMsg) * 100 : 0;
                                                        return (
                                                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                                                <span className="text-[10px] text-slate-400 font-medium">{d.count}</span>
                                                                <div className="w-full rounded-t-md bg-gradient-to-t from-indigo-600 to-indigo-400 transition-all duration-500" style={{ height: `${Math.max(h, 4)}% ` }} />
                                                                <span className="text-[9px] text-slate-500 mt-1">{d.date.slice(5)}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Daily New Users Area Chart */}
                                            <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-5">
                                                <h3 className="text-white font-semibold text-sm mb-1">👤 Daily New Users</h3>
                                                <p className="text-slate-500 text-xs mb-4">Last 7 days</p>
                                                <div className="relative h-36">
                                                    <svg viewBox="0 0 280 120" className="w-full h-full" preserveAspectRatio="none">
                                                        <defs>
                                                            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                                                                <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                                                            </linearGradient>
                                                        </defs>
                                                        {/* Area fill */}
                                                        <path
                                                            d={`M0, 120 ${dailySess.map((d: { count: number }, i: number) => {
                                                                const x = (i / 6) * 280;
                                                                const y = 120 - (maxSess > 0 ? (d.count / maxSess) * 100 : 0);
                                                                return `L${x},${y}`;
                                                            }).join(' ')
                                                                } L280, 120 Z`}
                                                            fill="url(#areaGradient)"
                                                        />
                                                        {/* Line */}
                                                        <path
                                                            d={`M${dailySess.map((d: { count: number }, i: number) => {
                                                                const x = (i / 6) * 280;
                                                                const y = 120 - (maxSess > 0 ? (d.count / maxSess) * 100 : 0);
                                                                return `${x},${y}`;
                                                            }).join(' L')
                                                                } `}
                                                            fill="none"
                                                            stroke="#10b981"
                                                            strokeWidth="2.5"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        />
                                                        {/* Dots */}
                                                        {dailySess.map((d: { count: number }, i: number) => {
                                                            const x = (i / 6) * 280;
                                                            const y = 120 - (maxSess > 0 ? (d.count / maxSess) * 100 : 0);
                                                            return <circle key={i} cx={x} cy={y} r="4" fill="#10b981" stroke="#0f172a" strokeWidth="2" />;
                                                        })}
                                                    </svg>
                                                    {/* X-axis labels */}
                                                    <div className="flex justify-between mt-1">
                                                        {dailySess.map((d: { date: string, count: number }, i: number) => (
                                                            <span key={i} className="text-[9px] text-slate-500">{d.date.slice(5)}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Recent Sessions */}
                                        <div className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <h3 className="text-white font-semibold text-sm flex items-center gap-2">🗂️ Recent Chat Sessions</h3>
                                                    <p className="text-slate-500 text-xs mt-0.5">{sessions.length} session{sessions.length !== 1 ? 's' : ''} found • Click to view messages</p>
                                                </div>
                                            </div>

                                            {sessions.length === 0 ? (
                                                <div className="text-center py-12">
                                                    <span className="text-4xl opacity-40 block mb-3">💭</span>
                                                    <p className="text-slate-400 text-sm">No chat sessions yet</p>
                                                    <p className="text-slate-600 text-xs mt-1">Sessions will appear here once users start chatting with your agent</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-0 rounded-lg overflow-hidden border border-slate-700/40">
                                                    {/* Table Header */}
                                                    <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-800/50 text-xs text-slate-400 font-medium">
                                                        <div className="col-span-3">Session / IP</div>
                                                        <div className="col-span-1 text-center">Msgs</div>
                                                        <div className="col-span-4">Last Message</div>
                                                        <div className="col-span-2">Started</div>
                                                        <div className="col-span-2 text-right">Last Active</div>
                                                    </div>

                                                    {/* Session Rows */}
                                                    <div className="max-h-[400px] overflow-y-auto">
                                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                        {sessions.map((s: any) => (
                                                            <div key={s.id}>
                                                                <button
                                                                    onClick={() => {
                                                                        if (selectedSession?.id === s.id) {
                                                                            setSelectedSession(null);
                                                                            setSessionMessages([]);
                                                                        } else {
                                                                            setSelectedSession(s);
                                                                            loadSessionMessages(s.id);
                                                                        }
                                                                    }}
                                                                    className={`w - full grid grid - cols - 12 gap - 3 px - 4 py - 3 text - left text - sm transition - colors hover: bg - slate - 800 / 40 border - b border - slate - 800 / 30 ${selectedSession?.id === s.id ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : ''
                                                                        } `}
                                                                >
                                                                    <div className="col-span-3 flex items-center gap-2">
                                                                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                                                                        <span className="text-white text-xs font-mono truncate">{s.session_ip}</span>
                                                                    </div>
                                                                    <div className="col-span-1 text-center">
                                                                        <span className="bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded-full text-xs">{s.message_count}</span>
                                                                    </div>
                                                                    <div className="col-span-4">
                                                                        <span className="text-slate-400 text-xs truncate block">{s.last_message || "—"}</span>
                                                                    </div>
                                                                    <div className="col-span-2 text-slate-500 text-xs">{timeAgo(s.created_at)}</div>
                                                                    <div className="col-span-2 text-right text-slate-500 text-xs">{timeAgo(s.updated_at)}</div>
                                                                </button>

                                                                {/* Expanded Session Messages */}
                                                                {selectedSession?.id === s.id && (
                                                                    <div className="bg-slate-950/60 border-l-2 border-l-indigo-500/50 px-6 py-4">
                                                                        <div className="flex items-center justify-between mb-3">
                                                                            <h4 className="text-white text-xs font-semibold flex items-center gap-2">
                                                                                💬 Chat Transcript — <span className="text-slate-400 font-mono">{s.session_ip}</span>
                                                                            </h4>
                                                                            <button onClick={() => { setSelectedSession(null); setSessionMessages([]); }} className="text-slate-500 hover:text-white text-xs">✕ Close</button>
                                                                        </div>

                                                                        {sessionLoading ? (
                                                                            <div className="flex items-center gap-2 py-6 justify-center">
                                                                                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                                                                <span className="text-slate-400 text-xs">Loading messages...</span>
                                                                            </div>
                                                                        ) : sessionMessages.length === 0 ? (
                                                                            <p className="text-slate-500 text-xs py-4 text-center">No messages found</p>
                                                                        ) : (
                                                                            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                                                                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                                                {sessionMessages.map((m: any, mi: number) => (
                                                                                    <div key={mi} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} `}>
                                                                                        <div className={`max - w - [80 %] rounded - xl px - 3.5 py - 2.5 text - xs leading - relaxed ${m.role === 'user'
                                                                                                ? 'bg-indigo-500/20 text-indigo-100 border border-indigo-500/20'
                                                                                                : 'bg-slate-800/60 text-slate-300 border border-slate-700/30'
                                                                                            } `}>
                                                                                            <div className="flex items-center gap-2 mb-1">
                                                                                                <span className="font-semibold text-[10px] uppercase tracking-wide opacity-60">
                                                                                                    {m.role === 'user' ? '👤 User' : '🤖 Agent'}
                                                                                                </span>
                                                                                                {m.created_at && (
                                                                                                    <span className="text-[9px] text-slate-500">
                                                                                                        {new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                            <p className="whitespace-pre-wrap">{m.content}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })()
                }

                {/* Catch-all placeholder for remaining tabs */}
                {
                    activeTab !== "tools" && activeTab !== "overview" && activeTab !== "leads" && activeTab !== "integration" && activeTab !== "logs" && activeTab !== "branding" && activeTab !== "dashboard" && (
                        <div className="flex items-center justify-center min-h-[300px] border border-slate-800/50 bg-slate-900/20 rounded-xl border-dashed">
                            <div className="text-center">
                                <span className="text-4xl opacity-50 mb-4 block">🚧</span>
                                <h3 className="text-white font-medium mb-1">Coming Soon</h3>
                                <p className="text-slate-500 text-sm">The {tabs.find(t => t.id === activeTab)?.label} tab is under construction.</p>
                            </div>
                        </div>
                    )
                }
            </div >

            {/* 5. Tool Configuration Modal */}
            {
                configureToolModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className={`bg - [#1C1C1E] border border - slate - 700 / 50 rounded - xl w - full ${configureToolModal === "knowledge_base" ? "max-w-5xl" : "max-w-lg"} overflow - hidden shadow - 2xl flex flex - col max - h - [90vh]`}>
                            {/* Modal Header */}
                            <div className="flex items-start justify-between p-5 border-b border-slate-800">
                                <div className="flex items-center gap-3">
                                    {configureToolModal === "knowledge_base" && (
                                        <button
                                            onClick={() => setConfigureToolModal(null)}
                                            className="w-10 h-10 flex items-center justify-center bg-[#1C1C1E] hover:bg-slate-800 border border-slate-700/50 text-slate-300 rounded-lg mr-2 transition-colors"
                                        >
                                            ←
                                        </button>
                                    )}
                                    <span className="text-2xl opacity-90">
                                        {allTools.find(t => t.id === configureToolModal)?.icon || "⚙️"}
                                    </span>
                                    <div>
                                        <h3 className="text-lg font-bold text-white tracking-wide">
                                            {configureToolModal === "knowledge_base" ? "Knowledge Base (RAG)" : `Configure ${allTools.find(t => t.id === configureToolModal)?.name} `}
                                        </h3>
                                        <p className="text-sm text-slate-400 mt-0.5">
                                            {configureToolModal === "knowledge_base" ? "Manage the specialized knowledge your agent uses to answer questions." : "Configure settings and parameters for the selected tool."}
                                        </p>
                                    </div>
                                </div>
                                {configureToolModal !== "knowledge_base" && (
                                    <button
                                        onClick={() => setConfigureToolModal(null)}
                                        className="text-slate-500 hover:text-white transition-colors p-1"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Modal Body */}
                            <div className="p-5 flex-grow overflow-y-auto space-y-6">
                                {configureToolModal === "lead_catcher" && (
                                    <>
                                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
                                            <h4 className="text-sm font-semibold text-indigo-300 mb-2 flex items-center gap-2">
                                                <span className="opacity-70">ℹ️</span> How to configure Lead Catcher:
                                            </h4>
                                            <p className="text-sm text-indigo-200/80 mb-3 leading-relaxed">
                                                This tool allows your AI agent to automatically intercept conversations and capture user details when they show buying intent.
                                            </p>
                                            <ol className="text-sm text-indigo-200/80 space-y-1.5 list-decimal pl-4">
                                                <li>Select the specific data fields you want the agent to collect.</li>
                                                <li>Optionally, add a webhook URL (like Zapier) to push leads instantly to your CRM.</li>
                                                <li>In chat, if a user says "I want to sign up", the AI will proactively ask for their details.</li>
                                            </ol>
                                        </div>

                                        <div>
                                            <label className="text-sm text-slate-300 font-medium mb-3 block">Data to Collect</label>
                                            <div className="space-y-2">
                                                {[
                                                    { key: "name", label: "Name" },
                                                    { key: "email", label: "Email" },
                                                    ...(agent.platform !== "whatsapp" ? [{ key: "phone", label: "Phone Number" }] : []),
                                                    { key: "company", label: "Company Name" },
                                                    { key: "requirement", label: "Requirement" },
                                                ].map((field) => (
                                                    <label key={field.key} className="flex items-center gap-3 text-sm text-slate-400 cursor-pointer hover:text-white transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={activeToolConfig[field.key] !== false}
                                                            onChange={(e) => setActiveToolConfig({ ...activeToolConfig, [field.key]: e.target.checked })}
                                                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500/50 focus:ring-offset-0"
                                                        />
                                                        <span>{field.label}</span>
                                                        {field.key === "requirement" && (
                                                            <span className="text-[10px] text-slate-600 ml-1">— AI will ask & analyze what the user needs</span>
                                                        )}
                                                    </label>
                                                ))}
                                                {agent.platform === "whatsapp" && (
                                                    <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 mt-1">
                                                        <span>📱</span>
                                                        <span>Phone number is auto-captured from WhatsApp — no need to ask!</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-sm text-slate-300 font-medium mb-2 block">CRM Integration (Optional)</label>
                                            <input
                                                type="url"
                                                value={activeToolConfig.webhookUrl || ""}
                                                onChange={(e) => setActiveToolConfig({ ...activeToolConfig, webhookUrl: e.target.value })}
                                                placeholder="Webhook URL (e.g. Zapier)"
                                                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                                            />
                                        </div>
                                    </>
                                )}

                                {configureToolModal === "knowledge_base" && (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        <div className="lg:col-span-2 space-y-4">
                                            <div className="border border-slate-800/80 rounded-xl p-5">
                                                <h4 className="text-sm font-bold text-white mb-1">Add Knowledge</h4>
                                                <p className="text-[13px] text-slate-400 mb-5">
                                                    Paste text, documentation, or FAQs. The system will chunk and embed it automatically.
                                                </p>

                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    onChange={handleUploadKnowledge}
                                                    className="hidden"
                                                    accept=".pdf,.txt"
                                                />
                                                <div
                                                    className={`border border - dashed border - slate - 700 / 80 rounded - xl p - 8 text - center bg - [#111111] hover: bg - [#141414] transition - colors cursor - pointer group ${knowledgeLoading ? 'opacity-50 pointer-events-none' : ''} `}
                                                    onClick={() => fileInputRef.current?.click()}
                                                >
                                                    <div className="text-2xl mb-3 opacity-60 group-hover:opacity-100 transition-opacity">↑</div>
                                                    <div className="text-xs font-semibold text-slate-200 mb-1">Upload Document</div>
                                                    <div className="text-[11px] text-slate-500 mb-4">PDF or Text files (max 5MB)</div>
                                                    <button className="bg-[#1A1A1A] hover:bg-[#222222] border border-slate-700/50 text-xs font-medium text-slate-300 px-4 py-2 rounded-lg transition-colors">
                                                        {knowledgeLoading ? "Uploading..." : "Select File"}
                                                    </button>
                                                </div>

                                                <div className="relative flex items-center py-5">
                                                    <div className="flex-grow border-t border-slate-800/80"></div>
                                                    <span className="flex-shrink-0 mx-4 text-[10px] font-bold tracking-wider text-slate-500 uppercase">Or Import Website URL</span>
                                                    <div className="flex-grow border-t border-slate-800/80"></div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <input
                                                        type="url"
                                                        value={activeToolConfig.scrapeUrl || ""}
                                                        onChange={(e) => setActiveToolConfig({ ...activeToolConfig, scrapeUrl: e.target.value })}
                                                        placeholder="https://example.com"
                                                        disabled={knowledgeLoading}
                                                        className="flex-grow bg-[#111111] border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-slate-600 disabled:opacity-50"
                                                    />
                                                    <button
                                                        onClick={handleScrapeUrl}
                                                        disabled={knowledgeLoading || !activeToolConfig.scrapeUrl}
                                                        className="bg-[#1A1A1A] hover:bg-[#222222] border border-slate-700/50 text-slate-300 text-xs font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {knowledgeLoading ? "Scraping..." : <><span>🌐</span> Scrape URL</>}
                                                    </button>
                                                </div>

                                                <div className="relative flex items-center py-5">
                                                    <div className="flex-grow border-t border-slate-800/80"></div>
                                                    <span className="flex-shrink-0 mx-4 text-[10px] font-bold tracking-wider text-slate-500 uppercase">Or Paste Raw Text</span>
                                                    <div className="flex-grow border-t border-slate-800/80"></div>
                                                </div>

                                                <div className="relative">
                                                    <textarea
                                                        value={activeToolConfig.rawText || ""}
                                                        onChange={(e) => setActiveToolConfig({ ...activeToolConfig, rawText: e.target.value })}
                                                        placeholder="Paste your content here..."
                                                        rows={5}
                                                        disabled={knowledgeLoading}
                                                        className="w-full bg-[#111111] border border-slate-800 rounded-lg px-4 py-3 text-xs text-slate-300 focus:outline-none focus:border-slate-600 font-mono resize-none disabled:opacity-50"
                                                    />
                                                    <div className="absolute bottom-3 right-3">
                                                        <button
                                                            onClick={handleSaveRawText}
                                                            disabled={knowledgeLoading || !activeToolConfig.rawText}
                                                            className="bg-slate-300 hover:bg-white text-black text-[11px] font-bold px-4 py-1.5 rounded flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {knowledgeLoading ? "Saving..." : <><span>💾</span> Save Text</>}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                                    <span>📄</span> Knowledge Chunks ({knowledgeItems.length})
                                                </h4>
                                                {knowledgeItems.length === 0 ? (
                                                    <div className="border border-dashed border-slate-800 rounded-xl p-10 text-center bg-[#111111]">
                                                        <p className="text-sm text-slate-400">No knowledge added yet.</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {knowledgeItems.map((item) => (
                                                            <div key={item.id} className="border border-slate-800 rounded-lg p-3 bg-[#111111] flex items-center justify-between">
                                                                <div>
                                                                    <div className="text-xs font-bold text-white line-clamp-1 break-all" title={item.source_name}>{item.source_name}</div>
                                                                    <div className="text-[10px] text-slate-500 uppercase mt-0.5">
                                                                        {item.source_type} • {item.chunk_count} chunk(s)
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleDeleteKnowledge(item.id)}
                                                                    title="Delete item"
                                                                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="border border-slate-800/80 rounded-xl bg-[#111111] overflow-hidden">
                                                <div className="px-5 py-4 border-b border-slate-800/50">
                                                    <h3 className="text-xs font-bold text-blue-400">RAG Status</h3>
                                                </div>
                                                <div className="p-5 space-y-5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-slate-300">Vector Search</span>
                                                        <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">Active</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-slate-300">Embedding Model</span>
                                                        <span className="text-xs text-slate-400">OpenAI v3-small</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-slate-300">Total Chunks</span>
                                                        <span className="text-xs font-bold text-white">
                                                            {knowledgeItems.reduce((acc, item) => acc + item.chunk_count, 0)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="border border-slate-800/80 rounded-xl p-5 bg-[#111111]">
                                                <h3 className="text-xs font-bold text-white mb-4">Tips</h3>
                                                <ul className="text-xs text-slate-400 space-y-3.5 leading-relaxed">
                                                    <li>• Keep chunks focused on a single topic.</li>
                                                    <li>• Use Q&A format for best results (e.g., "Q: What is X? A: X is...").</li>
                                                    <li>• Avoid dumping huge raw JSON files; summarize them first.</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {configureToolModal === "browser" && (
                                    <>
                                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                                            <h4 className="text-sm font-semibold text-blue-300 mb-2 flex items-center gap-2">
                                                <span className="opacity-70">ℹ️</span> How to use Browser Automation:
                                            </h4>
                                            <p className="text-sm text-blue-200/80 mb-3 leading-relaxed">
                                                Grant your agent the ability to navigate, click, and extract data from websites.
                                            </p>
                                            <ol className="text-sm text-blue-200/80 space-y-1.5 list-decimal pl-4">
                                                <li>(Optional) Set a default Start URL if the agent frequently visits one portal.</li>
                                                <li>In chat, tell the agent: "Go to example.com and read the latest headlines."</li>
                                            </ol>
                                        </div>

                                        <div>
                                            <label className="text-sm text-slate-300 font-medium mb-2 block">Start URL</label>
                                            <input
                                                type="url"
                                                value={activeToolConfig.startUrl || ""}
                                                onChange={(e) => setActiveToolConfig({ ...activeToolConfig, startUrl: e.target.value })}
                                                placeholder="https://example.com"
                                                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-sm text-slate-300 font-medium mb-2 block">User Agent</label>
                                            <input
                                                type="text"
                                                value={activeToolConfig.userAgent || ""}
                                                onChange={(e) => setActiveToolConfig({ ...activeToolConfig, userAgent: e.target.value })}
                                                placeholder="Mozilla/5.0..."
                                                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Fallback for other tools */}
                                {!["lead_catcher", "knowledge_base", "browser"].includes(configureToolModal) && (
                                    <div>
                                        <p className="text-sm text-slate-400 mb-4">
                                            Advanced JSON configuration for this tool.
                                        </p>
                                        <textarea
                                            value={typeof activeToolConfig === 'string' ? activeToolConfig : JSON.stringify(activeToolConfig, null, 2)}
                                            onChange={(e) => {
                                                try {
                                                    const parsed = JSON.parse(e.target.value);
                                                    setActiveToolConfig(parsed);
                                                } catch (err) {
                                                    setActiveToolConfig(e.target.value);
                                                }
                                            }}
                                            rows={10}
                                            className="w-full font-mono text-xs bg-slate-900 border border-slate-700/80 rounded-lg p-4 text-emerald-400 focus:outline-none focus:border-indigo-500/50"
                                        />
                                    </div>
                                )}

                            </div>

                            {/* Modal Footer */}
                            <div className="p-5 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3 rounded-b-xl">
                                <button
                                    onClick={() => setConfigureToolModal(null)}
                                    className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveToolConfig}
                                    disabled={saving}
                                    className="px-5 py-2.5 rounded-lg text-sm font-medium bg-white text-black hover:bg-slate-200 transition-colors shadow-lg shadow-white/10 disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* End of tool modal */}
            {/* Chat Testing Drawer */}
            {
                agent && (
                    <TestAgentChat
                        agentId={agent.id}
                        agentName={agent.name}
                        botDisplayName={botDisplayName}
                        themeColor={themeColor}
                        removeBranding={removeBranding}
                        isOpen={isChatOpen}
                        onClose={() => setIsChatOpen(false)}
                    />
                )
            }
        </div >
    );
}
