"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/hooks/useAuth";
import { billingApi, agentApi } from "@/lib/api";
import AgentCard from "@/components/AgentCard";

export default function DashboardHome() {
    const { user } = useAuthStore();
    const [stats, setStats] = useState({
        totalAgents: 0,
        agentLimit: 1,
        messagesUsed: 0,
        messageLimit: 500,
        plan: "free",
        totalErrors: 0,
    });
    const [recentAgents, setRecentAgents] = useState<any[]>([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [agentsRes, subRes] = await Promise.all([
                    agentApi.list().catch(() => ({ data: [] })),
                    billingApi.subscription().catch(() => ({ data: { message_limit: 500, messages_used: 0, agent_limit: 1, plan: "free" } }))
                ]);
                const agents = agentsRes.data;
                const sub = subRes.data;
                const totalErrors = Array.isArray(agents)
                    ? agents.reduce((acc: number, a: any) => acc + (a.errors_count || 0), 0)
                    : 0;
                setStats({
                    totalAgents: Array.isArray(agents) ? agents.length : 0,
                    agentLimit: sub.agent_limit || 1,
                    messagesUsed: sub.messages_used || 0,
                    messageLimit: sub.message_limit || 500,
                    plan: sub.plan || "free",
                    totalErrors,
                });
                setRecentAgents(Array.isArray(agents) ? agents.slice(0, 6) : []);
            } catch {
                // Use defaults on error
            }
        };
        loadData();
    }, []);

    const handleToggle = async (agent: any) => {
        try {
            if (agent.status === "live") {
                await agentApi.pause(agent.id);
            } else {
                await agentApi.deploy(agent.id);
            }
            const res = await agentApi.list();
            setRecentAgents(Array.isArray(res.data) ? res.data.slice(0, 6) : []);
        } catch (err) {
            console.error(err);
        }
    };

    const statCards = [
        { label: "Active Agents", value: `${stats.totalAgents} / ${stats.agentLimit}`, icon: "🤖", color: "from-indigo-500/20 to-indigo-600/20", border: "border-indigo-500/10" },
        { label: "Messages Used", value: `${stats.messagesUsed} / ${stats.messageLimit}`, icon: "💬", color: "from-cyan-500/20 to-cyan-600/20", border: "border-cyan-500/10" },
        { label: "Current Plan", value: stats.plan.charAt(0).toUpperCase() + stats.plan.slice(1), icon: "💎", color: "from-emerald-500/20 to-emerald-600/20", border: "border-emerald-500/10" },
        { label: "Total Errors", value: stats.totalErrors, icon: "⚠️", color: "from-amber-500/20 to-amber-600/20", border: "border-amber-500/10" },
    ];

    return (
        <div>
            {/* Welcome */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">
                    Welcome back, <span className="text-gradient">{user?.name || "User"}</span> 👋
                </h1>
                <p className="text-slate-400">Here&apos;s an overview of your automation hub.</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {statCards.map((card) => (
                    <div
                        key={card.label}
                        className={`bg-gradient-to-br ${card.color} rounded-2xl p-6 border border-white/5
              hover:border-indigo-500/30 transition-all duration-300`}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-2xl">{card.icon}</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{card.value}</div>
                        <div className="text-sm text-slate-400 mt-1">{card.label}</div>
                    </div>
                ))}
            </div>

            {/* Recent Agents */}
            <div className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-white">Your Recent Agents</h2>
                    <Link href="/dashboard/agents" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                        View All →
                    </Link>
                </div>

                {recentAgents.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-4xl mb-3">🤖</div>
                        <p className="text-slate-400 mb-4">No agents yet. Create your first one!</p>
                        <Link href="/dashboard/agents/create" className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:opacity-90 inline-block transition-all">
                            Create Agent
                        </Link>
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {recentAgents.map((agent: any) => (
                            <AgentCard key={agent.id} agent={agent} onToggleStatus={handleToggle} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
