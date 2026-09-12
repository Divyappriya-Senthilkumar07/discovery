'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import { 
  Globe, 
  ShieldCheck, 
  Search, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Filter, 
  AlertTriangle, 
  Sliders, 
  ExternalLink, 
  RefreshCw, 
  Award,
  Zap,
  Layers,
  ArrowUpRight
} from 'lucide-react';

interface DiscoveredSource {
  id: number;
  domain: string;
  example_article_url: string;
  matched_client_id: string;
  reason: string;
  status: 'pending_review' | 'approved' | 'rejected';
  discovered_at: string;
}

interface DomainCredibility {
  domain: string;
  credibility_score: number;
  tier: 'tier1' | 'tier2' | 'tier3';
  signals_used: string[];
  manually_overridden: boolean;
  last_updated: string;
}

interface Client {
  id: string;
  name: string;
}

export default function SourcesPage() {
  const { fetchWithAuth } = useAuth();
  const [activeTab, setActiveTab] = useState<'discovery' | 'credibility'>('discovery');
  
  // Discovered Sources
  const [discoveredSources, setDiscoveredSources] = useState<DiscoveredSource[]>([]);
  const [discoveryFilter, setDiscoveryFilter] = useState<string>('all');
  const [loadingDiscovery, setLoadingDiscovery] = useState<boolean>(false);
  const [discoveryActionId, setDiscoveryActionId] = useState<number | null>(null);

  // Credibility Index
  const [credibilityList, setCredibilityList] = useState<DomainCredibility[]>([]);
  const [loadingCredibility, setLoadingCredibility] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Override Modal
  const [selectedDomainForOverride, setSelectedDomainForOverride] = useState<DomainCredibility | null>(null);
  const [overrideTier, setOverrideTier] = useState<'tier1' | 'tier2' | 'tier3'>('tier1');
  const [overrideScore, setOverrideScore] = useState<number>(0.90);
  const [submittingOverride, setSubmittingOverride] = useState<boolean>(false);

  // Clients map for human-readable client names
  const [clientsMap, setClientsMap] = useState<Record<string, string>>({});

  // Status message
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    loadClients();
    loadDiscoveredSources();
    loadCredibility();
  }, []);

  async function loadClients() {
    try {
      const res = await fetchWithAuth('/api/v1/clients');
      if (res.ok) {
        const data: Client[] = await res.json();
        const map: Record<string, string> = {};
        data.forEach(c => { map[c.id] = c.name; });
        setClientsMap(map);
      }
    } catch (err) {
      console.error('Failed to load clients map:', err);
    }
  }

  async function loadDiscoveredSources() {
    setLoadingDiscovery(true);
    try {
      const res = await fetchWithAuth('/api/v1/sources/discovered');
      if (res.ok) {
        const data = await res.json();
        setDiscoveredSources(data);
      }
    } catch (err) {
      console.error('Failed to load discovered sources:', err);
    } finally {
      setLoadingDiscovery(false);
    }
  }

  async function loadCredibility() {
    setLoadingCredibility(true);
    try {
      const res = await fetchWithAuth('/api/v1/sources/credibility');
      if (res.ok) {
        const data = await res.json();
        setCredibilityList(data);
      }
    } catch (err) {
      console.error('Failed to load domain credibility:', err);
    } finally {
      setLoadingCredibility(false);
    }
  }

  async function handleUpdateSourceStatus(sourceId: number, status: 'approved' | 'rejected') {
    setDiscoveryActionId(sourceId);
    setStatusMessage(null);
    try {
      const res = await fetchWithAuth(`/api/v1/sources/discovered/${sourceId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setDiscoveredSources(prev =>
          prev.map(s => (s.id === sourceId ? { ...s, status } : s))
        );
        setStatusMessage(`Source domain successfully marked as ${status}.`);
      }
    } catch (err) {
      console.error('Failed to update source status:', err);
    } finally {
      setDiscoveryActionId(null);
    }
  }

  function openOverrideModal(item: DomainCredibility) {
    setSelectedDomainForOverride(item);
    setOverrideTier(item.tier);
    setOverrideScore(item.credibility_score);
  }

  async function handleSubmitOverride() {
    if (!selectedDomainForOverride) return;
    setSubmittingOverride(true);
    try {
      const res = await fetchWithAuth('/api/v1/sources/credibility/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: selectedDomainForOverride.domain,
          tier: overrideTier,
          credibility_score: Number(overrideScore),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCredibilityList(prev =>
          prev.map(c => (c.domain === updated.domain ? { ...c, ...updated } : c))
        );
        setSelectedDomainForOverride(null);
        setStatusMessage(`Analyst override applied for ${updated.domain}: Tier ${updated.tier.toUpperCase()} (${(updated.credibility_score * 100).toFixed(0)}%).`);
      }
    } catch (err) {
      console.error('Failed to override credibility:', err);
    } finally {
      setSubmittingOverride(false);
    }
  }

  const filteredDiscovered = discoveredSources.filter(s => {
    if (discoveryFilter === 'all') return true;
    return s.status === discoveryFilter;
  });

  const filteredCredibility = credibilityList.filter(c => {
    if (!searchQuery.trim()) return true;
    return c.domain.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const pendingCount = discoveredSources.filter(s => s.status === 'pending_review').length;
  const tier1Count = credibilityList.filter(c => c.tier === 'tier1').length;
  const overriddenCount = credibilityList.filter(c => c.manually_overridden).length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-16">
      {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-500 dark:text-cyan-400">
                <Globe className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Source Intelligence & Trust</h1>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border border-cyan-500/20">
                  Agent 6 (Discovery)
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                  Agent 7 (Credibility)
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Autonomous discovery of emergent Tier-2/3 trade publications coupled with algorithmic trust scoring and analyst overrides.
            </p>
          </div>

          {/* Quick Refresh */}
          <button
            onClick={() => {
              loadDiscoveredSources();
              loadCredibility();
            }}
            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-2 text-xs font-medium self-start md:self-auto shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loadingDiscovery || loadingCredibility ? 'animate-spin text-cyan-500 dark:text-cyan-400' : ''}`} />
            <span>Refresh All</span>
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Indexed Media Domains</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{credibilityList.length}</div>
            <div className="text-xs text-slate-500 mt-1">Total vetted publishers</div>
          </div>
          <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">Tier 1 Global Leaders</div>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{tier1Count}</div>
            <div className="text-xs text-slate-500 mt-1">High-impact national press</div>
          </div>
          <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">Pending Discovery Review</div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{pendingCount}</div>
            <div className="text-xs text-slate-500 mt-1">Emergent domain candidates</div>
          </div>
          <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 mb-1">Analyst Overrides</div>
            <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400">{overriddenCount}</div>
            <div className="text-xs text-slate-500 mt-1">Human-in-the-loop locks</div>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div className="p-4 rounded-xl bg-cyan-50 dark:bg-slate-900/90 border border-cyan-500/30 text-cyan-800 dark:text-cyan-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>{statusMessage}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xs">
              Dismiss
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('discovery')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2.5 transition-all ${
              activeTab === 'discovery'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Autonomous Source Discovery</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                {pendingCount} new
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('credibility')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2.5 transition-all ${
              activeTab === 'credibility'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Domain Credibility Index</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {credibilityList.length}
            </span>
          </button>
        </div>

        {/* TAB 1: SOURCE DISCOVERY REVIEW QUEUE */}
        {activeTab === 'discovery' && (
          <div className="space-y-6">
            {/* Filter controls */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Review Status:</span>
                <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  {['all', 'pending_review', 'approved', 'rejected'].map(f => (
                    <button
                      key={f}
                      onClick={() => setDiscoveryFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                        discoveryFilter === f
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {f.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <span className="text-xs text-slate-500 font-mono">
                Showing {filteredDiscovered.length} discovered outlets
              </span>
            </div>

            {loadingDiscovery ? (
              <div className="py-20 text-center space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-cyan-500 dark:text-cyan-400 mx-auto" />
                <p className="text-xs text-slate-500 dark:text-slate-400">Loading discovered candidate sources...</p>
              </div>
            ) : filteredDiscovered.length === 0 ? (
              <div className="glass-card p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                  <Globe className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">No Sources in &ldquo;{discoveryFilter}&rdquo;</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  When Agent 6 encounters unregistered domains carrying high-confidence client coverage, it automatically queues them here for analyst evaluation.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDiscovered.map(source => {
                  const clientName = clientsMap[source.matched_client_id] || source.matched_client_id;
                  const isActing = discoveryActionId === source.id;
                  return (
                    <div
                      key={source.id}
                      className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/80 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-sm"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-base font-bold text-slate-900 dark:text-white font-mono">{source.domain}</span>
                          
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            source.status === 'approved' 
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' 
                              : source.status === 'rejected'
                              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                          }`}>
                            {source.status.replace('_', ' ')}
                          </span>

                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-cyan-700 dark:text-cyan-400">
                            Triggered for: <strong className="font-semibold">{clientName}</strong>
                          </span>
                        </div>

                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          <strong className="text-slate-500 dark:text-slate-400">Agent Reason:</strong> {source.reason}
                        </p>

                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                          <a
                            href={source.example_article_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-600 dark:text-cyan-400 hover:underline truncate max-w-md"
                          >
                            {source.example_article_url}
                          </a>
                          <span className="text-slate-400 dark:text-slate-600">•</span>
                          <span className="font-mono text-[11px]">
                            {new Date(source.discovered_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-3 self-end lg:self-center">
                        {source.status === 'pending_review' ? (
                          <>
                            <button
                              onClick={() => handleUpdateSourceStatus(source.id, 'approved')}
                              disabled={isActing}
                              className="px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>Approve Domain</span>
                            </button>
                            <button
                              onClick={() => handleUpdateSourceStatus(source.id, 'rejected')}
                              disabled={isActing}
                              className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-semibold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Reject</span>
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleUpdateSourceStatus(source.id, source.status === 'approved' ? 'rejected' : 'approved')}
                              disabled={isActing}
                              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
                            >
                              Switch to {source.status === 'approved' ? 'Rejected' : 'Approved'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DOMAIN CREDIBILITY INDEX */}
        {activeTab === 'credibility' && (
          <div className="space-y-6">
            {/* Search and filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search verified domain (e.g. reuters.com, techcrunch.com)..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-cyan-500 shadow-sm"
                />
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Showing {filteredCredibility.length} of {credibilityList.length} domains
              </div>
            </div>

            {/* Credibility Table */}
            <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                    <tr>
                      <th className="px-6 py-4">Domain</th>
                      <th className="px-6 py-4">Trust Tier</th>
                      <th className="px-6 py-4">Algorithmic Score</th>
                      <th className="px-6 py-4">Signals Used</th>
                      <th className="px-6 py-4">Analyst Lock</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-200">
                    {filteredCredibility.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                          <span>{item.domain}</span>
                        </td>

                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.tier === 'tier1'
                              ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                              : item.tier === 'tier2'
                              ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {item.tier}
                          </span>
                        </td>

                        <td className="px-6 py-4 font-mono">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  item.credibility_score >= 0.85
                                    ? 'bg-indigo-500 dark:bg-indigo-400'
                                    : item.credibility_score >= 0.65
                                    ? 'bg-cyan-500 dark:bg-cyan-400'
                                    : 'bg-emerald-500 dark:bg-emerald-400'
                                }`}
                                style={{ width: `${Math.round(item.credibility_score * 100)}%` }}
                              />
                            </div>
                            <span className="font-bold">{(item.credibility_score * 100).toFixed(0)}%</span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {item.signals_used.map((signal, sIdx) => (
                              <span
                                key={sIdx}
                                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-400"
                              >
                                {signal}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          {item.manually_overridden ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Overridden</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">Algorithmic</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => openOverrideModal(item)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs transition-colors inline-flex items-center gap-1.5"
                          >
                            <Sliders className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                            <span>Override</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ANALYST CREDIBILITY OVERRIDE */}
        {selectedDomainForOverride && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-card max-w-md w-full p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 bg-white dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Override Domain Credibility</h3>
                </div>
                <button
                  onClick={() => setSelectedDomainForOverride(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Target Domain</span>
                <div className="text-base font-mono font-bold text-cyan-600 dark:text-cyan-300 mt-1">
                  {selectedDomainForOverride.domain}
                </div>
              </div>

              {/* Tier Selection */}
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-2">
                  Designated Trust Tier
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['tier1', 'tier2', 'tier3'] as const).map(tier => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setOverrideTier(tier)}
                      className={`py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                        overrideTier === tier
                          ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>

              {/* Score Slider */}
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Trust Score</span>
                  <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{(overrideScore * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="1.00"
                  step="0.05"
                  value={overrideScore}
                  onChange={e => setOverrideScore(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedDomainForOverride(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitOverride}
                  disabled={submittingOverride}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
                >
                  {submittingOverride ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  <span>Save Override</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

