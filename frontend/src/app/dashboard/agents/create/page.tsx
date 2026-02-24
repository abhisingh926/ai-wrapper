"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { agentApi, toolsApi, channelsApi, assistantApi } from "@/lib/api";

/* ─── Data ─── */

// Fallback providers (used if API fails)
const fallbackProviders = [
    {
        id: "openai", name: "OpenAI", icon: "🤖", color: "from-green-500 to-emerald-600",
        models: [
            { id: "gpt-4o", name: "GPT-4o", desc: "Most capable, multimodal" },
            { id: "gpt-4o-mini", name: "GPT-4o Mini", desc: "Fast & affordable" },
            { id: "gpt-4-turbo", name: "GPT-4 Turbo", desc: "High reasoning" },
        ],
    },
    {
        id: "anthropic", name: "Anthropic", icon: "🧠", color: "from-orange-500 to-amber-600",
        models: [
            { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", desc: "Best balanced" },
            { id: "claude-3-opus", name: "Claude 3 Opus", desc: "Most powerful" },
            { id: "claude-3-haiku", name: "Claude 3 Haiku", desc: "Fastest" },
        ],
    },
    {
        id: "google", name: "Google", icon: "✨", color: "from-blue-500 to-indigo-600",
        models: [
            { id: "gemini-pro", name: "Gemini Pro", desc: "Best all-around" },
            { id: "gemini-pro-1.5", name: "Gemini 1.5 Pro", desc: "Long context" },
            { id: "gemini-flash", name: "Gemini Flash", desc: "Ultra fast" },
        ],
    },
];

// Type for dynamic model data
type DynamicModel = { id: string; name: string; desc: string; cost_tier?: number; allowed: boolean; min_plan?: string; plans?: string[] };
type DynamicProvider = { id: string; name: string; icon: string; color: string; models: DynamicModel[] };

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

type ToolItem = { id: string; name: string; icon: string; desc: string; badge: string };

const agentPersonalities = [
    {
        id: "support",
        name: "Customer Support",
        icon: "🎧",
        prompt: "You are a friendly and professional customer support agent. Help users solve their problems patiently. Ask clarifying questions when needed. Always be polite and empathetic."
    },
    {
        id: "sales",
        name: "Sales Assistant",
        icon: "💼",
        prompt: "You are a highly persuasive and consultative sales assistant. Your goal is to understand the user's needs, highlight the benefits of our products/services, and guide them towards making a purchase."
    },
    {
        id: "writer",
        name: "Creative Writer",
        icon: "✨",
        prompt: "You are a creative and imaginative writer. Help users brainstorm ideas, draft content, and refine their writing style. Use engaging and descriptive language."
    },
    {
        id: "coder",
        name: "Coding Helper",
        icon: "💻",
        prompt: "You are an expert software engineer. Help users write, debug, and understand code. Provide clear explanations, best practices, and efficient solutions."
    },
    {
        id: "expert",
        name: "Knowledge Expert",
        icon: "📚",
        prompt: "You are a highly knowledgeable expert. Provide accurate, detailed, and well-structured answers to user queries based on provided documents and general knowledge."
    },
    {
        id: "custom",
        name: "Custom",
        icon: "⚙️",
        prompt: "You are a helpful AI assistant." // Default/blank start
    }
];

const steps = [
    { num: "01", title: "Choose Your AI", sub: "3 providers • 10+ models" },
    { num: "02", title: "Connect a Platform", sub: "6 channels • 1-click setup" },
    { num: "03", title: "Add Superpowers", sub: "12+ tools • Plug & play" },
    { num: "04", title: "Deploy & Go Live", sub: "Instant • Auto-scaling" },
];

export default function CreateAgentPage() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [tools, setTools] = useState<ToolItem[]>([]);
    const [platforms, setPlatforms] = useState<any[]>([]);

    // Wizard state
    const [selectedProvider, setSelectedProvider] = useState("");
    const [selectedModel, setSelectedModel] = useState("");
    const [selectedPlatform, setSelectedPlatform] = useState("");
    const [selectedTools, setSelectedTools] = useState<string[]>([]);
    const [agentName, setAgentName] = useState("");
    const [selectedPersonality, setSelectedPersonality] = useState("support");
    const [systemPrompt, setSystemPrompt] = useState(agentPersonalities[0].prompt);

    // AI Prompt Extractor
    const [customDescription, setCustomDescription] = useState("");
    const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

    // Dynamic AI providers from API
    const [aiProviders, setAiProviders] = useState<DynamicProvider[]>([]);
    const [modelsLoaded, setModelsLoaded] = useState(false);

    useEffect(() => {
        toolsApi.list().then((res) => setTools(res.data)).catch(console.error);
        channelsApi.list().then((res) => setPlatforms(res.data)).catch(console.error);
        // Load available models based on user's plan
        agentApi.availableModels().then((res) => {
            setAiProviders(res.data.providers || []);
            setModelsLoaded(true);
        }).catch(() => {
            // Fallback to hardcoded (all allowed)
            setAiProviders(fallbackProviders.map(p => ({
                ...p,
                models: p.models.map(m => ({ ...m, allowed: true, min_plan: "free" }))
            })));
            setModelsLoaded(true);
        });
    }, []);

    const provider = aiProviders.find((p) => p.id === selectedProvider);

    const handleGeneratePrompt = async () => {
        if (!customDescription.trim()) return;
        setIsGeneratingPrompt(true);
        try {
            const res = await assistantApi.generatePrompt(customDescription);
            setSystemPrompt(res.data.prompt);
        } catch (error) {
            console.error("Failed to generate prompt:", error);
            // In a real app we'd show a toast error here
        } finally {
            setIsGeneratingPrompt(false);
        }
    };

    const canNext = () => {
        if (step === 0) return !!selectedProvider && !!selectedModel;
        if (step === 1) return !!selectedPlatform;
        if (step === 2) return true; // tools are optional
        if (step === 3) return !!agentName.trim();
        return false;
    };

    const handleDeploy = async () => {
        if (!agentName.trim()) return;
        setLoading(true);
        try {
            const res = await agentApi.create({
                name: agentName,
                ai_provider: selectedProvider,
                ai_model: selectedModel,
                platform: selectedPlatform,
                tools: selectedTools,
                system_prompt: systemPrompt,
            });
            // Deploy immediately
            await agentApi.deploy(res.data.id);
            // Route directly to the new agent's tools configuration tab
            router.push(`/dashboard/agents/${res.data.id}?tab=tools`);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const toggleTool = (id: string) => {
        setSelectedTools((prev) =>
            prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
        );
    };

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-lg">🤖</span>
                    Create Agent
                </h1>
                <p className="text-slate-400 mt-1">From zero to a fully deployed AI agent — in under a minute.</p>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center mb-10 gap-1">
                {steps.map((s, i) => (
                    <div key={s.num} className="flex items-center flex-1">
                        <button
                            onClick={() => i < step && setStep(i)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 w-full ${i === step
                                ? "bg-indigo-500/15 border border-indigo-500/30"
                                : i < step
                                    ? "bg-green-500/10 border border-green-500/20 cursor-pointer"
                                    : "bg-slate-800/30 border border-slate-700/20"
                                }`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${i === step
                                ? "bg-indigo-500 text-white"
                                : i < step
                                    ? "bg-green-500 text-white"
                                    : "bg-slate-700 text-slate-400"
                                }`}>
                                {i < step ? "✓" : s.num}
                            </div>
                            <div className="text-left hidden lg:block">
                                <div className={`text-xs font-semibold ${i === step ? "text-indigo-300" : i < step ? "text-green-300" : "text-slate-500"}`}>{s.title}</div>
                                <div className="text-[10px] text-slate-500">{s.sub}</div>
                            </div>
                        </button>
                        {i < steps.length - 1 && (
                            <div className={`w-4 h-0.5 mx-1 rounded-full ${i < step ? "bg-green-500/50" : "bg-slate-700"}`} />
                        )}
                    </div>
                ))}
            </div>

            {/* Step Content */}
            <div className="glass rounded-2xl p-8 min-h-[420px]">

                {/* Step 1: Choose AI */}
                {step === 0 && (
                    <div>
                        <h2 className="text-xl font-bold text-white mb-1">Choose Your AI Provider & Model</h2>
                        <p className="text-slate-400 text-sm mb-6">Pick the brain behind your agent. You can switch anytime.</p>

                        <div className="grid grid-cols-3 gap-4 mb-8">
                            {aiProviders.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => { setSelectedProvider(p.id); setSelectedModel(""); }}
                                    className={`relative p-5 rounded-xl border transition-all duration-200 text-left group ${selectedProvider === p.id
                                        ? "border-indigo-500/50 bg-indigo-500/10"
                                        : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
                                        }`}
                                >
                                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center text-2xl mb-3`}>
                                        {p.icon}
                                    </div>
                                    <div className="text-white font-semibold">{p.name}</div>
                                    <div className="text-xs text-slate-400 mt-0.5">{p.models.length} models available</div>
                                    {selectedProvider === p.id && (
                                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs">✓</div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {selectedProvider && (
                            <div className="mb-8">
                                <h3 className="text-sm font-semibold text-slate-300 mb-3">Select Model</h3>
                                <div className="grid grid-cols-3 gap-3">
                                    {provider?.models.map((m) => {
                                        const isLocked = !m.allowed;
                                        return (
                                            <button
                                                key={m.id}
                                                onClick={() => !isLocked && setSelectedModel(m.id)}
                                                disabled={isLocked}
                                                className={`p-4 rounded-xl border transition-all text-left relative ${isLocked
                                                    ? "border-slate-700/20 bg-slate-800/10 opacity-50 cursor-not-allowed"
                                                    : selectedModel === m.id
                                                        ? "border-cyan-500/50 bg-cyan-500/10"
                                                        : "border-slate-700/40 bg-slate-800/20 hover:border-slate-600"
                                                    }`}
                                            >
                                                <div className="text-white font-medium text-sm">{m.name}</div>
                                                <div className="text-xs text-slate-400 mt-0.5">{m.desc}</div>
                                                {isLocked && (
                                                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-semibold">
                                                        🔒 {(m.min_plan || "Starter").charAt(0).toUpperCase() + (m.min_plan || "Starter").slice(1)}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Agent Personality Selection */}
                        <div className="mt-8 border-t border-slate-700/50 pt-8">
                            <h2 className="text-xl font-bold text-white mb-1">Agent Personality</h2>
                            <p className="text-slate-400 text-sm mb-6">Choose how your agent should behave. This tells the AI what kind of assistant it should be.</p>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {agentPersonalities.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            setSelectedPersonality(p.id);
                                            // Reset prompt to default if they switch back to a preset
                                            if (p.id !== "custom") {
                                                setSystemPrompt(p.prompt);
                                            }
                                        }}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${selectedPersonality === p.id
                                            ? "border-indigo-500/50 bg-indigo-500/10"
                                            : "border-slate-700/40 bg-slate-800/20 hover:border-slate-600"
                                            }`}
                                    >
                                        <span className="text-lg">{p.icon}</span>
                                        <span className="text-white text-sm font-medium">{p.name}</span>
                                    </button>
                                ))}
                            </div>

                            {/* AI Prompt Generator (only if custom is selected) */}
                            {selectedPersonality === "custom" && (
                                <div className="mt-4 p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                                    <input
                                        type="text"
                                        placeholder="Describe your agent in plain English (e.g. A pirate who tells jokes)..."
                                        value={customDescription}
                                        onChange={(e) => setCustomDescription(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                    />
                                    <button
                                        onClick={handleGeneratePrompt}
                                        disabled={isGeneratingPrompt || !customDescription.trim()}
                                        className="whitespace-nowrap px-4 py-2.5 rounded-lg text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                                    >
                                        {isGeneratingPrompt ? (
                                            <>
                                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Generating...
                                            </>
                                        ) : "✨ Generate with AI"}
                                    </button>
                                </div>
                            )}

                            {/* Agent Instructions Textarea (Moved from Step 4) */}
                            <div className="mt-6">
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Agent Instructions
                                </label>
                                <textarea
                                    value={systemPrompt}
                                    onChange={(e) => setSystemPrompt(e.target.value)}
                                    className="w-full h-32 bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                                    placeholder="You are a helpful assistant..."
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Connect Platform */}
                {step === 1 && (
                    <div>
                        <h2 className="text-xl font-bold text-white mb-1">Connect a Platform</h2>
                        <p className="text-slate-400 text-sm mb-6">Where will your agent live? Pick a channel to deploy on.</p>

                        <div className="grid grid-cols-3 gap-4">
                            {platforms.map((p) => {
                                const isSoon = p.is_upcoming;
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => !isSoon && setSelectedPlatform(p.id)}
                                        disabled={isSoon}
                                        className={`relative p-5 rounded-xl border transition-all duration-200 text-left ${isSoon
                                            ? "border-slate-700/30 bg-slate-800/10 opacity-50 cursor-not-allowed"
                                            : selectedPlatform === p.id
                                                ? "border-indigo-500/50 bg-indigo-500/10"
                                                : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
                                            }`}
                                    >
                                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getPlatformColor(p.id)} flex items-center justify-center text-2xl mb-3`}>
                                            {p.icon}
                                        </div>
                                        <div className="text-white font-semibold flex justify-between items-center">
                                            {p.name}
                                            {isSoon && (
                                                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[9px] font-bold uppercase tracking-wider">
                                                    Coming Soon
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{p.description || "Connect your agent to this channel."}</div>
                                        {selectedPlatform === p.id && !isSoon && (
                                            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs">✓</div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Step 3: Add Superpowers */}
                {step === 2 && (
                    <div>
                        <h2 className="text-xl font-bold text-white mb-1">Add Superpowers</h2>
                        <p className="text-slate-400 text-sm mb-6">Give your agent tools to interact with external services. Select as many as you want.</p>

                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {tools.map((t) => {
                                const active = selectedTools.includes(t.id);
                                const isSoon = t.badge === "coming_soon";
                                return (
                                    <button
                                        key={t.id}
                                        onClick={() => !isSoon && toggleTool(t.id)}
                                        disabled={isSoon}
                                        className={`relative p-4 rounded-xl border transition-all duration-200 text-left ${isSoon
                                            ? "border-slate-700/30 bg-slate-800/10 opacity-50 cursor-not-allowed"
                                            : active
                                                ? "border-cyan-500/50 bg-cyan-500/10"
                                                : "border-slate-700/40 bg-slate-800/20 hover:border-slate-600"
                                            }`}
                                    >
                                        <div className="text-2xl mb-2">{t.icon}</div>
                                        <div className="text-white font-medium text-sm">{t.name}</div>
                                        <div className="text-[11px] text-slate-400 mt-0.5">{t.desc}</div>
                                        {isSoon && (
                                            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-semibold">
                                                Coming Soon
                                            </div>
                                        )}
                                        {active && !isSoon && (
                                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-white text-xs">✓</div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {selectedTools.length > 0 && (
                            <div className="mt-4 text-sm text-cyan-300">
                                {selectedTools.length} tool{selectedTools.length > 1 ? "s" : ""} selected
                            </div>
                        )}
                    </div>
                )}

                {/* Step 4: Deploy */}
                {step === 3 && (
                    <div>
                        <h2 className="text-xl font-bold text-white mb-1">Deploy & Go Live</h2>
                        <p className="text-slate-400 text-sm mb-6">Review your configuration, name your agent, and launch it!</p>

                        <div className="grid grid-cols-2 gap-6">
                            {/* Left: Configuration */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-slate-400 font-medium mb-1 block">Agent Name *</label>
                                    <input
                                        value={agentName}
                                        onChange={(e) => setAgentName(e.target.value)}
                                        placeholder="My Awesome Agent"
                                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 font-medium mb-1 block">System Prompt</label>
                                    <textarea
                                        value={systemPrompt}
                                        onChange={(e) => setSystemPrompt(e.target.value)}
                                        rows={4}
                                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500/50 resize-none"
                                    />
                                </div>
                            </div>

                            {/* Right: Summary */}
                            <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/30 space-y-4">
                                <h3 className="text-sm font-semibold text-white mb-3">Configuration Summary</h3>

                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${provider?.color || "from-slate-500 to-slate-600"} flex items-center justify-center text-lg`}>
                                        {provider?.icon || "?"}
                                    </div>
                                    <div>
                                        <div className="text-white text-sm font-medium">{provider?.name || "—"}</div>
                                        <div className="text-xs text-slate-400">{provider?.models.find(m => m.id === selectedModel)?.name || "—"}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {(() => {
                                        const pl = platforms.find(p => p.id === selectedPlatform);
                                        return pl ? (
                                            <>
                                                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${getPlatformColor(pl.id)} flex items-center justify-center text-lg`}>{pl.icon}</div>
                                                <div>
                                                    <div className="text-white text-sm font-medium">{pl.name}</div>
                                                    <div className="text-xs text-slate-400">Platform</div>
                                                </div>
                                            </>
                                        ) : null;
                                    })()}
                                </div>

                                {selectedTools.length > 0 && (
                                    <div>
                                        <div className="text-xs text-slate-400 mb-2">Tools ({selectedTools.length})</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {selectedTools.map((tId) => {
                                                const t = tools.find((t) => t.id === tId);
                                                return (
                                                    <span key={tId} className="px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-xs text-cyan-300">
                                                        {t?.icon} {t?.name}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-6">
                <button
                    onClick={() => step > 0 && setStep(step - 1)}
                    className={`px-6 py-3 rounded-xl text-sm font-medium transition-all ${step > 0
                        ? "text-slate-300 bg-slate-800/50 border border-slate-700/50 hover:border-slate-600"
                        : "invisible"
                        }`}
                >
                    ← Back
                </button>

                {step < 3 ? (
                    <button
                        onClick={() => canNext() && setStep(step + 1)}
                        disabled={!canNext()}
                        className="px-8 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        Continue →
                    </button>
                ) : (
                    <button
                        onClick={handleDeploy}
                        disabled={!canNext() || loading}
                        className="px-8 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Deploying...
                            </>
                        ) : (
                            "🚀 Deploy Agent"
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}
