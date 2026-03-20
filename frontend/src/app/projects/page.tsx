"use client";

import { useRouter } from "next/navigation";

export default function ProjectsPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-[#0E0E11] text-white font-sans selection:bg-indigo-500/30">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E24]">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-[#1C1C21] border border-[#2A2A30] flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-green-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8m0 0V3m0 10l-8-4m8 4l8-4M4 7l8 4m8-4l-8 4M4 17l8 4m8-4l-8 4M4 11l8 4m-8-4v6m16-6l-8 4m8-4v6" />
                        </svg>
                    </div>
                    <span className="font-semibold text-[14px]">Projects</span>
                </div>
                <button className="flex items-center gap-2 text-[13px] text-gray-400 hover:text-white transition-colors group">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0l-3 3m3-3l3 3" />
                    </svg>
                    Switch to Pro
                </button>
            </div>

            <div className="max-w-[1200px] mx-auto px-6 pt-10">
                {/* Capabilities Information Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-white">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-green-500">
                                <circle cx="12" cy="12" r="10" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                            </svg>
                            <span className="font-semibold text-[13px]">Web Apps</span>
                        </div>
                        <p className="text-[13px] text-[#888888] leading-snug pr-4">Standalone apps built with AI. Describe what you want and start building instantly</p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-white">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-green-500">
                                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01" />
                            </svg>
                            <span className="font-semibold text-[13px]">Mobile Apps</span>
                        </div>
                        <p className="text-[13px] text-[#888888] leading-snug pr-4">Native mobile apps built with Expo and React Native, powered by AI</p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-white">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-green-500">
                                <rect x="3" y="11" width="18" height="10" rx="2" />
                                <circle cx="12" cy="5" r="2" />
                                <path d="M12 7v4M8 16h8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="font-semibold text-[13px]">Claw Agents</span>
                        </div>
                        <p className="text-[13px] text-[#888888] leading-snug pr-4">Persistent agents with shared sandbox state across many sessions</p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-white">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-green-500">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                            </svg>
                            <span className="font-semibold text-[13px]">Standard Projects</span>
                        </div>
                        <p className="text-[13px] text-[#888888] leading-snug pr-4">Group repositories together and let AI agents work on tasks</p>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="relative flex-1">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2">
                            <circle cx="11" cy="11" r="8" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                        </svg>
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            className="w-full bg-[#18181B] border border-[#27272A] rounded-lg text-[14px] text-white pl-10 pr-4 py-2 hover:border-[#3F3F46] focus:border-[#3F3F46] focus:outline-none transition-colors placeholder:text-[#666666]"
                        />
                    </div>
                    
                    <button className="flex items-center justify-center p-2.5 rounded-lg border border-[#27272A] bg-[#18181B] hover:border-[#3F3F46] hover:bg-[#27272A] transition-colors text-[#888]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                        </svg>
                    </button>

                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[14px] font-medium transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
                        </svg>
                        New
                    </button>
                </div>

                {/* Projects Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Project Card */}
                    <div 
                        onClick={() => router.push("/dashboard")}
                        className="group bg-[#151518] border border-[#27272A] hover:border-[#3F3F46] rounded-xl flex flex-col p-5 cursor-pointer transition-colors shadow-sm"
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[#111A11] border border-[#223322] flex items-center justify-center shrink-0">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-green-500">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                                    </svg>
                                </div>
                                <div className="flex flex-col">
                                    <h2 className="text-[15px] font-semibold text-white leading-tight mb-0.5">ai-wrapper</h2>
                                    <p className="text-[13px] text-[#888888] leading-tight">Standard Project</p>
                                </div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#1E1E24] text-gray-300 border border-[#2A2A30]">
                                Active
                            </span>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center justify-between text-[#888888] text-[13px] mb-6">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                    </svg>
                                    <span>1 repository</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>1 task</span>
                                </div>
                            </div>
                            <span>7 days ago</span>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-2">
                            <span className="px-2 py-1 rounded bg-[#1C1C21] text-[11px] font-medium text-gray-400">
                                ai-wrapper
                            </span>
                            <div className="flex items-center gap-3 text-[#666666] opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="hover:text-white transition-colors" title="Star project">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                    </svg>
                                </button>
                                <button className="hover:text-white transition-colors" title="Edit project">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                </button>
                                <button className="hover:text-red-500 transition-colors" title="Delete project">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
