"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/hooks/useAuth";

const menuItems = [
    { label: "Dashboard", href: "/dashboard", icon: "🏠" },
    { label: "Agents", href: "/dashboard/agents", icon: "🤖" },
    { label: "Autonomous", href: "/dashboard/autonomous", icon: "⚡" },
    { label: "Billing", href: "/dashboard/billing", icon: "💳" },
    { label: "Profile", href: "/dashboard/profile", icon: "👤" },
];

const adminItems = [
    { label: "Admin Panel", href: "/dashboard/admin", icon: "🛡️" },
];

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, token, fetchUser, logout, isAdmin } = useAuthStore();
    const [authChecked, setAuthChecked] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            // No token at all → redirect immediately
            if (!token) {
                router.replace("/login");
                return;
            }
            // Have token → verify it's still valid
            try {
                await fetchUser();
                setAuthChecked(true);
            } catch {
                // Token is invalid/expired
                router.replace("/login");
            }
        };
        checkAuth();
    }, [token]);

    // Also protect admin routes
    useEffect(() => {
        if (authChecked && pathname.startsWith("/dashboard/admin") && !isAdmin()) {
            router.replace("/dashboard");
        }
    }, [authChecked, pathname]);

    // Show loading while checking auth
    if (!authChecked) {
        return (
            <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-400 text-sm">Verifying session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f172a] flex">
            {/* Sidebar */}
            <aside className="w-64 bg-[#0c1222] border-r border-slate-800 flex flex-col fixed top-0 left-0 h-screen">
                {/* Logo */}
                <div className="p-6 border-b border-slate-800">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm">
                            A
                        </div>
                        <span className="text-lg font-bold text-white">
                            AI<span className="text-indigo-400">Wrapper</span>
                        </span>
                    </Link>
                </div>

                {/* Menu */}
                <nav className="flex-1 p-4 space-y-1">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive
                                        ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                                        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                                    }`}
                            >
                                <span className="text-lg">{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}

                    {isAdmin() && (
                        <>
                            <div className="pt-4 pb-2">
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Admin</div>
                            </div>
                            {adminItems.map((item) => {
                                const isActive = pathname.startsWith(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                      ${isActive
                                                ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                                                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                                            }`}
                                    >
                                        <span className="text-lg">{item.icon}</span>
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </>
                    )}
                </nav>

                {/* User Section */}
                <div className="p-4 border-t border-slate-800">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm">
                            {user?.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{user?.name || "Loading..."}</div>
                            <div className="text-xs text-slate-400 truncate">{user?.email}</div>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="w-full text-left px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                    >
                        ← Log Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 p-8">
                {children}
            </main>
        </div>
    );
}
