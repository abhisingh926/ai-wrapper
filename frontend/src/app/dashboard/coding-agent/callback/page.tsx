"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

function CallbackContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("");

    useEffect(() => {
        const code = searchParams.get("code");
        const state = searchParams.get("state");

        if (!code || !state) {
            setStatus("error");
            setMessage("Missing authorization code or state parameter.");
            return;
        }

        // Exchange the code for a token via backend
        const exchangeCode = async () => {
            try {
                const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                const resp = await fetch(`${API_BASE}/api/coding-agent/oauth/callback`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code, state }),
                });

                if (!resp.ok) {
                    const err = await resp.json();
                    throw new Error(err.detail || "Failed to connect");
                }

                const data = await resp.json();
                setStatus("success");
                setMessage(data.message || "Connected successfully!");

                // Redirect back to coding agent page after a short delay
                setTimeout(() => {
                    router.push("/dashboard/coding-agent");
                }, 2000);
            } catch (err: any) {
                setStatus("error");
                setMessage(err.message || "Something went wrong during authentication.");
            }
        };

        exchangeCode();
    }, [searchParams, router]);

    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-[#0c1222] border border-slate-800 rounded-2xl p-8 text-center max-w-md w-full">
                {status === "loading" && (
                    <>
                        <div className="w-12 h-12 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2">Connecting...</h2>
                        <p className="text-slate-400 text-sm">Exchanging authorization with your provider.</p>
                    </>
                )}
                {status === "success" && (
                    <>
                        <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✅</div>
                        <h2 className="text-xl font-bold text-white mb-2">Connected!</h2>
                        <p className="text-slate-400 text-sm">{message}</p>
                        <p className="text-slate-500 text-xs mt-3">Redirecting to Coding Agent...</p>
                    </>
                )}
                {status === "error" && (
                    <>
                        <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">❌</div>
                        <h2 className="text-xl font-bold text-white mb-2">Connection Failed</h2>
                        <p className="text-red-400 text-sm mb-4">{message}</p>
                        <button
                            onClick={() => router.push("/dashboard/coding-agent")}
                            className="px-6 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-700 transition-colors"
                        >
                            Back to Coding Agent
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

export default function CodingAgentCallbackPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <CallbackContent />
        </Suspense>
    );
}
