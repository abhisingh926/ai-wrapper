"use client";

import { useEffect, useRef, useState } from "react";
import { assistantApi, integrationApi } from "@/lib/api";

type Message = {
    id: number;
    role: "user" | "assistant";
    text: string;
    app?: string;
    timestamp: Date;
};

const appIcons: Record<string, string> = {
    gmail: "📧", telegram: "✈️", discord: "🎮", slack: "💼",
    openai: "🤖", anthropic: "🧠", notion: "📝", github: "🐙",
    trello: "📋", spotify: "🎵", twitter: "🐦", webhooks: "🔗", cron: "⏰",
};

const quickActions: Record<string, { label: string; query: string }[]> = {
    gmail: [
        { label: "📬 Latest Emails", query: "Show my latest 5 emails" },
        { label: "📩 Unread Emails", query: "Check unread emails" },
        { label: "🔍 Search Emails", query: "Search emails about " },
    ],
    telegram: [
        { label: "💬 Send Message", query: "Send Telegram to CHAT_ID saying Hello!" },
    ],
};

export default function AssistantPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [connectedApps, setConnectedApps] = useState<string[]>([]);
    const [selectedApp, setSelectedApp] = useState<string>("");
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    let msgId = useRef(0);

    useEffect(() => {
        loadConnected();
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const loadConnected = async () => {
        try {
            const res = await integrationApi.connected();
            const slugs = res.data.map((ui: any) => ui.integration.slug);
            setConnectedApps(slugs);

            // Welcome message
            if (slugs.length > 0) {
                const appList = slugs.map((s: string) => `${appIcons[s] || "🔌"} ${s.charAt(0).toUpperCase() + s.slice(1)}`).join(", ");
                addAssistantMessage(
                    `👋 Hi! I'm your AI Assistant. I can interact with your connected apps: **${appList}**.\n\nTry asking me to check your emails, send messages, or type **help** for all available commands!`
                );
            } else {
                addAssistantMessage(
                    "👋 Hi! You don't have any apps connected yet. Go to **Integrations** to connect Gmail, Telegram, or other apps, then come back here to interact with them!"
                );
            }
        } catch {
            addAssistantMessage("❌ Couldn't load your connected apps. Please try refreshing.");
        }
    };

    const addAssistantMessage = (text: string, app?: string) => {
        msgId.current += 1;
        setMessages((prev) => [...prev, {
            id: msgId.current, role: "assistant", text, app, timestamp: new Date(),
        }]);
    };

    const handleSend = async (customQuery?: string) => {
        const query = customQuery || input.trim();
        if (!query || loading) return;

        msgId.current += 1;
        const userMsg: Message = {
            id: msgId.current, role: "user", text: query, timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const res = await assistantApi.query(query, selectedApp || undefined);
            addAssistantMessage(res.data.reply, res.data.app_used);
        } catch (err: any) {
            const detail = err.response?.data?.detail || "Something went wrong. Please try again.";
            addAssistantMessage(`❌ ${detail}`);
        }

        setLoading(false);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Format markdown-like text
    const formatText = (text: string) => {
        return text
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/_(.+?)_/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code class="bg-slate-700/60 px-1.5 py-0.5 rounded text-indigo-300 text-xs font-mono">$1</code>')
            .replace(/\n/g, '<br/>');
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            {/* Header */}
            <div className="mb-4">
                <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-lg">💬</span>
                    Assistant
                </h1>
                <p className="text-slate-400">Interact with your connected apps using natural language.</p>
            </div>

            {/* Connected Apps Bar */}
            {connectedApps.length > 0 && (
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className="text-xs text-slate-500 mr-1">Target app:</span>
                    <button
                        onClick={() => setSelectedApp("")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!selectedApp
                            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                            : "text-slate-400 bg-slate-800/50 border border-transparent hover:border-slate-700"
                            }`}
                    >
                        Auto-detect
                    </button>
                    {connectedApps.map((app) => (
                        <button
                            key={app}
                            onClick={() => setSelectedApp(app === selectedApp ? "" : app)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${selectedApp === app
                                ? "bg-green-500/20 text-green-300 border border-green-500/30"
                                : "text-slate-400 bg-slate-800/50 border border-transparent hover:border-slate-700"
                                }`}
                        >
                            {appIcons[app] || "🔌"} {app.charAt(0).toUpperCase() + app.slice(1)}
                        </button>
                    ))}
                </div>
            )}

            {/* Quick Actions */}
            {connectedApps.length > 0 && messages.length <= 1 && (
                <div className="mb-4">
                    <p className="text-xs text-slate-500 mb-2">Quick actions:</p>
                    <div className="flex flex-wrap gap-2">
                        {connectedApps.flatMap((app) =>
                            (quickActions[app] || []).map((qa) => (
                                <button
                                    key={qa.query}
                                    onClick={() => {
                                        if (qa.query.includes("CHAT_ID") || qa.query.endsWith(" ")) {
                                            setInput(qa.query);
                                            inputRef.current?.focus();
                                        } else {
                                            handleSend(qa.query);
                                        }
                                    }}
                                    className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:text-white hover:border-indigo-500/30 hover:bg-indigo-500/10 transition-all"
                                >
                                    {qa.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto glass rounded-2xl p-6 mb-4 space-y-4">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                        <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${msg.role === "user"
                            ? "bg-indigo-500/20 border border-indigo-500/30 text-white"
                            : "bg-slate-800/60 border border-slate-700/30 text-slate-200"
                            }`}>
                            {msg.role === "assistant" && msg.app && (
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <span className="text-sm">{appIcons[msg.app] || "🔌"}</span>
                                    <span className="text-xs text-slate-500 font-medium">{msg.app.charAt(0).toUpperCase() + msg.app.slice(1)}</span>
                                </div>
                            )}
                            <div
                                className="text-sm leading-relaxed whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{ __html: formatText(msg.text) }}
                            />
                            <div className="text-xs text-slate-500 mt-1.5 text-right">
                                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-slate-800/60 border border-slate-700/30 rounded-2xl px-5 py-3">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <div className="glass rounded-2xl p-3 flex items-center gap-3">
                <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedApp
                        ? `Ask about ${selectedApp}...`
                        : "Ask about your emails, send a message..."
                    }
                    className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none px-3 py-2"
                    disabled={loading}
                />
                <button
                    onClick={() => handleSend()}
                    disabled={loading || !input.trim()}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {loading ? "..." : "Send →"}
                </button>
            </div>
        </div>
    );
}
