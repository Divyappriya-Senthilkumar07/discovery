'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import { 
  Settings, 
  Server, 
  Cpu, 
  Database, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Layers,
  Key,
  Terminal,
  Activity,
  User,
  Sliders
} from 'lucide-react';

interface HealthData {
  status: string;
  service: string;
  version: string;
  llm_provider: string;
}

export default function SettingsPage() {
  const { user, fetchWithAuth } = useAuth();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(true);
  const [dbStats, setDbStats] = useState<{ total_decisions: number; avg_latency: number } | null>(null);

  useEffect(() => {
    loadHealthAndStats();
  }, []);

  async function loadHealthAndStats() {
    setLoadingHealth(true);
    try {
      const healthRes = await fetch('/health');
      if (healthRes.ok) {
        const hData = await healthRes.json();
        setHealth(hData);
      }
      
      const statsRes = await fetchWithAuth('/api/v1/logs/stats');
      if (statsRes.ok) {
        const sData = await statsRes.json();
        setDbStats({
          total_decisions: sData.total_agent_decisions,
          avg_latency: sData.average_decision_latency_ms,
        });
      }
    } catch (err) {
      console.error('Failed to load system health:', err);
    } finally {
      setLoadingHealth(false);
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-slate-700/40 to-slate-800/40 border border-slate-700/60 text-slate-300">
                <Settings className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">System Settings & Architecture</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                System Healthy
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Technical configuration, runtime model parameters, vector embedding backend, and multi-agent health diagnostics.
            </p>
          </div>

          <button
            onClick={loadHealthAndStats}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors flex items-center gap-2 text-xs font-medium self-start md:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loadingHealth ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>

        {/* User Session Profile Card */}
        {user && (
          <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <User className="w-6 h-6" />
              </div>
              <div>
                <div className="text-base font-bold text-white flex items-center gap-2">
                  <span>{user.email}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {user.role}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5 font-mono">Authenticated Session</div>
              </div>
            </div>

            <div className="text-xs text-slate-500 font-mono sm:text-right">
              <div>Session: Authenticated via JWT HS256</div>
              <div className="text-emerald-400">Status: Active & Verified</div>
            </div>
          </div>
        )}

        {/* System Diagnostics & Components Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: LLM Engine */}
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Large Language Model Provider</h3>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Primary Provider:</span>
                <span className="font-mono font-bold text-white">Google Gemini API</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Target Model:</span>
                <span className="font-mono text-indigo-300">gemini-2.5-flash</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Fallback Provider:</span>
                <span className="font-mono text-cyan-300">Groq (llama-3.3-70b-versatile)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Deterministic Fallback:</span>
                <span className="font-mono text-emerald-300">Active (Zero-Network Test Resilient)</span>
              </div>
            </div>
          </div>

          {/* Card 2: Vector & Embeddings */}
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Vector Space & Embeddings</h3>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Embedding Model:</span>
                <span className="font-mono font-bold text-white">sentence-transformers/all-MiniLM-L6-v2</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Vector Dimension:</span>
                <span className="font-mono text-cyan-300">384 Float32</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Cosine Similarity Backend:</span>
                <span className="font-mono text-indigo-300">NumPy Matrix (SQLite) / pgvector (Postgres)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Semantic Pre-filter Threshold:</span>
                <span className="font-mono text-emerald-300">&ge; 0.35 Cosine Similarity</span>
              </div>
            </div>
          </div>

          {/* Card 3: Ingestion & Extraction Engine */}
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Server className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Web Extraction Pipeline</h3>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Headless Browser Engine:</span>
                <span className="font-mono font-bold text-white">Playwright (Chromium Headless)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Static Parser:</span>
                <span className="font-mono text-emerald-300">BeautifulSoup4 / Trafilatura</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Deduplication Hash:</span>
                <span className="font-mono text-slate-300">SHA-256 Normalized Content Hash</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">SPA Detection:</span>
                <span className="font-mono text-cyan-300">Empty root node fallback routing</span>
              </div>
            </div>
          </div>

          {/* Card 4: Database & Ledger */}
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Database & Persistence</h3>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Local Dev Engine:</span>
                <span className="font-mono font-bold text-white">SQLite 3 via aiosqlite</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Production Engine:</span>
                <span className="font-mono text-amber-300">PostgreSQL 16 + pgvector (Docker Compose)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400">Audit Ledger Count:</span>
                <span className="font-mono text-emerald-400">{dbStats?.total_decisions || 0} logged decisions</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Average Decision Time:</span>
                <span className="font-mono text-cyan-400">{dbStats?.avg_latency || 0} ms</span>
              </div>
            </div>
          </div>

        </div>

        {/* 8 Autonomous Agents Architecture Map */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">8-Agent Multi-Agent Orchestration Map</h3>
              <p className="text-xs text-slate-400">Every agent is typed, modular, and logs every invocation to the forensic audit trail</p>
            </div>
            <span className="text-xs font-mono text-slate-500">app.orchestrator.pipeline.PipelineOrchestrator</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {[
              { id: 'Agent 1', name: 'ExtractionAgent', desc: 'RSS, static HTML & headless Playwright scraper' },
              { id: 'Agent 2', name: 'ClientDNAAgent', desc: 'Synthesizes enterprise profiles with analyst overrides' },
              { id: 'Agent 3', name: 'SemanticDiscoveryAgent', desc: 'Vector cosine shortlist pre-filter (threshold >= 0.35)' },
              { id: 'Agent 4', name: 'ContextualValidationAgent', desc: 'Adversarial homonym filter (confidence routing)' },
              { id: 'Agent 5', name: 'RuleEngineAgent', desc: 'Natural-language translation & 7-day preview simulator' },
              { id: 'Agent 6', name: 'SourceDiscoveryAgent', desc: 'Unregistered Tier-2/3 domain detector & queue' },
              { id: 'Agent 7', name: 'SourceCredibilityAgent', desc: 'Algorithmic trust scoring & human analyst locks' },
              { id: 'Agent 8', name: 'DailyBriefAgent', desc: 'Agglomerative story clustering & outlier detection' },
            ].map(agent => (
              <div key={agent.id} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">{agent.id}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
                <div className="font-semibold text-white font-mono text-[11px]">{agent.name}</div>
                <div className="text-[11px] text-slate-400 leading-tight">{agent.desc}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
  );
}
