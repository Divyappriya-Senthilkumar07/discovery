'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/components/AuthContext';
import { 
  FileText, 
  Sparkles, 
  Share2, 
  Copy, 
  Check, 
  AlertTriangle, 
  Layers, 
  Globe, 
  Clock, 
  RefreshCw,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Bookmark
} from 'lucide-react';

interface Client {
  id: string;
  name: string;
  industry?: string;
}

interface BriefItem {
  id: string;
  story_cluster_id: string;
  client_id: string;
  representative_headline: string;
  summary: string;
  contributing_sources: string[];
  outlier_articles: string[];
  article_ids?: string[];
  generated_at: string;
}

export default function DailyBriefPage() {
  const { fetchWithAuth } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [briefs, setBriefs] = useState<BriefItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load clients
  useEffect(() => {
    async function loadClients() {
      try {
        const res = await fetchWithAuth('/api/v1/clients');
        if (res.ok) {
          const data = await res.json();
          setClients(data);
          if (data.length > 0) {
            setSelectedClientId(data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load clients:', err);
      }
    }
    loadClients();
  }, []);

  // Load briefs for selected client
  useEffect(() => {
    if (!selectedClientId) return;
    loadBriefs(selectedClientId);
  }, [selectedClientId]);

  async function loadBriefs(clientId: string) {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetchWithAuth(`/api/v1/briefs/client/${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setBriefs(data);
      }
    } catch (err) {
      console.error('Failed to load briefs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateBrief() {
    if (!selectedClientId) return;
    setGenerating(true);
    setStatusMessage(null);
    try {
      const res = await fetchWithAuth('/api/v1/briefs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: selectedClientId }),
      });
      if (res.ok) {
        setStatusMessage('Fresh intelligence brief successfully generated from recent articles!');
        loadBriefs(selectedClientId);
      } else {
        const err = await res.json();
        setStatusMessage(err.detail || 'Could not generate brief. Ingest articles first.');
      }
    } catch (err) {
      setStatusMessage('Network error generating brief.');
    } finally {
      setGenerating(false);
    }
  }

  function handleCopyCluster(brief: BriefItem) {
    const text = `STORY CLUSTER: ${brief.representative_headline}\n\nEXECUTIVE SUMMARY:\n${brief.summary}\n\nSOURCES: ${brief.contributing_sources.join(', ')}\n${brief.outlier_articles.length ? `\nOUTLIER ANGLES:\n- ` + brief.outlier_articles.join('\n- ') : ''}`;
    navigator.clipboard.writeText(text);
    setCopiedId(brief.id);
    setTimeout(() => setCopiedId(null), 2500);
  }

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <AppLayout>
      <div className="space-y-8 max-w-6xl mx-auto pb-16">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400">
                <FileText className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Executive Daily Brief</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                Agent 8
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Agglomerative semantic clustering de-duplicates syndicated press coverage and surfaces isolated outlier angles into an analyst-ready digest.
            </p>
          </div>

          {/* Client Selector & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white text-sm font-medium focus:outline-none focus:border-emerald-500/50 transition-all shadow-inner"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                  {c.name} {c.industry ? `(${c.industry})` : ''}
                </option>
              ))}
            </select>

            <button
              onClick={handleGenerateBrief}
              disabled={generating || !selectedClientId}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-semibold text-xs transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{generating ? 'Clustering Articles...' : 'Generate New Brief'}</span>
            </button>
          </div>
        </div>

        {/* Status Alert */}
        {statusMessage && (
          <div className="p-4 rounded-xl bg-slate-900/90 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>{statusMessage}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white text-xs">
              Dismiss
            </button>
          </div>
        )}

        {/* Client Briefing Banner */}
        {selectedClient && (
          <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                <TrendingUp className="w-4 h-4" />
                <span>Consolidated Intelligence Stream</span>
              </div>
              <h2 className="text-lg font-bold text-white">
                Intelligence Brief for {selectedClient.name}
              </h2>
              <p className="text-xs text-slate-400">
                Tracking {briefs.length} major syndicated story narrative clusters across international and domestic trade press.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono">
                {briefs.length} Active Story Clusters
              </span>
            </div>
          </div>
        )}

        {/* Clusters List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-sm text-slate-400">Aggregating story clusters and clustering vectors...</p>
          </div>
        ) : briefs.length === 0 ? (
          <div className="glass-card p-12 rounded-2xl border border-slate-800 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">No Intelligence Briefs Generated Yet</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              The Daily Brief Agent clusters verified coverage into unified narratives and separates outlier investigative angles.
            </p>
            <button
              onClick={handleGenerateBrief}
              disabled={generating}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs inline-flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Brief for {selectedClient?.name || 'Selected Client'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {briefs.map((brief, idx) => {
              const hasOutliers = brief.outlier_articles && brief.outlier_articles.length > 0;
              return (
                <div
                  key={brief.id}
                  className="glass-card rounded-2xl border border-slate-800 hover:border-slate-700/80 transition-all overflow-hidden"
                >
                  {/* Top Bar: Cluster Metadata */}
                  <div className="px-6 py-4 bg-slate-950/40 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Story Cluster
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                        {brief.contributing_sources.length} Publications
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(brief.generated_at).toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleCopyCluster(brief)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                        title="Copy Story Digest to Clipboard"
                      >
                        {copiedId === brief.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Cluster Content */}
                  <div className="p-6 space-y-5">
                    {/* Representative Headline */}
                    <div>
                      <h3 className="text-lg font-bold text-white tracking-tight leading-snug">
                        {brief.representative_headline}
                      </h3>
                    </div>

                    {/* Consolidated Executive Summary */}
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Executive Narrative Synthesis</span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {brief.summary}
                      </p>
                    </div>

                    {/* Contributing Sources Badges */}
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Syndicated Coverage Across:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {brief.contributing_sources.map((domain, sIdx) => (
                          <span
                            key={sIdx}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-700/80 text-xs font-mono text-slate-300"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                            {domain}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Outlier Articles / Isolated Angles */}
                    {hasOutliers && (
                      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Detected Outlier / Emerging Angle</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          The following reporting diverged from the mainstream syndicated wire, introducing new factual claims:
                        </p>
                        <div className="space-y-1.5 pt-1">
                          {brief.outlier_articles.map((outlier, oIdx) => (
                            <div
                              key={oIdx}
                              className="text-xs text-amber-200/90 font-medium pl-3 border-l-2 border-amber-500/50"
                            >
                              {outlier}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
