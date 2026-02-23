"use client";

import { useEffect, useState } from "react";
import { billingApi, agentApi } from "@/lib/api";
import { useAuthStore } from "@/hooks/useAuth";

const PLANS = [
    {
        key: "starter",
        name: "Starter",
        priceINR: "₹1,499",
        priceUSD: "$19",
        period: "/month",
        features: [
            "2 AI Agents",
            "5,000 platform messages / month",
            "Unlimited messages (BYOK)",
        ],
        cta: "Upgrade to Starter",
    },
    {
        key: "growth",
        name: "Growth",
        priceINR: "₹3,999",
        priceUSD: "$49",
        period: "/month",
        features: [
            "5 AI Agents",
            "10,000 platform messages / month",
            "Unlimited messages (BYOK)",
        ],
        cta: "Upgrade to Growth",
    },
    {
        key: "business",
        name: "Business",
        priceINR: "₹9,999",
        priceUSD: "$129",
        period: "/month",
        features: [
            "10 AI Agents",
            "20,000 platform messages / month",
            "Unlimited messages (BYOK)",
        ],
        cta: "Upgrade to Business",
    },
];

export default function BillingPage() {
    const { user } = useAuthStore();
    const isAdmin = user?.role === "admin";

    const [currency, setCurrency] = useState<"INR" | "USD">("INR");
    const [subscription, setSubscription] = useState<any>(null);
    const [agentsCount, setAgentsCount] = useState<number>(0);
    const [upgrading, setUpgrading] = useState("");

    const loadData = async () => {
        try {
            const [subRes, agentsRes] = await Promise.all([
                billingApi.subscription().catch(() => ({ data: null })),
                agentApi.list().catch(() => ({ data: [] }))
            ]);
            setSubscription(subRes.data);
            setAgentsCount(agentsRes.data.length || 0);
        } catch { }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleUpgrade = async (plan: string) => {
        setUpgrading(plan);
        try {
            const res = await billingApi.checkout(plan);
            if (res.data.checkout_url) {
                window.location.href = res.data.checkout_url;
            } else {
                await loadData();
            }
        } catch { }
        setUpgrading("");
    };

    return (
        <div className="max-w-4xl mx-auto pb-12 mt-4 px-2">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <h1 className="text-xl font-bold text-white tracking-tight">Billing & Plans</h1>

                {/* Currency Toggle */}
                <div className="flex bg-[#141415] rounded-full p-1 border border-slate-800/80 shadow-inner">
                    <button
                        onClick={() => setCurrency("INR")}
                        className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-all ${currency === "INR" ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-slate-400 hover:text-white"}`}
                    >
                        INR ₹
                    </button>
                    <button
                        onClick={() => setCurrency("USD")}
                        className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-all ${currency === "USD" ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-slate-400 hover:text-white"}`}
                    >
                        USD $
                    </button>
                </div>
            </div>

            {/* Current Plan Section */}
            <div className="bg-[#1C1C1E]/30 border border-slate-700/50 rounded-xl p-6 mb-6 backdrop-blur-sm">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex gap-3">
                        <div className="mt-1">
                            <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-[15px] font-semibold text-white">Current Plan</h2>
                            <p className="text-[13px] text-slate-400 mt-0.5">Your subscription details</p>
                            <div className="mt-4">
                                <span className="inline-block px-3 py-1 bg-slate-800 text-[11px] font-medium text-slate-300 rounded-full border border-slate-700 capitalize">
                                    {isAdmin ? "Admin (Unlimited)" : subscription?.plan || "Free"}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right flex items-baseline">
                        <span className="text-3xl font-extrabold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mr-1">
                            {currency === "INR" ? "₹0" : "$0"}
                        </span>
                        <span className="text-[12px] font-medium text-slate-500">/month</span>
                    </div>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3.5 gap-x-8 mt-5 pl-2 border-t border-slate-800/60 pt-6">
                    {[
                        "1 AI Agent",
                        "500 platform messages / month",
                        "Web Widget channel",
                        "Flash / Mini models",
                        "Basic Q&A (No Tools)",
                        "Community support"
                    ].map((feat, i) => (
                        <div key={i} className="flex items-center gap-3 text-[13px] text-slate-400">
                            <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            {feat}
                        </div>
                    ))}
                </div>
            </div>

            {/* Usage This Month Section */}
            <div className="bg-[#1C1C1E]/30 border border-slate-700/50 rounded-xl p-6 mb-8 backdrop-blur-sm">
                <div className="flex gap-2.5 items-center mb-6 pl-1">
                    <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <h2 className="text-[15px] font-semibold text-white">Usage This Month</h2>
                </div>

                <div className="space-y-6">
                    {/* Instances */}
                    <div>
                        <div className="flex justify-between text-[12.5px] font-medium text-slate-300 mb-2">
                            <span>Instances</span>
                            <span className="text-slate-400">
                                {isAdmin ? (
                                    <span className="text-indigo-400">{agentsCount} / ∞</span>
                                ) : (
                                    `${agentsCount} / ${subscription?.agent_limit || 1}`
                                )}
                            </span>
                        </div>
                        <div className="w-full bg-[#1e293b]/50 rounded-full h-1.5 border border-slate-700/50 overflow-hidden relative">
                            {isAdmin ? (
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full w-full opacity-60 bg-[length:200%_auto] animate-gradient"></div>
                            ) : (
                                <div
                                    className="bg-indigo-500 h-full rounded-full opacity-60 transition-all duration-500"
                                    style={{ width: `${Math.min(100, (agentsCount / Math.max(1, subscription?.agent_limit || 1)) * 100)}%` }}
                                ></div>
                            )}
                        </div>
                    </div>
                    {/* Messages */}
                    <div>
                        <div className="flex justify-between text-[12.5px] font-medium text-slate-300 mb-2">
                            <span>Messages This Month</span>
                            <span className="text-slate-400">
                                {isAdmin ? (
                                    <span className="text-emerald-400">{subscription?.messages_used || 0} / ∞</span>
                                ) : (
                                    `${subscription?.messages_used || 0} / ${subscription?.message_limit || 500}`
                                )}
                            </span>
                        </div>
                        <div className="w-full bg-[#1e293b]/50 rounded-full h-1.5 border border-slate-700/50 overflow-hidden relative">
                            {isAdmin ? (
                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 rounded-full w-full opacity-60 bg-[length:200%_auto] animate-gradient"></div>
                            ) : (
                                <div
                                    className="bg-emerald-500 h-full rounded-full opacity-60 transition-all duration-500"
                                    style={{ width: `${Math.min(100, ((subscription?.messages_used || 0) / Math.max(1, subscription?.message_limit || 500)) * 100)}%` }}
                                ></div>
                            )}
                        </div>
                    </div>
                    {/* Storage */}
                    <div>
                        <div className="flex justify-between text-[12.5px] font-medium text-slate-300 mb-2">
                            <span>Storage</span>
                            <span className="text-slate-400">
                                {isAdmin ? (
                                    <span className="text-cyan-400">0 MB / ∞</span>
                                ) : (
                                    "0 MB / 50 MB"
                                )}
                            </span>
                        </div>
                        <div className="w-full bg-[#1e293b]/50 rounded-full h-1.5 border border-slate-700/50 overflow-hidden relative">
                            {isAdmin ? (
                                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 rounded-full w-full opacity-60 bg-[length:200%_auto] animate-gradient"></div>
                            ) : (
                                <div className="bg-cyan-500 h-full rounded-full w-[2%] opacity-60"></div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                {PLANS.map((plan) => (
                    <div key={plan.key} className="bg-[#1C1C1E]/30 border border-slate-700/50 rounded-xl p-6 flex flex-col backdrop-blur-sm transition-all hover:border-slate-600/60 hover:bg-[#1C1C1E]/50">
                        <h3 className="text-[14.5px] font-bold text-white tracking-wide">{plan.name}</h3>
                        <div className="text-[12.5px] font-medium text-slate-400 mt-1 mb-6">
                            {currency === "INR" ? plan.priceINR : plan.priceUSD}{plan.period}
                        </div>

                        <div className="flex-1 space-y-3.5 mb-8">
                            {plan.features.map((f, i) => (
                                <div key={i} className="flex items-start gap-3 text-[12px] text-slate-400 leading-tight">
                                    <svg className="w-[14px] h-[14px] text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                    {f}
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => handleUpgrade(plan.key)}
                            disabled={!!upgrading}
                            className="w-full py-2.5 rounded-lg text-[13px] font-semibold bg-white hover:bg-slate-200 text-black transition-all shadow-sm disabled:opacity-50 mt-auto"
                        >
                            {upgrading === plan.key ? "Processing..." : plan.cta}
                        </button>
                    </div>
                ))}
            </div>

            {/* Invoice History */}
            <div className="bg-[#1C1C1E]/30 border border-slate-700/50 rounded-xl p-6 backdrop-blur-sm">
                <h2 className="text-[15px] font-semibold text-white">Invoice History</h2>
                <p className="text-[13px] text-slate-400 mt-0.5 mb-6">Your billing history</p>

                <div className="text-[12.5px] text-slate-500 py-3 border-t border-slate-800/60 mt-2">
                    No invoices yet.
                </div>
            </div>
        </div>
    );
}
