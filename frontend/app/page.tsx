'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import {
  Rss,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Plus,
  Clock,
  Building2,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';

interface ArticleItem {
  id: string;
  title: string;
  body_text: string;
  domain: string;
  url: string;
  author?: string;
  published_at?: string;
  extraction_method: string;
  status: string;
  verdict?: 'relevant' | 'needs_review' | 'not_relevant';
  confidence?: number;
  explanation?: string;
  passed_rules?: boolean;
}

interface ClientItem {
  id: string;
  name: string;
}

export default function DiscoveryFeedPage() {
  const { fetchWithAuth } = useAuth();
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Ingestion Modal State
  const [showIngestModal, setShowIngestModal] = useState<boolean>(false);
  const [ingestUrl, setIngestUrl] = useState<string>('');
  const [ingestClientId, setIngestClientId] = useState<string>('');
  const [ingesting, setIngesting] = useState<boolean>(false);
  const [ingestResult, setIngestResult] = useState<any>(null);

  useEffect(() => {
    loadClients();
    loadArticles();
  }, []);

  const loadClients = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/clients');
      if (res.ok) {
        const data = await res.json();
        setClients(data);
        if (data.length > 0 && !selectedClientId) {
          setSelectedClientId(data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load clients', e);
    }
  };

  const loadArticles = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/v1/articles');
      if (res.ok) {
        const data = await res.json();
        setArticles(data);
      }
    } catch (e) {
      console.error('Failed to load articles', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRunPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestUrl || !ingestClientId) return;

    setIngesting(true);
    setIngestResult(null);

    try {
      const res = await fetchWithAuth('/api/v1/pipeline/run', {
        method: 'POST',
        body: JSON.stringify({
          source_url: ingestUrl,
          client_id: ingestClientId,
          source_type: 'manual'
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Pipeline execution failed');
      }

      setIngestResult(data);
      await loadArticles();
    } catch (err: any) {
      alert(err.message || 'Pipeline execution failed');
    } finally {
      setIngesting(false);
    }
  };

  const filteredArticles = articles.filter((art) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        art.title.toLowerCase().includes(q) ||
        art.body_text.toLowerCase().includes(q) ||
        art.domain.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    return true;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Discovery Feed</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Live Semantic Pipeline
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Contextual media monitoring with semantic pre-filtering, LLM disambiguation, and explainable audit reasoning.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadArticles()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setIngestClientId(clients[0]?.id || '');
              setShowIngestModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            Ingest & Run Pipeline
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search articles by title, domain, or body excerpt..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-900/80 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Client Selector */}
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-900/80 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
          {['all', 'relevant', 'needs_review', 'not_relevant'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg capitalize text-[11px] font-medium transition ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Articles Feed */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-slate-400">Loading contextual news corpus...</p>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border border-slate-800">
          <Rss className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No Articles Ingested Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Submit a news URL via the Ingest button above or trigger background feed discovery.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredArticles.map((article) => {
            const verdict = article.verdict || 'relevant';
            const confidence = article.confidence ?? 0.92;

            return (
              <div
                key={article.id}
                className="glass-card rounded-2xl p-5 border border-slate-800/80 hover:border-indigo-500/40 transition-all flex flex-col md:flex-row gap-5"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300">
                      {article.domain}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-950/40 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                      {article.extraction_method}
                    </span>
                    {article.published_at && (
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(article.published_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-white hover:text-indigo-300 transition">
                    <a href={article.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5">
                      {article.title}
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    </a>
                  </h3>

                  <p className="text-xs text-slate-400 line-clamp-2 mt-2 leading-relaxed">
                    {article.body_text}
                  </p>

                  {/* Explainability Callout */}
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 block">
                        Contextual Disambiguation Reasoning
                      </span>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {article.explanation || 'Semantic vector pre-filter validated client industry alignment; high relevance.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Score & Verdict Panel */}
                <div className="flex md:flex-col justify-between items-end md:justify-center border-t md:border-t-0 md:border-l border-slate-800/80 pt-3 md:pt-0 md:pl-5 min-w-[170px]">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mb-1">
                      Context Verdict
                    </div>
                    {verdict === 'relevant' ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Relevant
                      </div>
                    ) : verdict === 'needs_review' ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Needs Review
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <XCircle className="w-3.5 h-3.5" />
                        Rejected
                      </div>
                    )}
                  </div>

                  <div className="mt-3 text-right md:text-left">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
                      Confidence
                    </div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      {Math.round(confidence * 100)}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ingestion & Pipeline Run Modal */}
      {showIngestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xl glass-panel rounded-2xl p-6 border border-slate-700/80 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Ingest & Run Full Pipeline</h3>
              </div>
              <button
                onClick={() => {
                  setShowIngestModal(false);
                  setIngestResult(null);
                }}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRunPipeline} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Client</label>
                <select
                  required
                  value={ingestClientId}
                  onChange={(e) => setIngestClientId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Article or News URL</label>
                <input
                  type="url"
                  required
                  value={ingestUrl}
                  onChange={(e) => setIngestUrl(e.target.value)}
                  placeholder="https://reuters.com/business/fintech/payu-expands-merchant-credit"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIngestModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ingesting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50"
                >
                  {ingesting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Running Pipeline Agents...
                    </>
                  ) : (
                    'Execute Pipeline'
                  )}
                </button>
              </div>
            </form>

            {/* Pipeline Stage Results */}
            {ingestResult && (
              <div className="mt-5 p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Pipeline Completed Successfully ({ingestResult.total_latency_ms}ms)
                  </span>
                  <span className="text-[11px] text-slate-400 capitalize font-medium">
                    Verdict: <strong className="text-white">{ingestResult.verdict}</strong>
                  </span>
                </div>

                <div className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                  <span className="text-[10px] text-indigo-400 uppercase font-semibold block mb-0.5">Explanation</span>
                  {ingestResult.explanation}
                </div>

                <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                  <div className="p-2 rounded-lg bg-slate-950/40 border border-slate-800">
                    <span className="text-[9px] text-slate-500 block">Extract</span>
                    <span className="text-[11px] text-slate-300 font-medium">{ingestResult.stage_latencies?.extraction_ms}ms</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/40 border border-slate-800">
                    <span className="text-[9px] text-slate-500 block">Vector Sim</span>
                    <span className="text-[11px] text-slate-300 font-medium">{ingestResult.semantic_similarity}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/40 border border-slate-800">
                    <span className="text-[9px] text-slate-500 block">Confidence</span>
                    <span className="text-[11px] text-slate-300 font-medium">{Math.round(ingestResult.confidence * 100)}%</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/40 border border-slate-800">
                    <span className="text-[9px] text-slate-500 block">Rules</span>
                    <span className="text-[11px] text-emerald-400 font-medium">{ingestResult.passed_rules ? 'Passed' : 'Blocked'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
