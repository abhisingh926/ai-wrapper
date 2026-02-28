"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/hooks/useAuth";
import { profileApi, billingApi } from "@/lib/api";

export default function ProfilePage() {
    const { user, fetchUser } = useAuthStore();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");

    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });
    const [subscription, setSubscription] = useState<any>(null);

    useEffect(() => {
        if (user) {
            setName(user.name);
            setEmail(user.email);
        }
        loadSubscription();
    }, [user]);

    const loadSubscription = async () => {
        try {
            const res = await billingApi.subscription();
            setSubscription(res.data);
        } catch { }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ type: "", text: "" });
        try {
            await profileApi.update({ name, email });
            await fetchUser();
            setMessage({ type: "success", text: "Profile updated successfully" });
        } catch (err: any) {
            setMessage({ type: "error", text: err.response?.data?.detail || "Update failed" });
        }
        setSaving(false);
    };



    return (
        <div className="max-w-2xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Profile</h1>
                <p className="text-slate-400">Manage your account settings.</p>
            </div>

            {message.text && (
                <div className={`mb-6 p-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-500/10 border border-green-500/30 text-green-400"
                    : "bg-red-500/10 border border-red-500/30 text-red-400"
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Profile Info */}
            <div className="glass rounded-2xl p-6 mb-6">
                <h2 className="text-lg font-semibold text-white mb-4">Personal Information</h2>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm" />
                    </div>
                    <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-50">
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </form>
            </div>



            {/* Subscription Badge */}
            {subscription && (
                <div className="glass rounded-2xl p-6 mb-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Subscription</h2>
                    <div className="flex items-center gap-4">
                        <div className="px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
                            <div className="text-sm font-bold text-indigo-300 capitalize">{subscription.plan} Plan</div>
                        </div>
                        <div className="text-sm text-slate-400">
                            {subscription.runs_used}/{subscription.monthly_run_limit} runs used
                        </div>
                    </div>
                </div>
            )}

            {/* Danger Zone */}
            <div className="rounded-2xl p-6 border border-red-500/20 bg-red-500/5">
                <h2 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h2>
                <p className="text-sm text-slate-400 mb-4">Permanently delete your account and all data.</p>
                <button
                    onClick={async () => {
                        if (confirm("Are you SURE? This cannot be undone.")) {
                            await profileApi.delete();
                            window.location.href = "/";
                        }
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all"
                >
                    Delete Account
                </button>
            </div>
        </div>
    );
}
