"use client";

import { create } from "zustand";
import { authApi } from "@/lib/api";

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    email_verified: boolean;
    created_at: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    loading: boolean;
    setUser: (user: User | null) => void;
    setToken: (token: string | null) => void;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => void;
    fetchUser: () => Promise<void>;
    isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    token: typeof window !== "undefined" ? localStorage.getItem("access_token") : null,
    loading: false,

    setUser: (user) => set({ user }),
    setToken: (token) => {
        if (token) {
            localStorage.setItem("access_token", token);
        } else {
            localStorage.removeItem("access_token");
        }
        set({ token });
    },

    login: async (email, password) => {
        set({ loading: true });
        try {
            const res = await authApi.login({ email, password });
            const token = res.data.access_token;
            get().setToken(token);
            await get().fetchUser();
        } finally {
            set({ loading: false });
        }
    },

    register: async (name, email, password) => {
        set({ loading: true });
        try {
            await authApi.register({ name, email, password });
        } finally {
            set({ loading: false });
        }
    },

    logout: () => {
        get().setToken(null);
        set({ user: null });
        window.location.href = "/login";
    },

    fetchUser: async () => {
        try {
            const res = await authApi.getMe();
            set({ user: res.data });
        } catch {
            get().setToken(null);
            set({ user: null });
        }
    },

    isAdmin: () => get().user?.role === "admin",
}));
