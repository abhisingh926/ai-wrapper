"use client";

import { useState, useRef, useEffect } from "react";
import api from "@/lib/api";

type Message = {
    role: "user" | "assistant" | "system";
    content: string;
};

interface TestAgentChatProps {
    agentId: string;
    agentName: string;
    botDisplayName?: string;
    themeColor?: string;
    removeBranding?: boolean;
    isOpen: boolean;
    onClose: () => void;
}

export default function TestAgentChat({ agentId, agentName, botDisplayName, themeColor = "#6366f1", removeBranding = false, isOpen, onClose }: TestAgentChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [sessionLoaded, setSessionLoaded] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    // Load existing session when chat opens
    useEffect(() => {
        if (isOpen && !sessionLoaded) {
            loadSession();
        }
    }, [isOpen]);

    const loadSession = async () => {
        try {
            const res = await api.get(`/api/agents/${agentId}/chat/session`);
            const sessionMessages: Message[] = res.data.messages || [];

            if (sessionMessages.length > 0) {
                setMessages(sessionMessages);
            } else {
                setMessages([
                    { role: "assistant", content: `Hi! I am ${botDisplayName || agentName}. How can I help you today?` }
                ]);
            }
            setSessionLoaded(true);
        } catch (err) {
            console.error("Failed to load chat session:", err);
            setMessages([
                { role: "assistant", content: `Hi! I am ${botDisplayName || agentName}. How can I help you today?` }
            ]);
            setSessionLoaded(true);
        }
    };

    const handleClearChat = async () => {
        try {
            await api.delete(`/api/agents/${agentId}/chat/session`);
            setMessages([
                { role: "assistant", content: `Hi! I am ${botDisplayName || agentName}. How can I help you today?` }
            ]);
            setSessionLoaded(true);
        } catch (err) {
            console.error("Failed to clear chat session:", err);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput("");

        const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
        setMessages(newMessages);
        setLoading(true);

        try {
            // Send ALL messages so the backend has context for LLM
            const payload = newMessages.filter(m => m.role !== "system");

            const res = await api.post(`/api/agents/${agentId}/chat`, { messages: payload });

            setMessages([...newMessages, { role: "assistant", content: res.data.reply }]);
        } catch (error: any) {
            console.error("Chat error:", error);
            setMessages([...newMessages, {
                role: "assistant",
                content: `Error: ${error.response?.data?.detail || "Failed to communicate with the agent."}`
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Slide-out panel */}
            <div className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-[#1C1C1E] border-l border-slate-700/50 shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-[#1C1C1E]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-inner border border-white/10" style={{ backgroundColor: themeColor }}>
                            🤖
                        </div>
                        <div>
                            <h2 className="text-white font-semibold text-lg leading-tight">{botDisplayName || agentName}</h2>
                            <p className="text-xs text-indigo-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-0.5"></span>
                                Testing {botDisplayName || agentName}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleClearChat}
                            className="text-slate-500 hover:text-orange-400 p-2 rounded-lg hover:bg-slate-800 transition-colors text-xs"
                            title="Clear chat & start fresh"
                        >
                            🗑 Clear
                        </button>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-[#1C1C1E] to-[#161618]">
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === "user"
                                    ? "text-white rounded-br-sm"
                                    : "bg-slate-800 text-slate-200 border border-slate-700/50 rounded-bl-sm"
                                    } whitespace-pre-wrap leading-relaxed`}
                                style={msg.role === "user" ? { backgroundColor: themeColor } : {}}
                            >
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-slate-800 text-slate-400 border border-slate-700/50 rounded-2xl rounded-bl-sm px-5 py-3.5 shadow-sm">
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                                    <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                                    <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "300ms" }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-[#1C1C1E] border-t border-slate-800">
                    <div className="relative flex items-center group">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none disabled:opacity-50 min-h-[50px] max-h-[120px]"
                            rows={1}
                            disabled={loading}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || loading}
                            style={{ backgroundColor: themeColor }}
                            className="absolute right-2 p-2 text-white rounded-lg disabled:opacity-50 transition-all flex items-center justify-center transform active:scale-95 hover:opacity-90"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 translate-x-[1px] translate-y-[-1px]">
                                <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                            </svg>
                        </button>
                    </div>
                    {!removeBranding && (
                        <div className="text-center mt-2">
                            <span className="text-[10px] text-slate-500 font-medium">✨ Powered by AI Wrapper Testing Sandbox</span>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
