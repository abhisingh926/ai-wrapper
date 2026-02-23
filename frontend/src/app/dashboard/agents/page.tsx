"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { agentApi } from "@/lib/api";
import AgentCard from "@/components/AgentCard";

type Agent = {
    id: string;
    name: string;
    ai_provider: string;
    ai_model: string;
    platform: string;
    tools: string[];
    status: string;
    created_at: string;
};



export default function AgentsPage() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAgents();
    }, []);

    const loadAgents = async () => {
        try {
            const res = await agentApi.list();
            setAgents(res.data);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    const handleToggle = async (agent: Agent) => {
        try {
            if (agent.status === "live") {
                await agentApi.pause(agent.id);
            } else {
                await agentApi.deploy(agent.id);
            }
            loadAgents();
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-lg">🤖</span>
                        Your Agents
                    </h1>
                    <p className="text-slate-400 mt-1">{agents.length} agent{agents.length !== 1 ? "s" : ""} created</p>
                </div>
                <Link
                    href="/dashboard/agents/create"
                    className="px-6 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:opacity-90 transition-all flex items-center gap-2"
                >
                    + Create Agent
                </Link>
            </div>

            {/* Empty State */}
            {agents.length === 0 && (
                <div className="glass rounded-2xl p-16 text-center">
                    <div className="text-6xl mb-4">🤖</div>
                    <h2 className="text-xl font-bold text-white mb-2">No agents yet</h2>
                    <p className="text-slate-400 mb-6 max-w-md mx-auto">
                        Create your first AI agent in under a minute. Choose a model, pick a platform, add tools, and deploy!
                    </p>
                    <Link
                        href="/dashboard/agents/create"
                        className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:opacity-90 transition-all"
                    >
                        🚀 Create Your First Agent
                    </Link>
                </div>
            )}

            {/* Agents Grid */}
            {agents.length > 0 && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {agents.map((agent) => (
                        <AgentCard key={agent.id} agent={agent} onToggleStatus={handleToggle} />
                    ))}
                </div>
            )}
        </div>
    );
}
