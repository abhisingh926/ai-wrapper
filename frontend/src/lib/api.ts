import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
    baseURL: API_BASE,
    headers: {
        "Content-Type": "application/json",
    },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("access_token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// Handle 401 responses
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && typeof window !== "undefined") {
            localStorage.removeItem("access_token");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

/* ──── Auth API ──── */
export const authApi = {
    register: (data: { name: string; email: string; password: string }) =>
        api.post("/api/auth/register", data),
    login: (data: { email: string; password: string }) =>
        api.post("/api/auth/login", data),
    getMe: () => api.get("/api/auth/me"),
    forgotPassword: (email: string) =>
        api.post("/api/auth/forgot-password", { email }),
    resetPassword: (data: { token: string; new_password: string }) =>
        api.post("/api/auth/reset-password", data),
    verify: (token: string) => api.get(`/api/auth/verify?token=${token}`),
};

/* ──── Workflow API ──── */
export const workflowApi = {
    list: () => api.get("/api/workflows"),
    get: (id: string) => api.get(`/api/workflows/${id}`),
    create: (data: any) => api.post("/api/workflows", data),
    update: (id: string, data: any) => api.put(`/api/workflows/${id}`, data),
    delete: (id: string) => api.delete(`/api/workflows/${id}`),
    activate: (id: string) => api.post(`/api/workflows/${id}/activate`),
    pause: (id: string) => api.post(`/api/workflows/${id}/pause`),
    executions: (id: string) => api.get(`/api/workflows/${id}/executions`),
};

/* ──── Integration API ──── */
export const integrationApi = {
    list: (category?: string) =>
        api.get("/api/integrations", { params: category ? { category } : {} }),
    get: (slug: string) => api.get(`/api/integrations/${slug}`),
    connect: (slug: string, credentials: any) =>
        api.post(`/api/integrations/${slug}/connect`, { credentials }),
    disconnect: (slug: string) =>
        api.delete(`/api/integrations/${slug}/disconnect`),
    connected: () => api.get("/api/integrations/connected"),
    actions: (slug: string) => api.get(`/api/integrations/${slug}/actions`),
    telegramTest: (chat_id: string, message: string) =>
        api.post("/api/integrations/telegram/test", { chat_id, message }),
};

/* ──── Billing API ──── */
export const billingApi = {
    plans: () => api.get("/api/billing/plans"),
    subscription: () => api.get("/api/billing/subscription"),
    checkout: (plan: string) => api.post("/api/billing/checkout", { plan }),
    cancel: () => api.post("/api/billing/cancel"),
    invoices: () => api.get("/api/billing/invoices"),
};

/* ──── Profile API ──── */
export const profileApi = {
    get: () => api.get("/api/profile"),
    update: (data: any) => api.put("/api/profile", data),
    changePassword: (data: { current_password: string; new_password: string }) =>
        api.put("/api/profile/password", data),
    delete: () => api.delete("/api/profile"),
};

/* ──── Admin API ──── */
export const adminApi = {
    users: (params?: { search?: string; limit?: number; offset?: number }) =>
        api.get("/api/admin/users", { params }),
    blockUser: (id: string) => api.put(`/api/admin/users/${id}/block`),
    changeRole: (id: string, role: string) => api.put(`/api/admin/users/${id}/role`, { role }),
    resetQuota: (id: string) => api.put(`/api/admin/users/${id}/reset-quota`),
    analytics: () => api.get("/api/admin/analytics"),
    subscriptions: () => api.get("/api/admin/subscriptions"),
    // Global API Keys
    getApiKeys: () => api.get("/api/admin/api-keys"),
    saveApiKey: (slug: string, api_key: string) =>
        api.post("/api/admin/api-keys", { slug, api_key }),
    deleteApiKey: (slug: string) => api.delete(`/api/admin/api-keys/${slug}`),
    // Usage tracking
    usage: () => api.get("/api/admin/usage"),
    // Pricing management
    getPricing: () => api.get("/api/admin/pricing"),
    updatePricing: (planKey: string, data: any) =>
        api.put(`/api/admin/pricing/${planKey}`, data),
    // Tools management
    getTools: () => api.get("/api/admin/tools"),
    createTool: (data: any) => api.post("/api/admin/tools", data),
    updateTool: (id: string, data: any) => api.put(`/api/admin/tools/${id}`, data),
    deleteTool: (id: string) => api.delete(`/api/admin/tools/${id}`),

    // Channels
    channels: () => api.get("/api/admin/channels"),
    createChannel: (data: any) => api.post("/api/admin/channels", data),
    updateChannel: (id: string, data: any) => api.put(`/api/admin/channels/${id}`, data),
    deleteChannel: (id: string) => api.delete(`/api/admin/channels/${id}`),
    seedChannels: () => api.post("/api/admin/channels/seed"),

    // AI Model Access Control
    getModels: () => api.get("/api/admin/models"),
    updateModels: (config: any) => api.put("/api/admin/models", config),

    // Platform Settings
    getSettings: () => api.get("/api/admin/settings"),
    updateSettings: (data: any) => api.put("/api/admin/settings", data),

    // Autonomous Skills
    getSkills: () => api.get("/api/admin/skills"),
    createSkill: (data: any) => api.post("/api/admin/skills", data),
    updateSkill: (id: string, data: any) => api.put(`/api/admin/skills/${id}`, data),
    deleteSkill: (id: string) => api.delete(`/api/admin/skills/${id}`),
    seedSkills: () => api.post("/api/admin/skills/seed"),
};

/* ──── Assistant API ──── */
export const assistantApi = {
    query: (message: string, app?: string) =>
        api.post("/api/assistant/query", { message, app }),
    generatePrompt: (description: string) =>
        api.post("/api/assistant/generate-prompt", { description }),
};

/* ──── Public Tools API ──── */
export const toolsApi = {
    list: () => api.get("/api/tools"),
};

/* ──── Public Channels API ──── */
export const channelsApi = {
    list: () => api.get("/api/channels"),
};

/* ──── Public Landing Settings API ──── */
export const landingApi = {
    getSettings: () => api.get("/api/landing-settings"),
};

/* ──── Public Skills API ──── */
export const skillsApi = {
    list: () => api.get("/api/skills"),
    getConfig: (skillId: string) => api.get(`/api/skills/${skillId}/config`),
    saveConfig: (skillId: string, data: any) => api.post(`/api/skills/${skillId}/config`, data),
    test: (skillId: string, data: any) => api.post(`/api/skills/${skillId}/test`, data),
    getLogs: (skillId: string) => api.get(`/api/skills/${skillId}/logs`),
};

/* ──── Agents API ──── */
export const agentApi = {
    list: () => api.get("/api/agents"),
    get: (id: string) => api.get(`/api/agents/${id}`),
    create: (data: any) => api.post("/api/agents", data),
    update: (id: string, data: any) => api.put(`/api/agents/${id}`, data),
    delete: (id: string) => api.delete(`/api/agents/${id}`),
    deploy: (id: string) => api.post(`/api/agents/${id}/deploy`),
    pause: (id: string) => api.post(`/api/agents/${id}/pause`),
    dashboardStats: (id: string) => api.get(`/api/agents/${id}/dashboard-stats`),
    sessionMessages: (agentId: string, sessionId: string) => api.get(`/api/agents/${agentId}/sessions/${sessionId}/messages`),
    availableModels: () => api.get("/api/agents/models/available"),
};

/* ──── Knowledge API ──── */
export const knowledgeApi = {
    list: (agentId: string) => api.get(`/api/agents/${agentId}/knowledge`),
    uploadFile: (agentId: string, file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        return api.post(`/api/agents/${agentId}/knowledge/file`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },
    scrapeUrl: (agentId: string, url: string) =>
        api.post(`/api/agents/${agentId}/knowledge/url`, { url }),
    saveText: (agentId: string, text: string, source_name?: string) =>
        api.post(`/api/agents/${agentId}/knowledge/text`, { text, source_name }),
    delete: (agentId: string, knowledgeId: string) =>
        api.delete(`/api/agents/${agentId}/knowledge/${knowledgeId}`),
};

/* ──── Knowledge V2 (ChromaDB) API ──── */
export const knowledgeV2Api = {
    list: (agentId: string) => api.get(`/api/agents/${agentId}/knowledge_v2`),
    uploadFile: (agentId: string, file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        return api.post(`/api/agents/${agentId}/knowledge_v2/file`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },
    scrapeUrl: (agentId: string, url: string) =>
        api.post(`/api/agents/${agentId}/knowledge_v2/url`, { url }),
    saveText: (agentId: string, text: string, source_name?: string) =>
        api.post(`/api/agents/${agentId}/knowledge_v2/text`, { text, source_name }),
    delete: (agentId: string, knowledgeId: string) =>
        api.delete(`/api/agents/${agentId}/knowledge_v2/${knowledgeId}`),
};

/* ──── Database Agent API ──── */
export const databaseApi = {
    getConnection: (agentId: string) => api.get(`/api/agents/${agentId}/database/connection`),
    saveConnection: (agentId: string, data: any) => api.post(`/api/agents/${agentId}/database/connection`, data),
    getSchema: (agentId: string) => api.get(`/api/agents/${agentId}/database/schema`),
    fetchSchema: (agentId: string) => api.post(`/api/agents/${agentId}/database/schema/fetch`),
    generateAiSchema: (agentId: string) => api.post(`/api/agents/${agentId}/database/schema/generate`),
    saveSchema: (agentId: string, data: { items: any[], table_metas?: any[] }) => api.post(`/api/agents/${agentId}/database/schema/save`, data),
    getTableMeta: (agentId: string) => api.get(`/api/agents/${agentId}/database/table-meta`),
    toggleTableHidden: (agentId: string, tableName: string, isHidden: boolean) =>
        api.post(`/api/agents/${agentId}/database/table-meta/${encodeURIComponent(tableName)}/toggle-hidden`, { is_hidden: isHidden }),
    bulkUpdateStatus: (agentId: string, tableNames: string[], reviewStatus: string) =>
        api.post(`/api/agents/${agentId}/database/table-meta/bulk-status`, { table_names: tableNames, review_status: reviewStatus }),
    getRelationships: (agentId: string) => api.get(`/api/agents/${agentId}/database/relationships`),
};

/* ──── Leads API ──── */
export const leadsApi = {
    list: (agentId: string) => api.get(`/api/agents/${agentId}/leads`),
    delete: (agentId: string, leadId: string) =>
        api.delete(`/api/agents/${agentId}/leads/${leadId}`),
    exportCsv: (agentId: string) =>
        api.get(`/api/agents/${agentId}/leads/export`, { responseType: "blob" }),
};

/* ──── Coding Agent API ──── */
export const codingAgentApi = {
    chat: (message: string, repository_url?: string) =>
        api.post("/api/coding-agent/chat", { message, repository_url }),
};

export default api;
