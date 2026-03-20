"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { agentApi } from "@/lib/api";

type AIModel = {
    id: string;
    name: string;
    desc?: string;
};

export default function NewProjectPage() {
    const router = useRouter();
    const [prompt, setPrompt] = useState("");
    const [activeTab, setActiveTab] = useState("Web App");
    const [models, setModels] = useState<AIModel[]>([]);
    const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchModels = async () => {
            try {
                const res = await agentApi.availableModels();
                const providers = res.data.providers || [];
                const allModels = providers.flatMap((p: any) => 
                    p.models.filter((m: any) => m.allowed).map((m: any) => ({
                        id: m.id,
                        name: m.name,
                        desc: m.desc
                    }))
                );
                
                setModels(allModels);
                if (allModels.length > 0) {
                    setSelectedModel(allModels[0]);
                }
            } catch (err) {
                console.error("Failed to fetch models", err);
                // Fallback models in case of failure or backend not completely setup for this
                const fallback = [
                    { id: "gpt-4o", name: "GPT-4o", desc: "Most capable" },
                    { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", desc: "Best balanced" }
                ];
                setModels(fallback);
                setSelectedModel(fallback[0]);
            }
        };
        fetchModels();
    }, []);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const tabs = [
        { name: "Web App", icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
            </svg>
        )},
        { name: "Mobile App", icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01" />
            </svg>
        )},
        { name: "AIClaw", icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4M8 16h8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )},
        { name: "From scratch", icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
        )}
    ];

    const tabSuggestions: Record<string, {name: string, prompt: string, icon: JSX.Element}[]> = {
        "Web App": [
            { name: "Task manager", prompt: "A task manager app with drag-and-drop kanban boards, multiple columns, and the ability to create, edit, and delete tasks.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg> },
            { name: "Poll app", prompt: "A real-time polling application where users can create multiple-choice polls, vote anonymously, and see live results update instantly.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><rect x="18" y="3" width="4" height="18"></rect><rect x="10" y="8" width="4" height="13"></rect><rect x="2" y="13" width="4" height="8"></rect></svg> },
            { name: "Recipe collection", prompt: "A beautifully designed recipe collection app where users can browse, search, and save their favorite recipes with ingredients and step-by-step instructions.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg> },
            { name: "Finance tracker", prompt: "A personal finance tracking dashboard to monitor income, expenses, and savings goals with interactive charts and categorization.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M2 22h20"/><path d="M12 2v20"/><path d="M4 12v10"/><path d="M20 7v15"/><path d="M8 17v5"/><path d="M16 12v10"/><path d="M12 2l-8 4"/><path d="M12 2l8 4"/></svg> },
            { name: "Habit tracker", prompt: "A habit tracking application with weekly progress charts, daily check-ins, and streak counters to help users build positive routines.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12"></polyline></svg> },
        ],
        "Mobile App": [
            { name: "Fitness tracker", prompt: "A mobile fitness tracking app that logs daily workouts, tracks running routes using GPS, and displays weekly activity statistics.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg> },
            { name: "Recipe collection", prompt: "A mobile recipe app optimized for tablet and phone screens, featuring offline mode and a built-in interactive cooking timer.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg> },
            { name: "Habit tracker", prompt: "A mobile habit tracker with push notifications for daily reminders and a minimal, gesture-based interface for marking routines complete.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12"></polyline></svg> },
            { name: "Weather app", prompt: "A beautiful mobile weather application that displays current conditions, hourly forecasts, and severe weather alerts based on the user's location.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M17.5 19C19.9853 19 22 16.9853 22 14.5C22 12.1643 20.2198 10.237 17.9363 10.0224C17.3888 6.6433 14.4754 4 11 4C7.13401 4 4 7.13401 4 11C4 11.2014 4.00845 11.401 4.025 11.5985C2.26914 12.1932 1 13.8582 1 15.8333C1 18.1345 2.86548 20 5.16667 20H17.5V19Z"/></svg> },
            { name: "Expense tracker", prompt: "A mobile expense manager with receipt scanning capabilities, budget limits, and quick-add shortcuts for tracking daily spending on the go.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
        ],
        "AIClaw": [
            { name: "Competitive intel", prompt: "An AI agent that monitors competitor websites for pricing changes, new feature announcements, and leadership updates, delivering a weekly summary report.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg> },
            { name: "Sprint planner", prompt: "An AI project management assistant that analyzes team velocity, suggests sprint goals, and automatically drafts tickets based on product requirements.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> },
            { name: "Sales pipeline", prompt: "An AI sales assistant that extracts lead information from incoming emails, scores them based on intent, and drafts personalized follow-up sequences.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg> },
            { name: "Support escalation", prompt: "An AI support triage agent that reads incoming customer tickets, categorizes them by urgency and topic, and escalates critical issues to the correct human team.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> },
            { name: "Content publisher", prompt: "An autonomous AI agent that takes a raw draft, optimizes it for SEO, formats it in Markdown, and schedules it for publishing on a blog and social media.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> },
        ],
        "From scratch": [
            { name: "Landing page", prompt: "A modern, high-converting SaaS landing page with a hero section, feature grid, testimonials carousel, and dynamic pricing tiers.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg> },
            { name: "Admin dashboard", prompt: "A comprehensive internal admin dashboard with user management tables, revenue analytics charts, and system health status indicators.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> },
            { name: "Blog template", prompt: "A minimal, typography-focused blog template with Markdown support, categories, author profiles, and dark mode toggle.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg> },
            { name: "E-commerce store", prompt: "A custom e-commerce storefront with a product catalog, shopping cart, integrated checkout flow, and user order history.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg> },
            { name: "Portfolio site", prompt: "A creative portfolio website to showcase design projects, featuring smooth scrolling, hover animations, and a contact form.", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline><polyline points="7.5 19.79 7.5 14.6 3 12"></polyline><polyline points="21 12 16.5 14.6 16.5 19.79"></polyline><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg> },
        ]
    };

    const currentSuggestions = tabSuggestions[activeTab] || [];

    return (
        <div className="min-h-screen bg-[#13141A] text-white font-sans selection:bg-indigo-500/30 flex flex-col">
            {/* Top Bar */}
            <div className="flex justify-end p-6 w-full absolute top-0">
                <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0l-3 3m3-3l3 3" />
                    </svg>
                    Switch to Pro
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center pt-32 pb-12 px-6">
                <h1 className="text-[32px] font-bold tracking-tight mb-8">What do you want to build?</h1>

                {/* Tabs */}
                <div className="flex bg-[#1E1F25] p-1.5 rounded-xl border border-[#272831] mb-6">
                    {tabs.map((tab) => (
                        <button
                            key={tab.name}
                            onClick={() => setActiveTab(tab.name)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[14px] font-medium transition-colors ${
                                activeTab === tab.name 
                                    ? "bg-[#25262D] text-[#4ade80] shadow-sm" 
                                    : "text-gray-400 hover:text-white hover:bg-[#25262D]/50"
                            }`}
                        >
                            <span className={activeTab === tab.name ? "text-[#4ade80]" : "text-gray-500"}>
                                {tab.icon}
                            </span>
                            {tab.name}
                        </button>
                    ))}
                </div>

                {/* Main Input Card */}
                <div className="w-full max-w-[800px] bg-[#1C1D23] border border-[#2D2E36] rounded-2xl flex flex-col focus-within:border-[#4B4D57] focus-within:ring-1 focus-within:ring-[#4B4D57] transition-all shadow-lg overflow-hidden relative">
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe an app — e.g. a habit tracker with weekly charts"
                        className="w-full bg-transparent text-white placeholder:text-[#52525B] text-[16px] resize-none h-48 focus:outline-none p-6 font-mono leading-relaxed"
                    />

                    {/* Bottom Toolbar */}
                    <div className="flex items-center justify-between p-4 bg-[#1C1D23]">
                        <div className="flex items-center gap-4 pl-2">
                            {/* Dynamic Model Selector Dropdown */}
                            <div className="relative" ref={dropdownRef}>
                                <button 
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="flex items-center gap-1.5 text-[13px] font-medium text-gray-400 hover:text-white transition-colors"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-green-500">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                    {selectedModel ? selectedModel.name : "Auto model"}
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-3.5 h-3.5 ml-0.5 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                
                                {isDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-2 w-64 bg-[#1E1F25] border border-[#2D2E36] rounded-xl shadow-xl z-50 overflow-hidden py-1">
                                        {models.length > 0 ? (
                                            models.map((model) => (
                                                <button
                                                    key={model.id}
                                                    onClick={() => {
                                                        setSelectedModel(model);
                                                        setIsDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-2.5 text-[13px] flex flex-col hover:bg-[#25262D] transition-colors ${selectedModel?.id === model.id ? 'bg-[#25262D]/50 text-white' : 'text-gray-300'}`}
                                                >
                                                    <span className="font-medium text-white">{model.name}</span>
                                                    {model.desc && <span className="text-[11px] text-gray-500 mt-0.5">{model.desc}</span>}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-4 py-3 text-[13px] text-gray-500">No models available.</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <button className="text-gray-400 hover:text-white transition-colors p-1" title="Attach file">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                            </button>
                        </div>
                        <button 
                            disabled={!prompt.trim()}
                            className="bg-[#4338ca] hover:bg-[#4f46e5] text-white disabled:bg-[#312e81] disabled:text-indigo-300 disabled:cursor-not-allowed flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-medium transition-colors shadow-sm"
                        >
                            Start building
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Suggestions */}
                <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                    {currentSuggestions.map((sug) => (
                        <button 
                            key={sug.name}
                            onClick={() => setPrompt(sug.prompt)}
                            className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#2D2E36] bg-[#1C1D23] hover:bg-[#25262D] text-gray-400 hover:text-white text-[13px] transition-colors"
                        >
                            {sug.icon}
                            {sug.name}
                        </button>
                    ))}
                </div>

                {/* Divider */}
                <div className="w-full max-w-[800px] flex items-center justify-center gap-4 mt-10 mb-8">
                    <div className="h-px bg-[#2D2E36] flex-1"></div>
                    <span className="text-[12px] text-gray-500 uppercase font-medium tracking-wide">Or</span>
                    <div className="h-px bg-[#2D2E36] flex-1"></div>
                </div>

                {/* Create Empty Project Card */}
                <button className="group w-full max-w-[800px] bg-transparent border border-[#2D2E36] hover:border-[#3F3F46] hover:bg-[#1A1B20] rounded-xl p-4 flex items-center gap-4 transition-all text-left">
                    <div className="w-12 h-12 rounded-lg bg-[#111A11] border border-[#223322] flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-[#4ade80]">
                            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                        </svg>
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[15px] font-semibold text-white group-hover:text-blue-400 transition-colors">Create an empty project</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#111A11] text-[#4ade80] border border-[#223322]">Advanced</span>
                        </div>
                        <span className="text-[13px] text-gray-500">Work on your repos — hosted here or linked from GitHub</span>
                    </div>
                </button>

                {/* Back Link */}
                <button onClick={() => router.push("/dashboard/coding-agent")} className="mt-8 flex items-center gap-2 text-[13px] text-gray-500 hover:text-gray-300 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7l-7 7 7 7" />
                    </svg>
                    Back to projects
                </button>
            </div>
        </div>
    );
}
