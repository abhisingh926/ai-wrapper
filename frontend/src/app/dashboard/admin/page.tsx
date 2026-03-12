"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";

const AI_PROVIDERS = [
    { slug: "openai", name: "OpenAI", icon: "🤖", desc: "GPT-4, GPT-3.5, DALL·E", placeholder: "sk-proj-..." },
    { slug: "anthropic", name: "Anthropic", icon: "🧠", desc: "Claude 3.5, Claude 3", placeholder: "sk-ant-..." },
    { slug: "gemini", name: "Google Gemini", icon: "✨", desc: "Gemini Pro, Gemini Ultra", placeholder: "AIza..." },
];

const NOTIFICATION_CHANNELS = [
    { slug: "whatsapp", name: "WhatsApp", icon: "💬", desc: "WhatsApp API Token", placeholder: "EAAL8..." },
    { slug: "telegram", name: "Telegram", icon: "✈️", desc: "Telegram Bot Token", placeholder: "123456:ABC-DEF..." },
    { slug: "gmail", name: "Email (Resend/SMTP)", icon: "📧", desc: "Email API Key", placeholder: "re_..." },
];

const ALL_FILE_TYPES = [
    { ext: ".pdf", label: "PDF", icon: "📄" },
    { ext: ".txt", label: "Text", icon: "📝" },
    { ext: ".csv", label: "CSV", icon: "📊" },
    { ext: ".docx", label: "Word", icon: "📋" },
    { ext: ".md", label: "Markdown", icon: "📑" },
];

const PLANS = ["free", "starter", "growth", "business"];

function SettingsTab() {
    const [maxPages, setMaxPages] = useState(10);
    const [maxContentKb, setMaxContentKb] = useState(200);
    const [allowedTypes, setAllowedTypes] = useState<string[]>([".pdf", ".txt"]);
    const [maxUploadMb, setMaxUploadMb] = useState(10);
    const [scrapingByPlan, setScrapingByPlan] = useState<Record<string, boolean>>({ free: false, starter: true, growth: true, business: true });
    const [showAutonomousSkills, setShowAutonomousSkills] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        adminApi.getSettings().then((res) => {
            const d = res.data;
            setMaxPages(d.max_scrape_pages || 10);
            setMaxContentKb(d.max_content_size_kb || 200);
            setAllowedTypes(d.allowed_file_types || [".pdf", ".txt"]);
            setMaxUploadMb(d.max_upload_size_mb || 10);
            setScrapingByPlan(d.url_scraping_by_plan || { free: false, starter: true, growth: true, business: true });
            setShowAutonomousSkills(d.show_autonomous_skills_section !== false);
            setLoaded(true);
        }).catch(() => setLoaded(true));
    }, []);

    const toggleFileType = (ext: string) => {
        setAllowedTypes((prev) =>
            prev.includes(ext) ? prev.filter((t) => t !== ext) : [...prev, ext]
        );
    };

    const togglePlan = (plan: string) => {
        setScrapingByPlan((prev) => ({ ...prev, [plan]: !prev[plan] }));
    };

    const handleSave = async () => {
        setSaving(true);
        setMsg("");
        try {
            await adminApi.updateSettings({
                max_scrape_pages: maxPages,
                max_content_size_kb: maxContentKb,
                allowed_file_types: allowedTypes,
                max_upload_size_mb: maxUploadMb,
                url_scraping_by_plan: scrapingByPlan,
                show_autonomous_skills_section: showAutonomousSkills,
            });
            setMsg("Settings saved!");
            setTimeout(() => setMsg(""), 3000);
        } catch (err: any) {
            setMsg("Error: " + (err.response?.data?.detail || "Failed to save"));
        } finally {
            setSaving(false);
        }
    };

    if (!loaded) return <div className="text-slate-400 py-12 text-center">Loading settings...</div>;

    return (
        <div className="space-y-6">
            {/* ── Section 1: URL Scraping ── */}
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-1">🌐 URL Scraping</h3>
                <p className="text-sm text-slate-400 mb-6">Control how the scraper crawls websites when users add URLs to their knowledge base.</p>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Max Pages */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-medium text-slate-300">Max Pages to Scrape</label>
                            <div className="flex items-center gap-2">
                                <input type="number" min={1} max={500} value={maxPages}
                                    onChange={(e) => setMaxPages(Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))}
                                    className="w-20 bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white text-center focus:outline-none focus:border-indigo-500"
                                />
                                <span className="text-xs text-slate-500">pages</span>
                            </div>
                        </div>
                        <input type="range" min={1} max={100} value={Math.min(maxPages, 100)}
                            onChange={(e) => setMaxPages(parseInt(e.target.value))}
                            className="w-full accent-indigo-500"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>1</span><span>50</span><span>100+</span>
                        </div>
                    </div>

                    {/* Max Content Size */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-medium text-slate-300">Max Content Size</label>
                            <div className="flex items-center gap-2">
                                <input type="number" min={50} max={1000} value={maxContentKb}
                                    onChange={(e) => setMaxContentKb(Math.min(1000, Math.max(50, parseInt(e.target.value) || 50)))}
                                    className="w-20 bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white text-center focus:outline-none focus:border-indigo-500"
                                />
                                <span className="text-xs text-slate-500">KB</span>
                            </div>
                        </div>
                        <input type="range" min={50} max={500} step={50}
                            value={Math.min(maxContentKb, 500)}
                            onChange={(e) => setMaxContentKb(parseInt(e.target.value))}
                            className="w-full accent-indigo-500"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>50 KB</span><span>250 KB</span><span>500 KB</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Section 2: File Uploads ── */}
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-1">📁 File Uploads</h3>
                <p className="text-sm text-slate-400 mb-6">Configure which file types users can upload and the maximum file size.</p>

                <div className="mb-6">
                    <label className="text-sm font-medium text-slate-300 mb-3 block">Allowed File Types</label>
                    <div className="flex flex-wrap gap-3">
                        {ALL_FILE_TYPES.map((ft) => (
                            <button
                                key={ft.ext}
                                onClick={() => toggleFileType(ft.ext)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${allowedTypes.includes(ft.ext)
                                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                                    : "bg-slate-900/50 text-slate-500 border-slate-700 hover:border-slate-600"
                                    }`}
                            >
                                <span>{ft.icon}</span>
                                <span>{ft.label}</span>
                                <span className="text-xs opacity-60">{ft.ext}</span>
                                {allowedTypes.includes(ft.ext) && <span className="text-emerald-400">✓</span>}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-slate-300">Max Upload Size</label>
                        <div className="flex items-center gap-2">
                            <input type="number" min={1} max={100} value={maxUploadMb}
                                onChange={(e) => setMaxUploadMb(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                                className="w-20 bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white text-center focus:outline-none focus:border-indigo-500"
                            />
                            <span className="text-xs text-slate-500">MB</span>
                        </div>
                    </div>
                    <input type="range" min={1} max={50} value={Math.min(maxUploadMb, 50)}
                        onChange={(e) => setMaxUploadMb(parseInt(e.target.value))}
                        className="w-full accent-indigo-500"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>1 MB</span><span>25 MB</span><span>50 MB</span>
                    </div>
                </div>
            </div>

            {/* ── Section 3: URL Scraping by Plan ── */}
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-1">🔐 URL Scraping Access by Plan</h3>
                <p className="text-sm text-slate-400 mb-6">Control which subscription plans can use URL scraping in their knowledge base.</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {PLANS.map((plan) => (
                        <button
                            key={plan}
                            onClick={() => togglePlan(plan)}
                            className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${scrapingByPlan[plan]
                                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                                : "bg-slate-900/50 border-slate-700 text-slate-500 hover:border-slate-600"
                                }`}
                        >
                            <span className="text-2xl">{scrapingByPlan[plan] ? "✅" : "🚫"}</span>
                            <span className="text-sm font-medium capitalize">{plan}</span>
                            <span className="text-xs opacity-70">
                                {scrapingByPlan[plan] ? "Enabled" : "Disabled"}
                            </span>
                        </button>
                    ))}
                </div>
                <p className="text-xs text-slate-500 mt-3">
                    💡 Users on disabled plans will see an upgrade prompt when they try to scrape a URL.
                </p>
            </div>

            {/* ── Section 4: Landing Page Sections ── */}
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-1">🌐 Landing Page Sections</h3>
                <p className="text-sm text-slate-400 mb-6">Toggle visibility of sections on the public landing page.</p>

                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">⚡</span>
                        <div>
                            <div className="text-sm font-medium text-white">Agents That Work While You Sleep</div>
                            <div className="text-xs text-slate-500">Autonomous skills section with skill cards and execution flow diagram</div>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAutonomousSkills(!showAutonomousSkills)}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${showAutonomousSkills ? "bg-emerald-500" : "bg-slate-600"}`}
                    >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${showAutonomousSkills ? "translate-x-6" : "translate-x-0"}`} />
                    </button>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                    {showAutonomousSkills ? "✅ Section is visible on the landing page" : "🚫 Section is hidden from the landing page"}
                </p>
            </div>

            {/* ── Save Button ── */}
            <div className="flex items-center gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                    {saving ? "Saving..." : "💾 Save All Settings"}
                </button>
                {msg && (
                    <span className={`text-sm ${msg.startsWith("Error") ? "text-red-400" : "text-emerald-400"}`}>
                        {msg}
                    </span>
                )}
            </div>
        </div>
    );
}

export default function AdminPage() {
    const [tab, setTab] = useState<"analytics" | "users" | "api-keys" | "usage" | "pricing" | "tools" | "channels" | "models" | "skills" | "settings">("analytics");
    const [analytics, setAnalytics] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [totalUsers, setTotalUsers] = useState(0);

    // API Keys state
    const [globalKeys, setGlobalKeys] = useState<any[]>([]);
    const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [keyMsg, setKeyMsg] = useState<{ slug: string; type: string; text: string } | null>(null);

    // WhatsApp QR State
    const [adminWaQrImage, setAdminWaQrImage] = useState<string | null>(null);
    const [adminWaStatus, setAdminWaStatus] = useState<string>("");

    // Usage state
    const [usageData, setUsageData] = useState<any[]>([]);
    const [usageLoading, setUsageLoading] = useState(false);

    // Pricing state
    const [pricing, setPricing] = useState<Record<string, any>>({});
    const [pricingLoading, setPricingLoading] = useState(false);
    const [savingPlan, setSavingPlan] = useState<string | null>(null);
    const [pricingMsg, setPricingMsg] = useState<{ plan: string; type: string; text: string } | null>(null);

    // Tools state
    const [adminTools, setAdminTools] = useState<any[]>([]);
    const [showKBConfig, setShowKBConfig] = useState(false);
    const [showWeatherConfig, setShowWeatherConfig] = useState(false);
    const [weatherApiKey, setWeatherApiKey] = useState("");
    const [weatherConfigSaving, setWeatherConfigSaving] = useState(false);
    const [weatherConfigMsg, setWeatherConfigMsg] = useState<{ type: string; text: string } | null>(null);
    const [weatherToolId, setWeatherToolId] = useState<string | null>(null);
    const [showCalendarConfig, setShowCalendarConfig] = useState(false);
    const [calendarOAuthClientId, setCalendarOAuthClientId] = useState("");
    const [calendarOAuthSecret, setCalendarOAuthSecret] = useState("");
    const [calendarConfigSaving, setCalendarConfigSaving] = useState(false);
    const [calendarConfigMsg, setCalendarConfigMsg] = useState<{ type: string; text: string } | null>(null);
    const [calendarToolId, setCalendarToolId] = useState<string | null>(null);
    const [toolsLoading, setToolsLoading] = useState(false);
    const [showAddTool, setShowAddTool] = useState(false);
    const [newTool, setNewTool] = useState({ slug: "", name: "", icon: "🔧", description: "", category: "general", badge: "stable" });

    // Channels state
    const [adminChannels, setAdminChannels] = useState<any[]>([]);
    const [channelsLoading, setChannelsLoading] = useState(false);
    const [showAddChannel, setShowAddChannel] = useState(false);
    const [newChannel, setNewChannel] = useState({ slug: "", name: "", icon: "📱", description: "", badge: "stable", is_upcoming: false });

    // Skills state
    const [adminSkills, setAdminSkills] = useState<any[]>([]);
    const [skillsLoading, setSkillsLoading] = useState(false);
    const [showAddSkill, setShowAddSkill] = useState(false);
    const [newSkill, setNewSkill] = useState({ slug: "", name: "", icon: "🔧", description: "", schedule: "Daily", tags: [] as string[], gradient: "from-emerald-500/20 to-teal-500/10", icon_bg: "from-emerald-500 to-teal-400" });
    const [skillTagInput, setSkillTagInput] = useState("");

    // Models config state
    const [modelsConfig, setModelsConfig] = useState<any>(null);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [modelsSaving, setModelsSaving] = useState(false);
    const [modelsMsg, setModelsMsg] = useState<{ type: string; text: string } | null>(null);

    useEffect(() => {
        loadAnalytics();
        loadUsers();
    }, []);

    useEffect(() => {
        if (tab === "api-keys") loadGlobalKeys();
        if (tab === "usage") loadUsage();
        if (tab === "pricing") loadPricing();
        if (tab === "tools") loadAdminTools();
        if (tab === "channels") loadAdminChannels();
        if (tab === "models") loadModelsConfig();
        if (tab === "skills") loadAdminSkills();
    }, [tab]);

    const loadAnalytics = async () => {
        try {
            const res = await adminApi.analytics();
            setAnalytics(res.data);
        } catch { }
    };

    const loadUsers = async (searchQuery?: string) => {
        try {
            const res = await adminApi.users({ search: searchQuery, limit: 50 });
            setUsers(res.data.users);
            setTotalUsers(res.data.total);
        } catch { }
    };

    const loadGlobalKeys = async () => {
        try {
            const res = await adminApi.getApiKeys();
            setGlobalKeys(res.data);
        } catch { }
    };

    const loadUsage = async () => {
        setUsageLoading(true);
        try {
            const res = await adminApi.usage();
            setUsageData(res.data);
        } catch { }
        setUsageLoading(false);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        loadUsers(search);
    };

    const handleBlock = async (userId: string) => {
        const user = users.find(u => u.id === userId);
        const action = user?.email_verified ? "block" : "unblock";
        if (action === "block" && !confirm(`Are you sure you want to block this user? They will not be able to login.`)) return;
        await adminApi.blockUser(userId);
        loadUsers(search);
    };

    const handleResetQuota = async (userId: string) => {
        await adminApi.resetQuota(userId);
        loadUsers(search);
    };

    const handleChangeRole = async (userId: string, newRole: string) => {
        if (newRole === "admin" && !confirm("Grant admin access to this user? They will have full platform control.")) return;
        try {
            await adminApi.changeRole(userId, newRole);
            loadUsers(search);
        } catch (err: any) {
            alert(err?.response?.data?.detail || "Failed to change role");
        }
    };

    const handleSaveKey = async (slug: string, overrideKey?: string) => {
        const key = overrideKey !== undefined ? overrideKey : keyInputs[slug];
        if (!key?.trim()) return;
        setSavingKey(slug);
        setKeyMsg(null);
        try {
            await adminApi.saveApiKey(slug, key.trim());
            setKeyInputs({ ...keyInputs, [slug]: "" });
            setKeyMsg({ slug, type: "success", text: "Saved!" });
            loadGlobalKeys();
        } catch {
            setKeyMsg({ slug, type: "error", text: "Failed to save." });
        }
        setSavingKey(null);
        setTimeout(() => setKeyMsg(null), 3000);
    };

    const handleConnectGlobalWhatsApp = () => {
        setAdminWaQrImage(null);
        setAdminWaStatus("Connecting to WhatsApp Bridge...");

        const agentId = "global_admin_whatsapp";
        const bridgeUrl = process.env.NEXT_PUBLIC_WA_BRIDGE_URL || "http://localhost:3001";
        const eventSource = new EventSource(`${bridgeUrl}/wa/qr/${agentId}`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'qr') {
                    setAdminWaQrImage(data.data);
                    setAdminWaStatus("Scan QR Code to link WhatsApp");
                } else if (data.type === 'status') {
                    setAdminWaStatus(data.message);
                } else if (data.type === 'connected') {
                    setAdminWaQrImage(null);
                    setAdminWaStatus(data.message);
                    eventSource.close();

                    // Save to backend so we know it's connected
                    handleSaveKey("whatsapp", "connected_via_qr");
                } else if (data.type === 'error') {
                    setAdminWaStatus("Error: " + data.message);
                    eventSource.close();
                }
            } catch (e) {
                console.error("Failed to parse SSE message", e);
            }
        };

        eventSource.onerror = (err) => {
            setAdminWaStatus("Failed to connect to bridge server.");
            eventSource.close();
        };
    };

    const handleDeleteKey = async (slug: string) => {
        if (!confirm("Remove this API key? Workflows using this provider will stop working.")) return;
        try {
            if (slug === 'whatsapp') {
                setAdminWaStatus("");
                setAdminWaQrImage(null);
                try {
                    const bridgeUrl = process.env.NEXT_PUBLIC_WA_BRIDGE_URL || "http://localhost:3001";
                    await fetch(`${bridgeUrl}/wa/logout/global_admin_whatsapp`, { method: "POST" });
                } catch (e) {
                    console.error("Failed to disconnect from bridge", e);
                }
            }
            await adminApi.deleteApiKey(slug);
            setKeyMsg({ slug, type: "success", text: "Removed." });
            loadGlobalKeys();
        } catch {
            setKeyMsg({ slug, type: "error", text: "Failed to remove." });
        }
    };

    // Pricing loading
    const loadPricing = async () => {
        setPricingLoading(true);
        try {
            const res = await adminApi.getPricing();
            setPricing(res.data);
        } catch { }
        setPricingLoading(false);
    };

    const handleSavePlan = async (planKey: string) => {
        setSavingPlan(planKey);
        setPricingMsg(null);
        try {
            await adminApi.updatePricing(planKey, pricing[planKey]);
            setPricingMsg({ plan: planKey, type: "success", text: "Saved!" });
        } catch {
            setPricingMsg({ plan: planKey, type: "error", text: "Failed to save." });
        }
        setSavingPlan(null);
    };

    const updatePlanField = (planKey: string, field: string, value: any) => {
        setPricing((prev: Record<string, any>) => ({
            ...prev,
            [planKey]: { ...prev[planKey], [field]: value },
        }));
    };

    const updatePlanFeature = (planKey: string, idx: number, value: string) => {
        const features = [...pricing[planKey].features];
        features[idx] = value;
        updatePlanField(planKey, "features", features);
    };

    const addPlanFeature = (planKey: string) => {
        const features = [...pricing[planKey].features, ""];
        updatePlanField(planKey, "features", features);
    };

    const removePlanFeature = (planKey: string, idx: number) => {
        const features = pricing[planKey].features.filter((_: string, i: number) => i !== idx);
        updatePlanField(planKey, "features", features);
    };

    // ─── Tools Management ───
    const loadAdminTools = async () => {
        setToolsLoading(true);
        try {
            const res = await adminApi.getTools();
            setAdminTools(res.data);
        } catch { }
        setToolsLoading(false);
    };

    const handleToggleToolField = async (toolId: string, field: string, value: boolean) => {
        try {
            await adminApi.updateTool(toolId, { [field]: value });
            loadAdminTools();
        } catch { }
    };

    const handleAddTool = async () => {
        if (!newTool.slug || !newTool.name) return;
        try {
            await adminApi.createTool(newTool);
            setNewTool({ slug: "", name: "", icon: "🔧", description: "", category: "general", badge: "stable" });
            setShowAddTool(false);
            loadAdminTools();
        } catch { }
    };

    const handleDeleteTool = async (toolId: string) => {
        if (!confirm("Delete this tool?")) return;
        try {
            await adminApi.deleteTool(toolId);
            loadAdminTools();
        } catch { }
    };

    // ─── Channels Management ───
    const loadAdminChannels = async () => {
        setChannelsLoading(true);
        try {
            const res = await adminApi.channels();
            setAdminChannels(res.data);
        } catch { }
        setChannelsLoading(false);
    };

    const handleToggleChannelField = async (channelId: string, field: string, value: any) => {
        try {
            await adminApi.updateChannel(channelId, { [field]: value });
            loadAdminChannels();
        } catch { }
    };

    const handleAddChannel = async () => {
        if (!newChannel.slug || !newChannel.name) return;
        try {
            await adminApi.createChannel(newChannel);
            setNewChannel({ slug: "", name: "", icon: "📱", description: "", badge: "stable", is_upcoming: false });
            setShowAddChannel(false);
            loadAdminChannels();
        } catch { }
    };

    const handleDeleteChannel = async (channelId: string) => {
        if (!confirm("Delete this channel?")) return;
        try {
            await adminApi.deleteChannel(channelId);
            loadAdminChannels();
        } catch { }
    };

    // ─── Skills Management ───
    const loadAdminSkills = async () => {
        setSkillsLoading(true);
        try {
            const res = await adminApi.getSkills();
            setAdminSkills(res.data);
        } catch { }
        setSkillsLoading(false);
    };

    const handleToggleSkillEnabled = async (skillId: string, enabled: boolean) => {
        try {
            await adminApi.updateSkill(skillId, { enabled });
            loadAdminSkills();
        } catch { }
    };

    const handleAddSkill = async () => {
        if (!newSkill.slug || !newSkill.name) return;
        try {
            await adminApi.createSkill(newSkill);
            setNewSkill({ slug: "", name: "", icon: "🔧", description: "", schedule: "Daily", tags: [], gradient: "from-emerald-500/20 to-teal-500/10", icon_bg: "from-emerald-500 to-teal-400" });
            setShowAddSkill(false);
            loadAdminSkills();
        } catch { }
    };

    const handleDeleteSkill = async (skillId: string) => {
        if (!confirm("Delete this skill?")) return;
        try {
            await adminApi.deleteSkill(skillId);
            loadAdminSkills();
        } catch { }
    };

    const handleSeedSkills = async () => {
        try {
            await adminApi.seedSkills();
            loadAdminSkills();
        } catch { }
    };

    // ─── Models Config Management ───
    const loadModelsConfig = async () => {
        setModelsLoading(true);
        try {
            const res = await adminApi.getModels();
            setModelsConfig(res.data);
        } catch { }
        setModelsLoading(false);
    };

    const handleToggleModelPlan = (providerIdx: number, modelIdx: number, plan: string) => {
        setModelsConfig((prev: any) => {
            const updated = JSON.parse(JSON.stringify(prev));
            const model = updated.providers[providerIdx].models[modelIdx];
            if (model.plans.includes(plan)) {
                model.plans = model.plans.filter((p: string) => p !== plan);
            } else {
                model.plans.push(plan);
            }
            return updated;
        });
    };

    const handleSaveModels = async () => {
        setModelsSaving(true);
        setModelsMsg(null);
        try {
            await adminApi.updateModels(modelsConfig);
            setModelsMsg({ type: "success", text: "Model access configuration saved!" });
        } catch {
            setModelsMsg({ type: "error", text: "Failed to save." });
        }
        setModelsSaving(false);
        setTimeout(() => setModelsMsg(null), 3000);
    };

    const handleQuickAction = (action: string) => {
        setModelsConfig((prev: any) => {
            const updated = JSON.parse(JSON.stringify(prev));
            updated.providers.forEach((provider: any) => {
                provider.models.forEach((model: any) => {
                    if (action === "allow-all-free") {
                        if (!model.plans.includes("free")) model.plans.push("free");
                    } else if (action === "restrict-premium") {
                        if (model.cost_tier >= 3) {
                            model.plans = model.plans.filter((p: string) => p === "business");
                        }
                    } else if (action === "reset") {
                        if (model.cost_tier === 1) {
                            model.plans = ["free", "starter", "growth", "business"];
                        } else if (model.cost_tier === 2) {
                            model.plans = ["starter", "growth", "business"];
                        } else {
                            model.plans = ["growth", "business"];
                        }
                    }
                });
            });
            return updated;
        });
    };

    const handleSeedChannels = async () => {
        try {
            await adminApi.seedChannels();
            loadAdminChannels();
        } catch { }
    };

    const tabs = [
        { key: "analytics", label: "📊 Analytics" },
        { key: "api-keys", label: "🔑 API Keys" },
        { key: "models", label: "🧠 AI Models" },
        { key: "tools", label: "🔧 Tools" },
        { key: "channels", label: "📱 Channels" },
        { key: "skills", label: "⚡ Skills" },
        { key: "pricing", label: "💰 Pricing" },
        { key: "usage", label: "📈 Usage" },
        { key: "users", label: "👥 Users" },
        { key: "settings", label: "⚙️ Settings" },
    ];

    const connectedKeyMap = new Map(globalKeys.map((k: any) => [k.slug, k]));

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
                <p className="text-slate-400">Platform management, API keys, and user analytics.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-8">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key as any)}
                        className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === t.key
                            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                            : "text-slate-400 bg-slate-800/50 hover:text-white"
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ═══ Analytics Tab ═══ */}
            {tab === "analytics" && analytics && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: "Total Users", value: analytics.total_users, icon: "👥", color: "from-indigo-500/20 to-indigo-600/20" },
                        { label: "Paid Subscribers", value: analytics.active_subscriptions, icon: "💎", color: "from-cyan-500/20 to-cyan-600/20" },
                        { label: "Est. MRR", value: `$${analytics.estimated_mrr}`, icon: "💰", color: "from-green-500/20 to-green-600/20" },
                        { label: "Total Executions", value: analytics.total_executions, icon: "⚡", color: "from-amber-500/20 to-amber-600/20" },
                    ].map((card) => (
                        <div key={card.label} className={`bg-gradient-to-br ${card.color} rounded-2xl p-6 border border-white/5`}>
                            <span className="text-2xl">{card.icon}</span>
                            <div className="text-2xl font-bold text-white mt-3">{card.value}</div>
                            <div className="text-sm text-slate-400 mt-1">{card.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ═══ API Keys Tab ═══ */}
            {tab === "api-keys" && (
                <div className="max-w-3xl space-y-4">
                    {/* Info banner */}
                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 mb-6">
                        <div className="flex items-start gap-3">
                            <span className="text-lg mt-0.5">⚠️</span>
                            <div>
                                <p className="text-sm font-medium text-amber-300">Platform-wide API Keys</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    These keys are used by the platform for all subscribed users. Keep them secure and monitor usage closely.
                                </p>
                            </div>
                        </div>
                    </div>

                    {AI_PROVIDERS.map((provider) => {
                        const existing = connectedKeyMap.get(provider.slug);
                        const msg = keyMsg?.slug === provider.slug ? keyMsg : null;

                        return (
                            <div key={provider.slug} className="glass rounded-2xl overflow-hidden">
                                <div className="p-6 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="text-3xl">{provider.icon}</div>
                                        <div>
                                            <h3 className="text-base font-semibold text-white">{provider.name}</h3>
                                            <p className="text-xs text-slate-400">{provider.desc}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {existing ? (
                                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                                Active
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-600/30 text-slate-400">
                                                Not configured
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="px-6 pb-6 border-t border-slate-700/30 pt-4">
                                    {existing && (
                                        <div className="flex items-center justify-between mb-3 p-3 rounded-lg bg-slate-800/30">
                                            <div>
                                                <span className="text-xs text-slate-500">Current key: </span>
                                                <code className="text-xs text-indigo-300 font-mono">{existing.masked_key}</code>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteKey(provider.slug)}
                                                className="text-xs text-red-400/70 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex gap-3">
                                        <input
                                            type="password"
                                            value={keyInputs[provider.slug] || ""}
                                            onChange={(e) => setKeyInputs({ ...keyInputs, [provider.slug]: e.target.value })}
                                            className="flex-1 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-white
                                                placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-sm"
                                            placeholder={existing ? "Enter new key to update..." : provider.placeholder}
                                        />
                                        <button
                                            onClick={() => handleSaveKey(provider.slug)}
                                            disabled={savingKey === provider.slug || !keyInputs[provider.slug]?.trim()}
                                            className="btn-primary text-sm !py-3 !px-6 disabled:opacity-50 shrink-0"
                                        >
                                            {savingKey === provider.slug ? "Saving..." : existing ? "Update" : "Save"}
                                        </button>
                                    </div>
                                    {msg && (
                                        <p className={`mt-2 text-xs ${msg.type === "success" ? "text-green-400" : "text-red-400"}`}>
                                            {msg.text}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    <div className="pt-8 mb-2">
                        <h3 className="text-lg font-bold text-white">Notification Delivery Channels</h3>
                        <p className="text-sm text-slate-400">Configure API tokens for sending alerts and messages natively via the platform.</p>
                    </div>

                    {NOTIFICATION_CHANNELS.map((provider) => {
                        const existing = connectedKeyMap.get(provider.slug);
                        const msg = keyMsg?.slug === provider.slug ? keyMsg : null;

                        return (
                            <div key={provider.slug} className="glass rounded-2xl overflow-hidden mt-4">
                                <div className="p-6 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="text-3xl">{provider.icon}</div>
                                        <div>
                                            <h3 className="text-base font-semibold text-white">{provider.name}</h3>
                                            <p className="text-xs text-slate-400">{provider.desc}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {existing ? (
                                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                                Active
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-600/30 text-slate-400">
                                                Not configured
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="px-6 pb-6 border-t border-slate-700/30 pt-4">
                                    {existing && (
                                        <div className="flex items-center justify-between mb-3 p-3 rounded-lg bg-slate-800/30">
                                            <div>
                                                <span className="text-xs text-slate-500">Current key: </span>
                                                <code className="text-xs text-indigo-300 font-mono">{provider.slug === 'whatsapp' ? 'Connected via Bridge' : existing.masked_key}</code>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteKey(provider.slug)}
                                                className="text-xs text-red-400/70 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )}

                                    {provider.slug === 'whatsapp' && !existing ? (
                                        <div className="flex flex-col gap-3">
                                            {adminWaQrImage ? (
                                                <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl mx-auto w-fit">
                                                    <img src={adminWaQrImage} alt="WhatsApp QR Code" className="w-48 h-48 rounded-lg" />
                                                    <p className="text-xs text-slate-500 font-medium">{adminWaStatus}</p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-3 mt-1">
                                                    {adminWaStatus && <p className="text-sm text-indigo-400 text-center">{adminWaStatus}</p>}
                                                    <button
                                                        onClick={handleConnectGlobalWhatsApp}
                                                        className="btn-primary text-sm !py-3 w-full border border-indigo-500/30 hover:border-indigo-400/50"
                                                    >
                                                        📱 Generate Connection QR Code
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : !existing ? (
                                        <div className="flex gap-3">
                                            <input
                                                type="password"
                                                value={keyInputs[provider.slug] || ""}
                                                onChange={(e) => setKeyInputs({ ...keyInputs, [provider.slug]: e.target.value })}
                                                className="flex-1 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-white
                                                    placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-sm"
                                                placeholder={provider.placeholder}
                                            />
                                            <button
                                                onClick={() => handleSaveKey(provider.slug)}
                                                disabled={savingKey === provider.slug || !keyInputs[provider.slug]?.trim()}
                                                className="btn-primary text-sm !py-3 !px-6 disabled:opacity-50 shrink-0"
                                            >
                                                {savingKey === provider.slug ? "Saving..." : "Save"}
                                            </button>
                                        </div>
                                    ) : null}
                                    {msg && (
                                        <p className={`mt-2 text-xs ${msg.type === "success" ? "text-green-400" : "text-red-400"}`}>
                                            {msg.text}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ═══ Usage Tab ═══ */}
            {tab === "usage" && (
                <div>
                    <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm text-slate-400">
                            {usageLoading ? "Loading..." : `${usageData.length} users`}
                        </p>
                        <button onClick={loadUsage} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                            ↻ Refresh
                        </button>
                    </div>

                    <div className="glass rounded-2xl overflow-hidden overflow-x-auto">
                        <table className="w-full min-w-[800px]">
                            <thead>
                                <tr className="border-b border-slate-700/50">
                                    <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase">User</th>
                                    <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase">Plan</th>
                                    <th className="text-center px-5 py-4 text-xs font-semibold text-slate-400 uppercase">Workflows</th>
                                    <th className="text-center px-5 py-4 text-xs font-semibold text-slate-400 uppercase">Executions</th>
                                    <th className="text-center px-5 py-4 text-xs font-semibold text-slate-400 uppercase">Runs Used</th>
                                    <th className="text-center px-5 py-4 text-xs font-semibold text-slate-400 uppercase">Integrations</th>
                                    <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase">Joined</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usageData.map((u: any) => {
                                    const usagePercent = u.run_limit > 0 ? Math.round((u.runs_used / u.run_limit) * 100) : 0;
                                    return (
                                        <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                                            <td className="px-5 py-4">
                                                <div className="text-sm text-white font-medium">{u.name}</div>
                                                <div className="text-xs text-slate-500">{u.email}</div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${u.plan === "pro" ? "bg-indigo-500/10 text-indigo-400" :
                                                    u.plan === "business" ? "bg-amber-500/10 text-amber-400" :
                                                        "bg-slate-600/30 text-slate-400"
                                                    }`}>
                                                    {u.plan}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-center text-sm text-white">{u.workflows}</td>
                                            <td className="px-5 py-4 text-center text-sm text-white font-medium">{u.executions}</td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <span className="text-xs text-slate-300">
                                                        {u.runs_used} / {u.run_limit || "∞"}
                                                    </span>
                                                    {u.run_limit > 0 && (
                                                        <div className="w-16 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all ${usagePercent > 80 ? "bg-red-500" :
                                                                    usagePercent > 50 ? "bg-amber-500" : "bg-green-500"
                                                                    }`}
                                                                style={{ width: `${Math.min(usagePercent, 100)}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center text-sm text-slate-400">{u.connected_integrations}</td>
                                            <td className="px-5 py-4 text-xs text-slate-500">
                                                {u.joined ? new Date(u.joined).toLocaleDateString() : "—"}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {usageData.length === 0 && !usageLoading && (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                                            No users found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══ Users Tab ═══ */}
            {tab === "users" && (
                <div>
                    <form onSubmit={handleSearch} className="flex gap-3 mb-6">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-white
                placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                            placeholder="Search by name or email..."
                        />
                        <button type="submit" className="btn-primary text-sm">Search</button>
                    </form>

                    <div className="text-sm text-slate-400 mb-4">{totalUsers} total users</div>

                    <div className="glass rounded-2xl overflow-hidden overflow-x-auto">
                        <table className="w-full min-w-[900px]">
                            <thead>
                                <tr className="border-b border-slate-700/50">
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase">User</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase">Role</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase">Status</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase">Joined</th>
                                    <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => {
                                    const isBlocked = !u.email_verified;
                                    return (
                                        <tr key={u.id} className={`border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors ${isBlocked ? "opacity-70" : ""}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${u.role === "admin" ? "bg-purple-500/20 text-purple-400" : "bg-indigo-500/20 text-indigo-400"}`}>
                                                        {u.name?.charAt(0)?.toUpperCase() || "?"}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm text-white font-medium">{u.name}</div>
                                                        <div className="text-xs text-slate-500">{u.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <select
                                                    value={u.role}
                                                    onChange={(e) => handleChangeRole(u.id, e.target.value)}
                                                    className={`text-xs px-3 py-1.5 rounded-lg font-medium border focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer ${u.role === "admin"
                                                        ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                                                        : "bg-slate-800/50 text-slate-300 border-slate-600/50"
                                                        }`}
                                                >
                                                    <option value="user">👤 User</option>
                                                    <option value="admin">👑 Admin</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${isBlocked
                                                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                                    : "bg-green-500/10 text-green-400 border border-green-500/20"
                                                    }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${isBlocked ? "bg-red-400" : "bg-green-400 animate-pulse"}`} />
                                                    {isBlocked ? "Blocked" : "Active"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500">
                                                {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleBlock(u.id)}
                                                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${isBlocked
                                                            ? "bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20"
                                                            : "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                                                            }`}
                                                    >
                                                        {isBlocked ? "✓ Unblock" : "🚫 Block"}
                                                    </button>
                                                    <button
                                                        onClick={() => handleResetQuota(u.id)}
                                                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
                                                    >
                                                        ↻ Reset Quota
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── PRICING TAB ── */}
            {tab === "pricing" && (
                <div>
                    <h2 className="text-lg font-semibold text-white mb-1">Plan Pricing & Limits</h2>
                    <p className="text-sm text-slate-400 mb-6">Update pricing, limits, and features for each plan. Changes apply immediately.</p>

                    {pricingLoading ? (
                        <div className="text-center py-12"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
                    ) : (
                        <div className="grid lg:grid-cols-2 gap-6">
                            {["free", "starter", "growth", "business"].map((planKey) => {
                                const plan = pricing[planKey];
                                if (!plan) return null;
                                const colors: Record<string, string> = {
                                    free: "border-slate-600/50",
                                    starter: "border-blue-500/50",
                                    growth: "border-indigo-500/50",
                                    business: "border-amber-500/50",
                                };
                                const icons: Record<string, string> = { free: "🆓", starter: "🚀", growth: "⭐", business: "🏢" };

                                return (
                                    <div key={planKey} className={`glass rounded-2xl p-6 border ${colors[planKey]}`}>
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="text-2xl">{icons[planKey]}</span>
                                            <input
                                                value={plan.name}
                                                onChange={(e) => updatePlanField(planKey, "name", e.target.value)}
                                                className="text-lg font-bold text-white bg-transparent border-b border-transparent hover:border-slate-600 focus:border-indigo-500 focus:outline-none transition-all w-full"
                                            />
                                        </div>

                                        {/* Price */}
                                        <div className="mb-4">
                                            <label className="text-xs text-slate-400 font-medium">Price (₹/month)</label>
                                            <input
                                                type="number"
                                                value={plan.price_monthly}
                                                onChange={(e) => updatePlanField(planKey, "price_monthly", parseFloat(e.target.value) || 0)}
                                                className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white text-xl font-bold focus:outline-none focus:border-indigo-500 transition-all"
                                            />
                                        </div>

                                        {/* Limits */}
                                        <div className="grid grid-cols-2 gap-3 mb-4">
                                            <div>
                                                <label className="text-xs text-slate-400">Agent Limit</label>
                                                <input
                                                    type="number"
                                                    value={plan.agent_limit ?? 1}
                                                    onChange={(e) => updatePlanField(planKey, "agent_limit", parseInt(e.target.value) || 1)}
                                                    className="w-full mt-1 px-2 py-1.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-400">Message Limit / month</label>
                                                <input
                                                    type="number"
                                                    value={plan.message_limit ?? 500}
                                                    onChange={(e) => updatePlanField(planKey, "message_limit", parseInt(e.target.value) || 500)}
                                                    className="w-full mt-1 px-2 py-1.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
                                                />
                                            </div>
                                        </div>

                                        {/* Features */}
                                        <div className="mb-4">
                                            <label className="text-xs text-slate-400 font-medium mb-2 block">Features</label>
                                            <div className="space-y-2">
                                                {plan.features.map((feat: string, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <span className="text-green-400 text-xs">✓</span>
                                                        <input
                                                            value={feat}
                                                            onChange={(e) => updatePlanFeature(planKey, idx, e.target.value)}
                                                            className="flex-1 px-2 py-1 rounded bg-slate-800/50 border border-slate-700/50 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                                                        />
                                                        <button
                                                            onClick={() => removePlanFeature(planKey, idx)}
                                                            className="text-red-400/60 hover:text-red-400 text-xs"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => addPlanFeature(planKey)}
                                                    className="text-xs text-indigo-400 hover:text-indigo-300 mt-1"
                                                >
                                                    + Add feature
                                                </button>
                                            </div>
                                        </div>

                                        {/* Save button */}
                                        <button
                                            onClick={() => handleSavePlan(planKey)}
                                            disabled={savingPlan === planKey}
                                            className="w-full py-2 rounded-xl text-sm font-semibold bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 transition-all disabled:opacity-50"
                                        >
                                            {savingPlan === planKey ? "Saving..." : "Save Changes"}
                                        </button>
                                        {pricingMsg?.plan === planKey && (
                                            <p className={`text-xs mt-2 text-center ${pricingMsg.type === "success" ? "text-green-400" : "text-red-400"}`}>
                                                {pricingMsg.text}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ═══ Tools Tab ═══ */}
            {tab === "tools" && (
                <div className="max-w-6xl mx-auto">
                    {/* Bot Power Level Header */}
                    <div className="bg-slate-900/40 rounded-xl p-6 mb-8 border border-slate-700/50 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        {/* Background subtle gradient */}
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
                                <span>{adminTools.filter(t => t.enabled).length} Tools Connected</span>
                            </div>
                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${Math.min(100, (adminTools.filter(t => t.enabled).length / Math.max(1, adminTools.length)) * 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold text-white">Available Tools</h3>
                        <button
                            onClick={() => setShowAddTool(!showAddTool)}
                            className="text-sm font-medium px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
                        >
                            + Add Custom Tool
                        </button>
                    </div>

                    {/* Add Tool Form */}
                    {showAddTool && (
                        <div className="bg-slate-900/60 rounded-xl p-6 mb-8 border border-slate-700/50">
                            <h3 className="text-sm font-semibold text-white mb-4">Create New Tool Integration</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-5">
                                <input value={newTool.slug} onChange={(e) => setNewTool({ ...newTool, slug: e.target.value })} placeholder="slug (e.g. search)" className="px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/50" />
                                <input value={newTool.name} onChange={(e) => setNewTool({ ...newTool, name: e.target.value })} placeholder="Name" className="px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/50" />
                                <input value={newTool.icon} onChange={(e) => setNewTool({ ...newTool, icon: e.target.value })} placeholder="Icon (emoji)" className="px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/50" />
                                <input value={newTool.description} onChange={(e) => setNewTool({ ...newTool, description: e.target.value })} placeholder="Short description" className="px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/50 lg:col-span-2" />
                                <select value={newTool.badge} onChange={(e) => setNewTool({ ...newTool, badge: e.target.value })} className="px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/50">
                                    <option value="stable">STABLE</option>
                                    <option value="beta">BETA</option>
                                    <option value="alpha">ALPHA</option>
                                    <option value="coming_soon">COMING SOON</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setShowAddTool(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
                                <button onClick={handleAddTool} className="px-5 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20">Save Integration</button>
                            </div>
                        </div>
                    )}

                    {/* Tools Grid */}
                    {toolsLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {adminTools.map((t) => {
                                // Determine styling based on badge
                                let badgeStyles = "bg-slate-800/80 text-slate-400";
                                let badgeLabel = t.badge?.replace("_", " ") || "STABLE";

                                if (t.badge === "stable") badgeStyles = "bg-emerald-500/10 text-emerald-500";
                                else if (t.badge === "beta") badgeStyles = "bg-blue-500/10 text-blue-400";
                                else if (t.badge === "alpha") badgeStyles = "bg-amber-500/10 text-amber-500";
                                else if (t.badge === "coming_soon") badgeStyles = "bg-orange-500/10 text-orange-400";

                                return (
                                    <div key={t.id} className="bg-[#1C1C1E] rounded-xl p-5 border border-slate-800 hover:border-slate-700 transition-all group flex flex-col h-[180px] shadow-sm">

                                        {/* Card Header */}
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl opacity-90">{t.icon}</span>
                                                <h3 className="text-sm font-semibold text-white tracking-wide">{t.name}</h3>
                                            </div>

                                            {/* Badge & Admin Delete Hover */}
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleDeleteTool(t.id)}
                                                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity p-1"
                                                    title="Delete Tool"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                </button>
                                                <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${badgeStyles}`}>
                                                    {badgeLabel}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <p className="text-xs text-slate-400 mb-4 line-clamp-2 leading-relaxed flex-grow">
                                            {t.description || "No description provided"}
                                        </p>

                                        {/* Card Footer */}
                                        <div className="flex items-center justify-between pt-4 mt-auto">
                                            <span className="text-xs text-slate-500">Status</span>

                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => {
                                                        if (t.name === "Knowledge Base") setShowKBConfig(true);
                                                        else if (t.slug === "weather") {
                                                            setWeatherToolId(t.id);
                                                            setWeatherApiKey(t.config?.api_key || "");
                                                            setWeatherConfigMsg(null);
                                                            setShowWeatherConfig(true);
                                                        } else if (t.slug === "google_calendar") {
                                                            setCalendarToolId(t.id);
                                                            setCalendarOAuthClientId(t.config?.oauth_client_id || "");
                                                            setCalendarOAuthSecret(t.config?.oauth_client_secret || "");
                                                            setCalendarConfigMsg(null);
                                                            setShowCalendarConfig(true);
                                                        }
                                                    }}
                                                    className={`text-[11px] transition-colors ${(t.name === "Knowledge Base" || t.slug === "weather" || t.slug === "google_calendar")
                                                        ? "text-indigo-400 hover:text-indigo-300 font-medium"
                                                        : "text-slate-400 hover:text-white"
                                                        }`}
                                                >
                                                    Configure
                                                </button>
                                                <button className="text-[11px] text-slate-400 hover:text-white transition-colors">View Logs</button>

                                                {/* Toggle Switch */}
                                                <button
                                                    onClick={() => handleToggleToolField(t.id, "enabled", !t.enabled)}
                                                    className={`w-[38px] h-[20px] rounded-full transition-colors relative shrink-0 focus:outline-none ml-1 ${t.enabled ? "bg-white" : "bg-[#2C2C2E]"
                                                        }`}
                                                >
                                                    <div className={`w-3.5 h-3.5 rounded-full absolute top-[3px] transition-all duration-200 ${t.enabled
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
                    )}
                </div>
            )}

            {/* ═══ Knowledge Base Config Modal ═══ */}
            {showKBConfig && (
                <>
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setShowKBConfig(false)} />
                    <div className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-[#0f172a] border-l border-slate-700/50 shadow-2xl z-50 flex flex-col overflow-y-auto">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 sticky top-0 bg-[#0f172a] z-10">
                            <div>
                                <h2 className="text-lg font-bold text-white">📚 Knowledge Base Configuration</h2>
                                <p className="text-xs text-slate-400 mt-0.5">URL scraping, file uploads, and plan access</p>
                            </div>
                            <button
                                onClick={() => setShowKBConfig(false)}
                                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6">
                            <SettingsTab />
                        </div>
                    </div>
                </>
            )}
            {/* ═══ Weather Config Modal ═══ */}
            {showWeatherConfig && (
                <>
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setShowWeatherConfig(false)} />
                    <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-[#0f172a] border-l border-slate-700/50 shadow-2xl z-50 flex flex-col overflow-y-auto">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 sticky top-0 bg-[#0f172a] z-10">
                            <div>
                                <h2 className="text-lg font-bold text-white">🌤️ Weather API Configuration</h2>
                                <p className="text-xs text-slate-400 mt-0.5">Connect an OpenWeatherMap API key for enhanced weather data</p>
                            </div>
                            <button
                                onClick={() => setShowWeatherConfig(false)}
                                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6 flex flex-col gap-6">
                            {/* Status */}
                            <div className={`flex items-center gap-3 p-4 rounded-xl border ${weatherApiKey
                                ? "bg-green-500/5 border-green-500/20"
                                : "bg-slate-800/50 border-slate-700/50"
                                }`}>
                                <span className={`w-2.5 h-2.5 rounded-full ${weatherApiKey ? "bg-green-400 animate-pulse" : "bg-slate-500"}`} />
                                <div>
                                    <p className="text-sm font-medium text-white">
                                        {weatherApiKey ? "API Key Configured" : "No API Key Set"}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {weatherApiKey ? "Using OpenWeatherMap for weather data" : "Using free wttr.in fallback (limited)"}
                                    </p>
                                </div>
                            </div>

                            {/* API Key Input */}
                            <div>
                                <label className="text-sm font-medium text-white mb-2 block">OpenWeatherMap API Key</label>
                                <input
                                    type="password"
                                    value={weatherApiKey}
                                    onChange={(e) => setWeatherApiKey(e.target.value)}
                                    placeholder="Enter your OpenWeatherMap API key..."
                                    className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-sm"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={async () => {
                                        if (!weatherToolId) return;
                                        setWeatherConfigSaving(true);
                                        setWeatherConfigMsg(null);
                                        try {
                                            await adminApi.updateTool(weatherToolId, {
                                                config: { api_key: weatherApiKey }
                                            });
                                            setWeatherConfigMsg({ type: "success", text: weatherApiKey ? "✅ API key saved successfully!" : "✅ API key cleared. Using wttr.in fallback." });
                                            loadAdminTools();
                                        } catch {
                                            setWeatherConfigMsg({ type: "error", text: "Failed to save. Please try again." });
                                        }
                                        setWeatherConfigSaving(false);
                                    }}
                                    disabled={weatherConfigSaving}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-500 text-white hover:bg-indigo-600 transition-all disabled:opacity-50"
                                >
                                    {weatherConfigSaving ? "Saving..." : "Save API Key"}
                                </button>
                                {weatherApiKey && (
                                    <button
                                        onClick={() => setWeatherApiKey("")}
                                        className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            {/* Status message */}
                            {weatherConfigMsg && (
                                <p className={`text-xs text-center ${weatherConfigMsg.type === "success" ? "text-green-400" : "text-red-400"}`}>
                                    {weatherConfigMsg.text}
                                </p>
                            )}

                            {/* Info box */}
                            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                                <div className="flex items-start gap-3">
                                    <span className="text-lg mt-0.5">💡</span>
                                    <div>
                                        <p className="text-sm font-medium text-indigo-300">How to get an API key</p>
                                        <ol className="text-xs text-slate-400 mt-2 space-y-1.5 list-decimal list-inside">
                                            <li>Go to <span className="text-indigo-400">openweathermap.org</span></li>
                                            <li>Create a free account</li>
                                            <li>Navigate to <strong>API Keys</strong> in your profile</li>
                                            <li>Copy the default key or generate a new one</li>
                                        </ol>
                                        <p className="text-xs text-slate-500 mt-2">Free tier: 60 calls/min, 1,000,000 calls/month</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
            {/* ═══ Google Calendar OAuth Config Modal ═══ */}
            {showCalendarConfig && (
                <>
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setShowCalendarConfig(false)} />
                    <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-[#0f172a] border-l border-slate-700/50 shadow-2xl z-50 flex flex-col overflow-y-auto">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 sticky top-0 bg-[#0f172a] z-10">
                            <div>
                                <h2 className="text-lg font-bold text-white">📅 Google Calendar — OAuth Setup</h2>
                                <p className="text-xs text-slate-400 mt-0.5">Set up OAuth credentials so users can connect their own calendars</p>
                            </div>
                            <button onClick={() => setShowCalendarConfig(false)} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors">✕</button>
                        </div>
                        <div className="p-6 flex flex-col gap-5">
                            {/* Status */}
                            <div className={`flex items-center gap-3 p-4 rounded-xl border ${calendarOAuthClientId && calendarOAuthSecret ? "bg-green-500/5 border-green-500/20" : "bg-slate-800/50 border-slate-700/50"}`}>
                                <span className={`w-2.5 h-2.5 rounded-full ${calendarOAuthClientId && calendarOAuthSecret ? "bg-green-400 animate-pulse" : "bg-slate-500"}`} />
                                <div>
                                    <p className="text-sm font-medium text-white">{calendarOAuthClientId && calendarOAuthSecret ? "OAuth Credentials Set" : "Not Configured"}</p>
                                    <p className="text-xs text-slate-400">{calendarOAuthClientId && calendarOAuthSecret ? "Users can connect their Google Calendar in agent settings" : "Add OAuth credentials to enable calendar for users"}</p>
                                </div>
                            </div>

                            {/* Client ID */}
                            <div>
                                <label className="text-sm font-medium text-white mb-2 block">OAuth Client ID</label>
                                <input type="text" value={calendarOAuthClientId} onChange={(e) => setCalendarOAuthClientId(e.target.value)} placeholder="xxxx.apps.googleusercontent.com" className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-xs" />
                            </div>

                            {/* Client Secret */}
                            <div>
                                <label className="text-sm font-medium text-white mb-2 block">OAuth Client Secret</label>
                                <input type="password" value={calendarOAuthSecret} onChange={(e) => setCalendarOAuthSecret(e.target.value)} placeholder="GOCSPX-..." className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-xs" />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={async () => {
                                        if (!calendarToolId) return;
                                        setCalendarConfigSaving(true);
                                        setCalendarConfigMsg(null);
                                        try {
                                            await adminApi.updateTool(calendarToolId, { config: { oauth_client_id: calendarOAuthClientId, oauth_client_secret: calendarOAuthSecret } });
                                            setCalendarConfigMsg({ type: "success", text: "✅ OAuth credentials saved! Users can now connect their calendar." });
                                            loadAdminTools();
                                        } catch { setCalendarConfigMsg({ type: "error", text: "Failed to save. Please try again." }); }
                                        setCalendarConfigSaving(false);
                                    }}
                                    disabled={calendarConfigSaving}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-500 text-white hover:bg-indigo-600 transition-all disabled:opacity-50"
                                >{calendarConfigSaving ? "Saving..." : "Save Credentials"}</button>
                                {(calendarOAuthClientId || calendarOAuthSecret) && (
                                    <button onClick={() => { setCalendarOAuthClientId(""); setCalendarOAuthSecret(""); }} className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all">Clear</button>
                                )}
                            </div>

                            {calendarConfigMsg && (<p className={`text-xs text-center ${calendarConfigMsg.type === "success" ? "text-green-400" : "text-red-400"}`}>{calendarConfigMsg.text}</p>)}

                            {/* Setup Instructions */}
                            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                                <div className="flex items-start gap-3">
                                    <span className="text-lg mt-0.5">💡</span>
                                    <div>
                                        <p className="text-sm font-medium text-indigo-300">How to get OAuth credentials</p>
                                        <ol className="text-xs text-slate-400 mt-2 space-y-1.5 list-decimal list-inside">
                                            <li>Go to <span className="text-indigo-400">console.cloud.google.com</span></li>
                                            <li>Create a project & enable <strong>Google Calendar API</strong></li>
                                            <li>Go to <strong>APIs & Services → Credentials</strong></li>
                                            <li>Create an <strong>OAuth 2.0 Client ID</strong> (Web application)</li>
                                            <li>Add redirect URI: <code className="text-indigo-400 bg-slate-800 px-1.5 py-0.5 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}/api/google-calendar/callback</code></li>
                                            <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong></li>
                                        </ol>
                                        <p className="text-xs text-slate-500 mt-2">Users will connect their own calendar via OAuth in agent settings.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
            {/* ═══ Channels Tab ═══ */}
            {tab === "channels" && (
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="bg-slate-900/40 rounded-xl p-6 mb-8 border border-slate-700/50 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />

                        <div className="z-10">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
                                <span className="text-cyan-400">📱</span> Platform Channels
                            </h2>
                            <p className="text-sm text-slate-400">Manage which messaging platforms and channels your users can deploy their agents to.</p>
                        </div>

                        <div className="w-full sm:w-1/3 min-w-[300px] z-10 flex flex-col gap-2">
                            <div className="flex justify-between text-xs font-medium text-indigo-300">
                                <span>Active Platforms</span>
                                <span>{adminChannels.filter(c => c.enabled).length} Enabled</span>
                            </div>
                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-cyan-500 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${Math.min(100, (adminChannels.filter(c => c.enabled).length / Math.max(1, adminChannels.length)) * 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold text-white">Available Channels</h3>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSeedChannels}
                                className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                            >
                                ✨ Seed Default List
                            </button>
                            <button
                                onClick={() => setShowAddChannel(!showAddChannel)}
                                className="text-sm font-medium px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
                            >
                                + Add Channel
                            </button>
                        </div>
                    </div>

                    {/* Add Channel Form */}
                    {showAddChannel && (
                        <div className="bg-slate-900/60 rounded-xl p-6 mb-8 border border-slate-700/50">
                            <h3 className="text-sm font-semibold text-white mb-4">Create New Platform Channel</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-5">
                                <input value={newChannel.slug} onChange={(e) => setNewChannel({ ...newChannel, slug: e.target.value })} placeholder="slug (e.g. telegram)" className="px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50" />
                                <input value={newChannel.name} onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })} placeholder="Name" className="px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50" />
                                <input value={newChannel.icon} onChange={(e) => setNewChannel({ ...newChannel, icon: e.target.value })} placeholder="Icon (emoji)" className="px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50" />
                                <input value={newChannel.description} onChange={(e) => setNewChannel({ ...newChannel, description: e.target.value })} placeholder="Short description" className="px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 lg:col-span-2" />
                                <select value={newChannel.badge} onChange={(e) => setNewChannel({ ...newChannel, badge: e.target.value })} className="px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50">
                                    <option value="stable">STABLE</option>
                                    <option value="beta">BETA</option>
                                    <option value="alpha">ALPHA</option>
                                    <option value="coming_soon">COMING SOON</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setShowAddChannel(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
                                <button onClick={handleAddChannel} className="px-5 py-2 rounded-lg text-sm font-medium bg-cyan-500 text-white hover:bg-cyan-600 transition-colors shadow-lg shadow-cyan-500/20">Save Channel</button>
                            </div>
                        </div>
                    )}

                    {/* Channels Grid */}
                    {channelsLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {adminChannels.map((c) => {
                                let badgeStyles = "bg-slate-800/80 text-slate-400";
                                let badgeLabel = c.badge?.replace("_", " ") || "STABLE";

                                if (c.badge === "stable") badgeStyles = "bg-emerald-500/10 text-emerald-500";
                                else if (c.badge === "beta") badgeStyles = "bg-blue-500/10 text-blue-400";
                                else if (c.badge === "alpha") badgeStyles = "bg-amber-500/10 text-amber-500";
                                else if (c.badge === "coming_soon") badgeStyles = "bg-orange-500/10 text-orange-400";

                                return (
                                    <div key={c.id} className="bg-[#1C1C1E] rounded-xl p-5 border border-slate-800 hover:border-slate-700 transition-all group flex flex-col h-[180px] shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl opacity-90">{c.icon}</span>
                                                <h3 className="text-sm font-semibold text-white tracking-wide">{c.name}</h3>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleDeleteChannel(c.id)}
                                                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity p-1"
                                                    title="Delete Channel"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                </button>
                                                <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${badgeStyles}`}>
                                                    {badgeLabel}
                                                </span>
                                            </div>
                                        </div>

                                        <p className="text-xs text-slate-400 mb-4 line-clamp-2 leading-relaxed flex-grow">
                                            {c.description || "No description provided"}
                                        </p>

                                        <div className="flex items-center justify-between pt-4 mt-auto">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500">Is Upcoming?</span>
                                                <button
                                                    onClick={() => handleToggleChannelField(c.id, "is_upcoming", !c.is_upcoming)}
                                                    className={`w-[30px] h-[16px] rounded-full transition-colors relative shrink-0 focus:outline-none ${c.is_upcoming ? "bg-amber-500" : "bg-slate-700"}`}
                                                >
                                                    <div className={`w-2.5 h-2.5 rounded-full absolute top-[3px] bg-white transition-all duration-200 ${c.is_upcoming ? "translate-x-[15px]" : "translate-x-[3px]"}`} />
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500">Enabled</span>
                                                <button
                                                    onClick={() => handleToggleChannelField(c.id, "enabled", !c.enabled)}
                                                    className={`w-[38px] h-[20px] rounded-full transition-colors relative shrink-0 focus:outline-none ml-1 ${c.enabled ? "bg-white" : "bg-[#2C2C2E]"}`}
                                                >
                                                    <div className={`w-3.5 h-3.5 rounded-full absolute top-[3px] transition-all duration-200 ${c.enabled ? "bg-black translate-x-[20px]" : "bg-slate-400 translate-x-[4px]"}`} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ═══ AI Models Tab ═══ */}
            {tab === "models" && (
                <div className="max-w-5xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">🧠 AI Model Access Control</h2>
                            <p className="text-sm text-slate-400 mt-1">Configure which AI models are available for each subscription plan</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {modelsMsg && (
                                <span className={`text-xs px-3 py-1.5 rounded-lg ${modelsMsg.type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                                    {modelsMsg.text}
                                </span>
                            )}
                            <button
                                onClick={handleSaveModels}
                                disabled={modelsSaving}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {modelsSaving ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : "💾 Save Changes"}
                            </button>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2 mb-6">
                        <span className="text-xs text-slate-500 mr-2">Quick:</span>
                        <button onClick={() => handleQuickAction("allow-all-free")} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all">
                            ✅ Allow All Free
                        </button>
                        <button onClick={() => handleQuickAction("restrict-premium")} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all">
                            🔒 Restrict Premium
                        </button>
                        <button onClick={() => handleQuickAction("reset")} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-600/30 text-slate-400 border border-slate-600/30 hover:bg-slate-600/50 transition-all">
                            ↻ Reset Defaults
                        </button>
                    </div>

                    {/* Info Banner */}
                    <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 mb-6">
                        <div className="flex items-start gap-3">
                            <span className="text-lg mt-0.5">💡</span>
                            <div>
                                <p className="text-sm font-medium text-indigo-300">How it works</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Toggle models ON/OFF for each plan. Users can only select models that are enabled for their subscription tier when creating agents. Admin users always have full access.
                                </p>
                            </div>
                        </div>
                    </div>

                    {modelsLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : modelsConfig ? (
                        <div className="space-y-6">
                            {modelsConfig.providers?.map((provider: any, pIdx: number) => {
                                const providerColors: Record<string, string> = {
                                    openai: "border-green-500/30 bg-green-500/5",
                                    anthropic: "border-orange-500/30 bg-orange-500/5",
                                    google: "border-blue-500/30 bg-blue-500/5",
                                };
                                return (
                                    <div key={provider.id} className={`rounded-2xl border ${providerColors[provider.id] || "border-slate-700/50 bg-slate-800/20"} overflow-hidden`}>
                                        {/* Provider Header */}
                                        <div className="px-6 py-4 border-b border-slate-700/30 flex items-center gap-3">
                                            <span className="text-2xl">{provider.icon}</span>
                                            <div>
                                                <h3 className="text-base font-semibold text-white">{provider.name}</h3>
                                                <p className="text-xs text-slate-400">{provider.models.length} models</p>
                                            </div>
                                        </div>

                                        {/* Matrix Table */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-slate-700/30">
                                                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase w-[200px]">Model</th>
                                                        <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Cost</th>
                                                        {["free", "starter", "growth", "business"].map((plan) => {
                                                            const planColors: Record<string, string> = {
                                                                free: "bg-slate-600/30 text-slate-300",
                                                                starter: "bg-blue-500/15 text-blue-400",
                                                                growth: "bg-purple-500/15 text-purple-400",
                                                                business: "bg-amber-500/15 text-amber-400",
                                                            };
                                                            return (
                                                                <th key={plan} className="text-center px-4 py-3">
                                                                    <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${planColors[plan]}`}>
                                                                        {plan}
                                                                    </span>
                                                                </th>
                                                            );
                                                        })}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {provider.models.map((model: any, mIdx: number) => (
                                                        <tr key={model.id} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="text-sm text-white font-medium">{model.name}</div>
                                                                <div className="text-xs text-slate-500 mt-0.5">{model.desc}</div>
                                                            </td>
                                                            <td className="px-4 py-4 text-center">
                                                                <span className="text-xs text-amber-400/80">
                                                                    {"💰".repeat(model.cost_tier || 1)}
                                                                </span>
                                                            </td>
                                                            {["free", "starter", "growth", "business"].map((plan) => {
                                                                const isEnabled = model.plans?.includes(plan);
                                                                return (
                                                                    <td key={plan} className="px-4 py-4 text-center">
                                                                        <button
                                                                            onClick={() => handleToggleModelPlan(pIdx, mIdx, plan)}
                                                                            className={`w-[42px] h-[22px] rounded-full transition-all duration-200 relative focus:outline-none ${isEnabled
                                                                                ? "bg-green-500 shadow-lg shadow-green-500/20"
                                                                                : "bg-slate-700 hover:bg-slate-600"
                                                                                }`}
                                                                        >
                                                                            <div className={`w-4 h-4 rounded-full absolute top-[3px] transition-all duration-200 ${isEnabled
                                                                                ? "bg-white translate-x-[22px]"
                                                                                : "bg-slate-400 translate-x-[4px]"
                                                                                }`} />
                                                                        </button>
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-500">No model configuration found</div>
                    )}
                </div>
            )}

            {/* ═══ Skills Tab ═══ */}
            {tab === "skills" && (
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-1">
                                <span>⚡</span> Autonomous Skills
                            </h2>
                            <p className="text-sm text-slate-400">Create and manage autonomous background skills. Toggle visibility for users.</p>
                        </div>
                        <div className="flex gap-2">
                            {adminSkills.length === 0 && (
                                <button
                                    onClick={handleSeedSkills}
                                    className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                                >
                                    🌱 Seed Defaults
                                </button>
                            )}
                            <button
                                onClick={() => setShowAddSkill(!showAddSkill)}
                                className="text-sm font-medium px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
                            >
                                + Create Skill
                            </button>
                        </div>
                    </div>

                    {/* Create Skill Form */}
                    {showAddSkill && (
                        <div className="bg-slate-900/60 rounded-xl p-6 mb-8 border border-slate-700/50">
                            <h3 className="text-sm font-semibold text-white mb-4">Create New Skill</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                                <input value={newSkill.slug} onChange={(e) => setNewSkill({ ...newSkill, slug: e.target.value })} placeholder="slug (e.g. market-analyst)" className="px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/50" />
                                <input value={newSkill.name} onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })} placeholder="Name" className="px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/50" />
                                <input value={newSkill.icon} onChange={(e) => setNewSkill({ ...newSkill, icon: e.target.value })} placeholder="Icon (emoji)" className="px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/50" />
                                <input value={newSkill.description} onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })} placeholder="Short description" className="px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/50 md:col-span-2" />
                                <select value={newSkill.schedule} onChange={(e) => setNewSkill({ ...newSkill, schedule: e.target.value })} className="px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/50">
                                    <option value="Hourly">Hourly</option>
                                    <option value="Daily at 7 AM">Daily at 7 AM</option>
                                    <option value="Daily at 8 AM">Daily at 8 AM</option>
                                    <option value="Daily at 9 AM">Daily at 9 AM</option>
                                    <option value="Hourly (9-5)">Hourly (9-5)</option>
                                    <option value="Weekly">Weekly</option>
                                    <option value="Custom">Custom</option>
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="text-xs text-slate-400 mb-1 block">Tags</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {newSkill.tags.map((tag) => (
                                        <span key={tag} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                            {tag}
                                            <button onClick={() => setNewSkill({ ...newSkill, tags: newSkill.tags.filter(t => t !== tag) })} className="text-indigo-400/60 hover:text-indigo-300">✕</button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input value={skillTagInput} onChange={(e) => setSkillTagInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (skillTagInput.trim()) { setNewSkill({ ...newSkill, tags: [...newSkill.tags, skillTagInput.trim()] }); setSkillTagInput(""); } } }}
                                        placeholder="Add tag..." className="flex-1 px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500/50" />
                                    <button onClick={() => { if (skillTagInput.trim()) { setNewSkill({ ...newSkill, tags: [...newSkill.tags, skillTagInput.trim()] }); setSkillTagInput(""); } }}
                                        className="px-3 py-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-sm border border-slate-700">Add</button>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setShowAddSkill(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
                                <button onClick={handleAddSkill} className="px-5 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20">Create Skill</button>
                            </div>
                        </div>
                    )}

                    {/* Skills Grid */}
                    {skillsLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : adminSkills.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="text-4xl mb-3">⚡</div>
                            <p className="text-slate-400 mb-4">No skills yet. Seed the defaults or create your first skill.</p>
                            <button onClick={handleSeedSkills} className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:opacity-90 transition-all">
                                🌱 Seed Default Skills
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {adminSkills.map((s) => (
                                <div key={s.id} className={`rounded-2xl p-5 bg-gradient-to-br ${s.gradient || 'from-slate-500/20 to-slate-600/10'} border border-white/5 ${!s.enabled ? 'opacity-50' : ''} transition-all relative`}>
                                    {/* Visibility Badge */}
                                    <div className="absolute top-4 right-4">
                                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${s.enabled
                                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${s.enabled ? 'bg-green-400' : 'bg-red-400'}`} />
                                            {s.enabled ? 'Visible' : 'Hidden'}
                                        </span>
                                    </div>

                                    {/* Icon + Name */}
                                    <div className="flex items-start gap-3 mb-3 pr-20">
                                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.icon_bg || 'from-slate-500 to-slate-400'} flex items-center justify-center text-lg shrink-0`}>
                                            {s.icon}
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-white">{s.name}</h3>
                                            <p className="text-slate-400 text-xs mt-0.5">{s.description}</p>
                                        </div>
                                    </div>

                                    {/* Meta */}
                                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                                        <span>⏱ {s.schedule}</span>
                                        <span className="text-slate-700">•</span>
                                        <span>🏷 {(s.tags || []).join(', ') || 'No tags'}</span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                        <button
                                            onClick={() => handleDeleteSkill(s.id)}
                                            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all border border-white/5"
                                        >
                                            🗑️ Delete
                                        </button>
                                        <button
                                            onClick={() => handleToggleSkillEnabled(s.id, !s.enabled)}
                                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${s.enabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
                                            title={s.enabled ? 'Hide skill' : 'Show skill'}
                                        >
                                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${s.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══ Settings Tab ═══ */}
            {tab === "settings" && (
                <SettingsTab />
            )}
        </div>
    );
}
