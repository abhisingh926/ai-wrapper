"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/hooks/useAuth";
import { Suspense } from "react";

function CallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { setToken } = useAuthStore();
    const [error, setError] = useState("");

    useEffect(() => {
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const errorParam = searchParams.get("error");

        if (errorParam) {
            setError(`Google login was denied: ${errorParam}`);
            return;
        }

        if (!code) {
            setError("Missing authorization code. Please try again.");
            return;
        }

        const exchangeCode = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                const resp = await fetch(`${apiUrl}/api/auth/oauth/callback`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code, state: state || "google" }),
                });

                const data = await resp.json();

                if (!resp.ok) {
                    throw new Error(data.detail || `OAuth login failed (${resp.status})`);
                }

                setToken(data.access_token);
                router.push("/projects");
            } catch (err: any) {
                if (err.name === "TypeError" && err.message === "Failed to fetch") {
                    setError("Cannot connect to the server. Please make sure the backend is running on port 8000.");
                } else {
                    setError(err.message || "Something went wrong. Please try again.");
                }
            }
        };

        exchangeCode();
    }, [searchParams, router, setToken]);

    return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6">
            <div className="w-full max-w-sm glass rounded-2xl p-8 text-center">
                {error ? (
                    <>
                        <div className="text-4xl mb-4">⚠️</div>
                        <h1 className="text-xl font-bold text-white mb-2">Login Failed</h1>
                        <p className="text-slate-400 mb-6 text-sm">{error}</p>
                        <a href="/login" className="btn-primary inline-block text-sm">
                            Back to Login
                        </a>
                    </>
                ) : (
                    <>
                        <svg className="animate-spin h-10 w-10 text-indigo-400 mx-auto mb-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <h1 className="text-xl font-bold text-white mb-2">Signing you in...</h1>
                        <p className="text-slate-400 text-sm">Completing authentication with Google.</p>
                    </>
                )}
            </div>
        </div>
    );
}

export default function OAuthCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
                <svg className="animate-spin h-10 w-10 text-indigo-400" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            </div>
        }>
            <CallbackContent />
        </Suspense>
    );
}
