'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import { 
  Activity, 
  Search, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Sliders,
  Cpu,
  Database,
  Code
} from 'lucide-react';

interface AuditLog {
  id: string;
  agent_name: string;
  client_id: string | null;
  article_id: string | null;
  action: string;
  confidence: number;
  latency_ms: number;
  input_summary: string | null;
  output_summary: string | null;
  explanation: string;
  metadata: Record<string, any>;
  timestamp: string;
}

interface LogStats {
  total_agent_decisions: number;
  average_decision_latency_ms: number;
}

interface Client {
  id: string;
  name: string;
}

const AGENTS_LIST = [
  'ExtractionAgent',
  'ClientDNAAgent',
  'SemanticDiscoveryAgent',
  'ContextualValidationAgent',
  'RuleEngineAgent',
  'SourceDiscoveryAgent',
  'SourceCredibilityAgent',
  'DailyBriefAgent'
];

export default function LogsPage() {
  const { fetchWithAuth } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    loadClients();
    loadStats();
    loadLogs();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [selectedAgent, selectedClientId, minConfidence]);

  async function loadClients() {
    try {
      const res = await fetchWithAuth('/api/v1/clients');
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (err) {
      console.error('Failed to load clients:', err);
    }
  }

  async function loadStats() {
    try {
      const res = await fetchWithAuth('/api/v1/logs/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load log stats:', err);
    }
  }

  async function loadLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedAgent) params.append('agent_name', selectedAgent);
      if (selectedClientId) params.append('client_id', selectedClientId);
      if (minConfidence > 0) params.append('min_confidence', minConfidence.toString());
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('limit', '100');

      const res = await fetchWithAuth(`/api/v1/logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }

  const getAgentColor = (name: string) => {
    switch (name) {
      case 'ExtractionAgent': return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      case 'ClientDNAAgent': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'SemanticDiscoveryAgent': return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      case 'ContextualValidationAgent': return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
      case 'RuleEngineAgent': return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'SourceDiscoveryAgent': return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
      case 'SourceCredibilityAgent': return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
      case 'DailyBriefAgent': return 'bg-pink-500/15 text-pink-300 border-pink-500/30';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getConfidenceBadge = (conf: number) => {
    if (conf >= 0.85) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          {(conf * 100).toFixed(0)}% Conf
        </span>
      );
    } else if (conf >= 0.50) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          {(conf * 100).toFixed(0)}% Review
        </span>
      );
    } else {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
          {(conf * 100).toFixed(0)}% Reject
        </span>
      );
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-16">
      {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-violet-500/20 to-purple-500/20 border border-violet-500/30 text-violet-400">
                <Activity className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Agent Audit Log & Explainability</h1>
            </div>
            <p className="text-sm text-slate-400">
              Immutable forensic ledger recording every autonomous decision, confidence metric, latency benchmark, and natural-language explanation.
            </p>
          </div>

          <button
            onClick={() => {
              loadStats();
              loadLogs();
            }}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors flex items-center gap-2 text-xs font-medium self-start md:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-violet-400' : ''}`} />
            <span>Refresh Ledger</span>
          </button>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card p-5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Agent Decisions</span>
                <Cpu className="w-4 h-4 text-violet-400" />
              </div>
              <div className="text-3xl font-black text-white mt-2 font-mono">
                {stats.total_agent_decisions.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Logged to structured SQLite/PostgreSQL store</span>
            </div>

            <div className="glass-card p-5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Average Decision Latency</span>
                <Clock className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-3xl font-black text-cyan-400 mt-2 font-mono">
                {stats.average_decision_latency_ms} <span className="text-lg font-normal text-slate-400">ms</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">From raw input to structured decision</span>
            </div>

            <div className="glass-card p-5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Autonomous Agents</span>
                <Database className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-black text-emerald-400 mt-2 font-mono">8 / 8</div>
              <span className="text-[11px] text-slate-500 mt-1 block">Fully instrumented with audit callbacks</span>
            </div>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadLogs()}
                placeholder="Search explanations..."
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs focus:outline-none focus:border-violet-500"
              />
            </div>

            {/* Agent Filter */}
            <div>
              <select
                value={selectedAgent}
                onChange={e => setSelectedAgent(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs focus:outline-none focus:border-violet-500"
              >
                <option value="">All 8 Agents</option>
                {AGENTS_LIST.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            {/* Client Filter */}
            <div>
              <select
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs focus:outline-none focus:border-violet-500"
              >
                <option value="">All Clients</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Min Confidence */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 whitespace-nowrap">Min Conf:</span>
              <input
                type="range"
                min="0"
                max="0.9"
                step="0.1"
                value={minConfidence}
                onChange={e => setMinConfidence(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
              <span className="text-xs font-mono font-bold text-violet-400 w-10">
                {(minConfidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Audit Log Entries List */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-violet-400 mx-auto" />
            <p className="text-xs text-slate-400">Streaming audit records from database...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="glass-card p-12 rounded-2xl border border-slate-800 text-center space-y-3">
            <Activity className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">No Audit Records Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Run article ingestion or test the benchmark suite to generate audit trail events across agents.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map(log => {
              const isExpanded = expandedLogId === log.id;
              return (
                <div
                  key={log.id}
                  className="glass-card rounded-2xl border border-slate-800/80 hover:border-slate-700/80 transition-all overflow-hidden"
                >
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 select-none hover:bg-slate-900/30 transition-colors"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getAgentColor(log.agent_name)}`}>
                          {log.agent_name}
                        </span>

                        <span className="text-xs font-mono font-bold text-white">
                          {log.action}
                        </span>

                        {getConfidenceBadge(log.confidence)}

                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {log.latency_ms.toFixed(1)}ms
                        </span>
                      </div>

                      {/* Explanation Line */}
                      <p className="text-xs text-slate-300 leading-relaxed font-medium">
                        {log.explanation}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-slate-500 text-xs font-mono">
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <div className="p-1 rounded bg-slate-800/60 text-slate-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded JSON Inspector */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-slate-800/60 bg-slate-950/50 space-y-3 animate-in fade-in duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="font-semibold text-slate-400 block mb-1">Input Summary:</span>
                          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto">
                            {log.input_summary || 'N/A'}
                          </div>
                        </div>

                        <div>
                          <span className="font-semibold text-slate-400 block mb-1">Output Summary:</span>
                          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto">
                            {log.output_summary || 'N/A'}
                          </div>
                        </div>
                      </div>

                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div>
                          <span className="font-semibold text-slate-400 block mb-1 flex items-center gap-1.5">
                            <Code className="w-3.5 h-3.5 text-violet-400" />
                            <span>Raw Decision Metadata:</span>
                          </span>
                          <pre className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-violet-300 font-mono text-[11px] overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
  );
}
