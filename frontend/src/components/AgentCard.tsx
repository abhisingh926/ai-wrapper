import Link from "next/link";

interface AgentCardProps {
    agent: any;
    platformIcons?: Record<string, string>;
    onToggleStatus?: (agent: any) => void;
}

const defaultPlatformIcons: Record<string, string> = {
    telegram: "✈️", discord: "🎮", whatsapp: "💬", slack: "💼", web: "🌐", instagram: "📸",
};

export default function AgentCard({ agent, platformIcons = defaultPlatformIcons, onToggleStatus }: AgentCardProps) {
    const isLive = agent.status === "live";
    const isPaused = agent.status === "paused";

    // Status color mapping matching screenshot
    const statusColor = isLive ? "bg-green-500" : (isPaused ? "bg-amber-500" : "bg-slate-500");
    const statusText = isLive ? "LIVE" : (isPaused ? "STOPPED" : "DRAFT");

    const badgeStyle = isLive
        ? "text-emerald-500 border border-emerald-500/30 bg-emerald-500/10"
        : (isPaused ? "text-amber-500 border border-amber-500/30 bg-amber-500/10" : "text-slate-400 border border-slate-500/30 bg-slate-500/10");

    return (
        <div className="relative bg-[#151517] rounded-2xl border border-white/5 overflow-hidden flex flex-col p-6 group hover:border-white/10 transition-colors">
            {/* Left Edge Bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${statusColor}`} />

            {/* Top Row: Title & Badge */}
            <div className="flex justify-between items-start mb-2 pl-2">
                <h3 className="text-lg font-bold text-white tracking-wide">{agent.name}</h3>
                <span className={`text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full ${badgeStyle}`}>
                    {statusText}
                </span>
            </div>

            {/* Subtitle: Device Icon & Provider/Platform */}
            <div className="flex items-center gap-2 mb-6 pl-2">
                <span className="text-slate-400 text-sm grayscale">{platformIcons[agent.platform] || "📱"}</span>
                <span className="text-xs font-bold text-slate-400 tracking-widest uppercase opacity-80">
                    {agent.ai_provider} &bull; {agent.platform}
                </span>
            </div>

            {/* Inner Stats Box */}
            <div className="bg-[#0A0A0B] rounded-xl border border-white/5 p-3.5 flex gap-6 items-center mb-5 mx-1">
                <div className="flex items-center gap-2.5 px-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4 text-blue-400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span className="text-sm font-semibold text-white">{agent.messages_count || 0}</span>
                </div>
                <div className="flex items-center gap-2.5 px-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4 text-emerald-400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                    <span className="text-sm font-semibold text-white">{agent.avg_response_ms || 0}ms</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between mt-auto pt-1">
                {onToggleStatus ? (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            onToggleStatus(agent);
                        }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${isLive
                                ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/30'
                            }`}
                    >
                        {isLive ? '⏸ Pause' : '▶ Start'}
                    </button>
                ) : (
                    <div />
                )}

                <Link
                    href={`/dashboard/agents/${agent.id}`}
                    className="px-5 py-2 bg-[#1C1C1E] border border-white/10 hover:bg-white/10 rounded-lg flex items-center justify-center text-xs font-bold text-white transition-all tracking-wide"
                >
                    Configure →
                </Link>
            </div>
        </div>
    );
}
