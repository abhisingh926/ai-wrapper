"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { databaseApi } from "@/lib/api";

type ReviewStatus = "pending" | "under_review" | "reviewed";

interface FkRelation { from_table: string; from_column: string; to_table: string; to_column: string; }

const STATUS_CONFIG: Record<ReviewStatus, { label: string; color: string; dot: string }> = {
    pending:      { label: "Pending",      color: "text-slate-400 bg-slate-800/60 border-slate-700",          dot: "bg-slate-500" },
    under_review: { label: "Under Review", color: "text-amber-400 bg-amber-500/10 border-amber-500/30",       dot: "bg-amber-400" },
    reviewed:     { label: "Reviewed ✓",   color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", dot: "bg-emerald-500" },
};

/**
 * Build a bidirectional adjacency map from FK relationships.
 * { table: Set<relatedTable> }
 */
function buildFkGraph(relations: FkRelation[]): Record<string, Set<string>> {
    const graph: Record<string, Set<string>> = {};
    const ensure = (t: string) => { if (!graph[t]) graph[t] = new Set(); };
    for (const r of relations) {
        ensure(r.from_table); ensure(r.to_table);
        graph[r.from_table].add(r.to_table);
        graph[r.to_table].add(r.from_table);  // bidirectional
    }
    return graph;
}

/**
 * Flood-fill from a starting table to find ALL transitively connected tables.
 */
function getConnectedTables(startTable: string, graph: Record<string, Set<string>>): Set<string> {
    const visited = new Set<string>();
    const queue = [startTable];
    while (queue.length) {
        const cur = queue.pop()!;
        if (visited.has(cur)) continue;
        visited.add(cur);
        for (const neighbor of (graph[cur] || [])) {
            if (!visited.has(neighbor)) queue.push(neighbor);
        }
    }
    return visited;
}

export default function DatabaseToolModal({ agentId, onClose }: { agentId: string, onClose: () => void }) {
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Connection
    const [connection, setConnection] = useState<any>(null);
    const [dbType, setDbType] = useState("postgres");
    const [host, setHost] = useState(""); const [port, setPort] = useState(5432);
    const [dbName, setDbName] = useState(""); const [username, setUsername] = useState("");
    const [password, setPassword] = useState(""); const [connError, setConnError] = useState("");

    // Schema & Meta
    const [schemas, setSchemas] = useState<any[]>([]);
    const [tableMetas, setTableMetas] = useState<Record<string, any>>({});
    const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});

    // FK graph
    const [fkRelations, setFkRelations] = useState<FkRelation[]>([]);
    const [fkGraph, setFkGraph] = useState<Record<string, Set<string>>>({});
    const [relatedHighlight, setRelatedHighlight] = useState<Set<string>>(new Set()); // tables highlighted as FK-related

    // UI state
    const [activeTab, setActiveTab] = useState<"active" | "removed">("active");
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState<ReviewStatus | "all">("all");
    const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
    const [relatedSearchTable, setRelatedSearchTable] = useState(""); // table name typed in FK search

    // Derived grouped schemas
    const groupedSchemas = useMemo(() =>
        schemas.reduce((acc, curr) => {
            if (!acc[curr.table_name]) acc[curr.table_name] = [];
            acc[curr.table_name].push(curr);
            return acc;
        }, {} as Record<string, any[]>), [schemas]);

    const allTableNames = useMemo(() => Object.keys(groupedSchemas), [groupedSchemas]);

    const activeTables = useMemo(() =>
        allTableNames
            .filter(t => !(tableMetas[t]?.is_hidden))
            .filter(t => !search || t.toLowerCase().includes(search.toLowerCase()) || (tableMetas[t]?.display_name || "").toLowerCase().includes(search.toLowerCase()))
            .filter(t => filterStatus === "all" || (tableMetas[t]?.review_status || "pending") === filterStatus),
        [allTableNames, tableMetas, search, filterStatus]);

    const removedTables = useMemo(() =>
        allTableNames.filter(t => tableMetas[t]?.is_hidden)
            .filter(t => !search || t.toLowerCase().includes(search.toLowerCase())),
        [allTableNames, tableMetas, search]);

    const reviewedCount    = useMemo(() => allTableNames.filter(t => !tableMetas[t]?.is_hidden && tableMetas[t]?.review_status === "reviewed").length, [allTableNames, tableMetas]);
    const pendingCount     = useMemo(() => allTableNames.filter(t => !tableMetas[t]?.is_hidden && (tableMetas[t]?.review_status || "pending") === "pending").length, [allTableNames, tableMetas]);
    const underReviewCount = useMemo(() => allTableNames.filter(t => !tableMetas[t]?.is_hidden && tableMetas[t]?.review_status === "under_review").length, [allTableNames, tableMetas]);

    // Selection helpers
    const toggleSelect = (t: string) => setSelectedTables(prev => {
        const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n;
    });
    const selectAll = () => setSelectedTables(new Set(activeTables));
    const clearSelection = () => { setSelectedTables(new Set()); setRelatedHighlight(new Set()); };
    const isAllSelected = activeTables.length > 0 && activeTables.every(t => selectedTables.has(t));
    const toggleExpand = (t: string) => setExpandedTables(p => ({ ...p, [t]: p[t] === undefined ? true : !p[t] }));

    // FK-related table selection
    const handleSelectRelated = useCallback(() => {
        const q = relatedSearchTable.trim().toLowerCase();
        if (!q) return;
        // Find exact or partial match from known tables
        const match = allTableNames.find(t => t.toLowerCase() === q) ||
                      allTableNames.find(t => t.toLowerCase().includes(q));
        if (!match) { alert(`No table matching "${relatedSearchTable}" found.`); return; }

        const connected = getConnectedTables(match, fkGraph);
        // Only select tables that are active (not hidden)
        const selectableConnected = new Set(
            Array.from(connected).filter(t => allTableNames.includes(t) && !tableMetas[t]?.is_hidden)
        );
        setSelectedTables(selectableConnected);
        setRelatedHighlight(selectableConnected);
    }, [relatedSearchTable, allTableNames, fkGraph, tableMetas]);

    useEffect(() => { loadData(); }, [agentId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const connRes = await databaseApi.getConnection(agentId);
            if (connRes.data) {
                setConnection(connRes.data);
                setDbType(connRes.data.db_type); setHost(connRes.data.host);
                setPort(connRes.data.port); setDbName(connRes.data.db_name);
                setUsername(connRes.data.username);
            }
            const [schemaRes, metaRes, relRes] = await Promise.all([
                databaseApi.getSchema(agentId),
                databaseApi.getTableMeta(agentId),
                databaseApi.getRelationships(agentId).catch(() => ({ data: [] }))
            ]);
            setSchemas(schemaRes.data || []);
            const metaMap: Record<string, any> = {};
            for (const m of (metaRes.data || [])) metaMap[m.table_name] = m;
            setTableMetas(metaMap);
            const relations = relRes.data || [];
            setFkRelations(relations);
            setFkGraph(buildFkGraph(relations));
        } catch (err) { console.error("Failed to load db data", err); }
        setLoading(false);
    };

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault(); setActionLoading(true); setConnError("");
        try {
            const res = await databaseApi.saveConnection(agentId, { db_type: dbType, host, port, db_name: dbName, username, password });
            setConnection(res.data);
        } catch (err: any) { setConnError(err.response?.data?.detail || "Connection failed."); }
        setActionLoading(false);
    };

    const handleFetchSchema = async () => {
        setActionLoading(true);
        try {
            const [schemaRes, metaRes, relRes] = await Promise.all([
                databaseApi.fetchSchema(agentId),
                databaseApi.getTableMeta(agentId),
                databaseApi.getRelationships(agentId).catch(() => ({ data: [] }))
            ]);
            setSchemas(schemaRes.data || []);
            const metaMap: Record<string, any> = {};
            for (const m of (metaRes.data || [])) metaMap[m.table_name] = m;
            setTableMetas(metaMap);
            const relations = relRes.data || [];
            setFkRelations(relations); setFkGraph(buildFkGraph(relations));
        } catch (err: any) { alert(err.response?.data?.detail || "Failed to fetch schema."); }
        setActionLoading(false);
    };

    const handleAiGenerate = async () => {
        setActionLoading(true);
        try {
            const schemaRes = await databaseApi.generateAiSchema(agentId);
            setSchemas(schemaRes.data);
            // Reload table metas — AI now fills display_name + description
            const metaRes2 = await databaseApi.getTableMeta(agentId);
            const metaMap: Record<string, any> = {};
            for (const m of (metaRes2.data || [])) metaMap[m.table_name] = m;
            setTableMetas(metaMap);
        } catch (err: any) { alert(err.response?.data?.detail || "Failed."); }
        setActionLoading(false);
    };

    const handleSaveSchema = async () => {
        if (reviewedCount === 0) { alert("No reviewed tables. Please mark at least one table as Reviewed."); return; }
        setActionLoading(true);
        try {
            const table_metas = Object.values(tableMetas).map((m: any) => ({
                table_name: m.table_name, display_name: m.display_name || "",
                description: m.description || "", requires_review: m.requires_review ?? true
            }));
            const res = await databaseApi.saveSchema(agentId, { items: schemas, table_metas });
            alert(`✅ Done! ${res.data.vectorized_chunks} chunks embedded from reviewed tables only.`);
            loadData();
        } catch (err: any) { alert(err.response?.data?.detail || "Failed."); }
        setActionLoading(false);
    };

    const handleToggleHidden = async (t: string, hide: boolean) => {
        try {
            await databaseApi.toggleTableHidden(agentId, t, hide);
            setTableMetas(p => ({ ...p, [t]: { ...(p[t] || {}), is_hidden: hide } }));
            setSelectedTables(p => { const n = new Set(p); n.delete(t); return n; });
        } catch { alert("Failed to update visibility."); }
    };

    const handleBulkStatus = async (status: ReviewStatus) => {
        if (!selectedTables.size) return;
        const names = Array.from(selectedTables);
        try {
            await databaseApi.bulkUpdateStatus(agentId, names, status);
            setTableMetas(p => {
                const n = { ...p };
                for (const t of names) n[t] = { ...(n[t] || {}), review_status: status };
                return n;
            });
            clearSelection();
        } catch { alert("Failed to update status."); }
    };

    const handleDescChange = (id: string, val: string) =>
        setSchemas(schemas.map(s => s.id === id ? { ...s, ai_description: val } : s));
    const handleColReview = (id: string) =>
        setSchemas(schemas.map(s => s.id === id ? { ...s, requires_review: false } : s));
    const handleMetaChange = (t: string, f: "display_name" | "description", v: string) =>
        setTableMetas(p => ({ ...p, [t]: { ...(p[t] || { table_name: t }), [f]: v } }));

    if (loading) return <div className="p-10 text-center text-slate-400">Loading Database Settings...</div>;

    const StatusBadge = ({ status }: { status: ReviewStatus }) => {
        const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
        return <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${c.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />{c.label}
        </span>;
    };

    const renderTableRow = (tableName: string, isRemoved = false) => {
        const cols = groupedSchemas[tableName] || [];
        const meta = tableMetas[tableName] || { table_name: tableName, display_name: "", description: "", is_hidden: false, review_status: "pending" };
        const reviewStatus: ReviewStatus = meta.review_status || "pending";
        const isExpanded = expandedTables[tableName] === true;
        const isSelected = selectedTables.has(tableName);
        const isRelated = relatedHighlight.has(tableName);
        const directLinks = fkGraph[tableName] ? Array.from(fkGraph[tableName]) : [];

        return (
            <React.Fragment key={tableName}>
                <div className={`border-b border-slate-800/40 transition-colors
                    ${isRemoved ? 'bg-slate-950/40' :
                      isSelected ? 'bg-indigo-500/8' :
                      isRelated ? 'bg-violet-500/5' :
                      'bg-[#161618]'}
                    ${!isRemoved && reviewStatus === 'reviewed' ? 'border-l-2 border-emerald-500/50' :
                      !isRemoved && reviewStatus === 'under_review' ? 'border-l-2 border-amber-500/50' :
                      'border-l-2 border-transparent'}`}>
                    {/* Row header */}
                    <div className="flex items-center gap-2 px-3 py-2.5">
                        {!isRemoved && (
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(tableName)}
                                className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 accent-indigo-500 cursor-pointer flex-shrink-0" />
                        )}
                        <button onClick={() => toggleExpand(tableName)} className="text-slate-500 text-[10px] w-3 flex-shrink-0 hover:text-white">
                            {isExpanded ? "▼" : "▶"}
                        </button>
                        <span className={`font-bold text-xs font-mono ${isRemoved ? 'text-slate-500' : 'text-white'}`}>{tableName}</span>
                        <span className="text-[9px] text-slate-700 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{cols.length} cols</span>

                        {/* FK relationship indicator */}
                        {!isRemoved && directLinks.length > 0 && (
                            <button
                                onClick={() => {
                                    setRelatedSearchTable(tableName);
                                    const connected = getConnectedTables(tableName, fkGraph);
                                    const selectable = new Set(Array.from(connected).filter(t => allTableNames.includes(t) && !tableMetas[t]?.is_hidden));
                                    setSelectedTables(selectable);
                                    setRelatedHighlight(selectable);
                                }}
                                title={`Connected to: ${directLinks.join(", ")}`}
                                className="flex items-center gap-1 text-[9px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
                            >
                                🔗 {directLinks.length} related
                            </button>
                        )}

                        {!isRemoved && <StatusBadge status={reviewStatus} />}

                        <div className="ml-auto flex items-center gap-2">
                            {!isRemoved && (
                                <select value={reviewStatus}
                                    onChange={async e => {
                                        const val = e.target.value as ReviewStatus;
                                        await databaseApi.bulkUpdateStatus(agentId, [tableName], val);
                                        setTableMetas(p => ({ ...p, [tableName]: { ...(p[tableName] || {}), review_status: val } }));
                                    }}
                                    className="text-[10px] bg-[#1C1C1E] border border-slate-700 text-slate-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500">
                                    <option value="pending">Pending</option>
                                    <option value="under_review">Under Review</option>
                                    <option value="reviewed">Reviewed ✓</option>
                                </select>
                            )}
                            {isRemoved ? (
                                <button onClick={() => handleToggleHidden(tableName, false)} className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">↩ Restore</button>
                            ) : (
                                <button onClick={() => handleToggleHidden(tableName, true)} className="text-[10px] text-red-400 bg-red-500/10 px-2 py-1 rounded border border-red-500/20 hover:bg-red-500/20 transition-colors">Remove</button>
                            )}
                        </div>
                    </div>

                    {/* Table description fields */}
                    {!isRemoved && (
                        <div className="px-10 pb-2.5 grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-slate-600 block mb-0.5">Display Name</label>
                                <input type="text" value={meta.display_name || ""} onChange={e => handleMetaChange(tableName, "display_name", e.target.value)}
                                    placeholder={tableName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    className="w-full bg-transparent border-b border-slate-800 text-xs px-1 py-0.5 text-slate-300 placeholder-slate-700 focus:outline-none focus:border-indigo-500" />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-600 block mb-0.5">Table Description</label>
                                <input type="text" value={meta.description || ""} onChange={e => handleMetaChange(tableName, "description", e.target.value)}
                                    placeholder="What does this table store?"
                                    className="w-full bg-transparent border-b border-slate-800 text-xs px-1 py-0.5 text-slate-300 placeholder-slate-700 focus:outline-none focus:border-indigo-500" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Expanded column rows */}
                {isExpanded && cols.map((s: any) => (
                    <div key={s.id} className={`grid grid-cols-12 gap-2 items-center px-4 py-2 border-b border-slate-800/20 pl-12 ${s.requires_review ? 'bg-amber-500/5' : 'bg-[#121214]'}`}>
                        <div className="col-span-3 text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                            <span className="text-slate-700">└</span>{s.column_name}
                        </div>
                        <div className="col-span-2 text-[11px] text-slate-600 font-mono">{s.data_type}</div>
                        <div className="col-span-7 flex items-center gap-2">
                            <input type="text" value={s.ai_description || ""} onChange={e => handleDescChange(s.id, e.target.value)}
                                placeholder="Describe this column..."
                                className={`bg-transparent border-b focus:border-indigo-500 focus:outline-none w-full text-[11px] px-1 py-0.5 ${s.requires_review ? 'border-amber-500/40 text-amber-200 placeholder-amber-700/40' : 'border-slate-800 text-slate-300 placeholder-slate-700'}`} />
                            {s.requires_review && <button onClick={() => handleColReview(s.id)} className="text-amber-500 hover:text-emerald-400 text-xs flex-shrink-0">✓</button>}
                        </div>
                    </div>
                ))}
            </React.Fragment>
        );
    };

    return (
        <div className="flex flex-col space-y-5 flex-1 overflow-y-auto w-full">
            {/* Connection */}
            <div className="bg-[#111111] border border-slate-800 rounded-xl p-5">
                <h4 className="text-white font-bold mb-4 flex items-center justify-between">
                    Database Connection
                    {connection?.status === "connected" && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">● Connected</span>}
                </h4>
                <form onSubmit={handleConnect} className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs text-slate-400 mb-1 block">DB Type</label>
                        <select value={dbType} onChange={e => setDbType(e.target.value)} className="w-full bg-[#1C1C1E] border border-slate-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                            <option value="postgres">PostgreSQL</option><option value="mysql">MySQL</option>
                        </select></div>
                    <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-3 flex flex-col justify-center">
                        <span className="text-xs text-amber-500 font-bold mb-1">🔒 Read-Only</span>
                        <span className="text-[10px] text-amber-500/70">AI cannot run DROP, DELETE, UPDATE.</span>
                    </div>
                    <div><label className="text-xs text-slate-400 mb-1 block">Host</label>
                        <input type="text" value={host} onChange={e => setHost(e.target.value)} placeholder="db.example.com" required className="w-full bg-[#1C1C1E] border border-slate-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" /></div>
                    <div><label className="text-xs text-slate-400 mb-1 block">Port</label>
                        <input type="number" value={port} onChange={e => setPort(parseInt(e.target.value))} required className="w-full bg-[#1C1C1E] border border-slate-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" /></div>
                    <div><label className="text-xs text-slate-400 mb-1 block">Database Name</label>
                        <input type="text" value={dbName} onChange={e => setDbName(e.target.value)} required className="w-full bg-[#1C1C1E] border border-slate-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" /></div>
                    <div><label className="text-xs text-slate-400 mb-1 block">Username</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full bg-[#1C1C1E] border border-slate-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" /></div>
                    <div className="col-span-2"><label className="text-xs text-slate-400 mb-1 block">Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className="w-full bg-[#1C1C1E] border border-slate-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" /></div>
                    {connError && <div className="col-span-2 text-xs text-red-500">{connError}</div>}
                    <div className="col-span-2">
                        <button type="submit" disabled={actionLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-5 py-2 rounded-lg font-medium transition-colors">
                            {actionLoading ? "Connecting..." : (connection ? "Update & Test Connection" : "Connect Database")}
                        </button>
                    </div>
                </form>
            </div>

            {/* Schema Section */}
            {connection?.status === "connected" && (
                <div className="bg-[#111111] border border-slate-800 rounded-xl overflow-hidden mb-8">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-white font-bold text-sm">Schema Editor & Vectorization</h4>
                                <p className="text-[10px] text-slate-500 mt-0.5">Only <span className="text-emerald-400 font-medium">Reviewed</span> tables are saved to Vector DB.</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleFetchSchema} disabled={actionLoading} className="text-xs bg-[#1C1C1E] border border-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded transition-colors">🔄 Refresh</button>
                                <button onClick={handleAiGenerate} disabled={actionLoading || !schemas.length} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded disabled:opacity-40 transition-colors">✨ AI Descriptions</button>
                            </div>
                        </div>

                        {schemas.length > 0 && (
                            <>
                                {/* Status filter pills + search + tab */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button onClick={() => setFilterStatus("all")} className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${filterStatus === "all" ? "bg-slate-700 border-slate-600 text-white" : "border-slate-800 text-slate-500 hover:text-white"}`}>
                                        All ({allTableNames.filter(t => !tableMetas[t]?.is_hidden).length})
                                    </button>
                                    {(["pending", "under_review", "reviewed"] as ReviewStatus[]).map(s => {
                                        const count = s === "pending" ? pendingCount : s === "under_review" ? underReviewCount : reviewedCount;
                                        return (
                                            <button key={s} onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
                                                className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${filterStatus === s ? STATUS_CONFIG[s].color : "border-slate-800 text-slate-500 hover:text-white"}`}>
                                                {STATUS_CONFIG[s].label} ({count})
                                            </button>
                                        );
                                    })}
                                    <div className="flex-1 min-w-40">
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600 text-xs">🔍</span>
                                            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search table name..."
                                                className="w-full bg-[#1C1C1E] border border-slate-800 rounded-lg pl-6 pr-3 py-1.5 text-[11px] text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
                                        </div>
                                    </div>
                                    <div className="flex bg-[#1C1C1E] rounded-lg p-0.5 border border-slate-800">
                                        <button onClick={() => setActiveTab("active")} className={`text-[10px] px-2.5 py-1 rounded transition-colors ${activeTab === "active" ? "bg-indigo-600 text-white" : "text-slate-400"}`}>Active</button>
                                        <button onClick={() => setActiveTab("removed")} className={`text-[10px] px-2.5 py-1 rounded transition-colors ${activeTab === "removed" ? "bg-red-600 text-white" : "text-slate-400"}`}>
                                            Removed{removedTables.length > 0 ? ` (${removedTables.length})` : ""}
                                        </button>
                                    </div>
                                </div>

                                {/* FK Related Search */}
                                {fkRelations.length > 0 && activeTab === "active" && (
                                    <div className="flex items-center gap-2 bg-violet-900/20 border border-violet-500/20 rounded-lg px-3 py-2">
                                        <span className="text-[10px] text-violet-400 font-medium flex-shrink-0">🔗 Related Tables</span>
                                        <input
                                            type="text"
                                            value={relatedSearchTable}
                                            onChange={e => { setRelatedSearchTable(e.target.value); if (!e.target.value) { setRelatedHighlight(new Set()); setSelectedTables(new Set()); } }}
                                            onKeyDown={e => e.key === "Enter" && handleSelectRelated()}
                                            placeholder="Type a table name to auto-select connected tables..."
                                            className="flex-1 bg-transparent text-[11px] text-white placeholder-violet-700/60 focus:outline-none"
                                        />
                                        <button onClick={handleSelectRelated} className="text-[10px] bg-violet-600 hover:bg-violet-700 text-white px-2.5 py-1 rounded transition-colors flex-shrink-0">
                                            Select Related
                                        </button>
                                        {relatedHighlight.size > 0 && (
                                            <button onClick={() => { setRelatedHighlight(new Set()); setSelectedTables(new Set()); setRelatedSearchTable(""); }} className="text-[10px] text-slate-500 hover:text-white">✕</button>
                                        )}
                                    </div>
                                )}

                                {/* Bulk action bar */}
                                {selectedTables.size > 0 && (
                                    <div className="flex items-center gap-2 bg-indigo-900/30 border border-indigo-500/30 rounded-lg px-3 py-2">
                                        <span className="text-xs text-indigo-300 font-medium">{selectedTables.size} selected</span>
                                        {relatedHighlight.size > 0 && <span className="text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20">🔗 FK cluster</span>}
                                        <div className="flex gap-1.5 ml-2">
                                            <button onClick={() => handleBulkStatus("under_review")} className="text-[10px] px-2.5 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded hover:bg-amber-500/30 transition-colors">Mark Under Review</button>
                                            <button onClick={() => handleBulkStatus("reviewed")} className="text-[10px] px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors">✓ Mark Reviewed</button>
                                            <button onClick={() => handleBulkStatus("pending")} className="text-[10px] px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-400 rounded hover:bg-slate-700 transition-colors">Reset to Pending</button>
                                        </div>
                                        <button onClick={clearSelection} className="ml-auto text-[10px] text-slate-500 hover:text-white">✕ Clear</button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* List */}
                    {!schemas.length ? (
                        <div className="text-center py-12 text-sm text-slate-500">No schema yet. Click "Refresh".</div>
                    ) : (
                        <>
                            {activeTab === "active" && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-[#0E0E10] border-b border-slate-900 text-[10px] text-slate-600 font-medium">
                                    <input type="checkbox" checked={isAllSelected} onChange={isAllSelected ? clearSelection : selectAll}
                                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 accent-indigo-500 cursor-pointer flex-shrink-0" />
                                    <span className="w-3 flex-shrink-0" />
                                    <span className="flex-1">Table / Description</span>
                                    <span className="mr-24 text-right">Status</span>
                                </div>
                            )}
                            <div className="max-h-[400px] overflow-y-auto">
                                {activeTab === "active"
                                    ? activeTables.length ? activeTables.map(t => renderTableRow(t, false))
                                        : <div className="text-center py-10 text-slate-500 text-sm">No tables match your filter.</div>
                                    : removedTables.length ? removedTables.map(t => renderTableRow(t, true))
                                        : <div className="text-center py-10 text-slate-500 text-sm">No removed tables.</div>
                                }
                            </div>
                            {activeTab === "active" && (
                                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-[#0E0E10]">
                                    <div className="text-[10px] text-slate-500 space-x-2">
                                        <span className="text-emerald-400">{reviewedCount} reviewed</span>
                                        <span>· {underReviewCount} under review</span>
                                        <span>· {pendingCount} pending</span>
                                        <span>· {removedTables.length} removed</span>
                                        {fkRelations.length > 0 && <span className="text-violet-400">· {fkRelations.length} FK links</span>}
                                    </div>
                                    <button onClick={handleSaveSchema} disabled={actionLoading || reviewedCount === 0}
                                        className={`text-sm px-5 py-2 rounded-lg font-medium transition-colors ${reviewedCount > 0 ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
                                        💾 Vectorize {reviewedCount > 0 ? `(${reviewedCount} tables)` : "(no reviewed tables)"}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
