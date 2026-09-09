'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import { 
  Sliders, 
  Sparkles, 
  Play, 
  Save, 
  Trash2, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Globe, 
  ShieldCheck, 
  Filter, 
  Search,
  ChevronRight,
  RefreshCw,
  Layers
} from 'lucide-react';

interface Client {
  id: string;
  name: string;
  industry?: string;
}

interface RuleFilterData {
  client_id: string;
  geography: string[];
  domain_tiers: ("tier1" | "tier2" | "tier3")[];
  recency_hours: number | null;
  mandatory_terms: string[];
  excluded_terms: string[];
}

interface ActiveRule {
  id: string;
  client_id: string;
  name: string;
  natural_language_text: string | null;
  geography: string[];
  domain_tiers: string[];
  recency_hours: number | null;
  mandatory_terms: string[];
  excluded_terms: string[];
  created_at: string;
}

const PRESET_RULES = [
  "Only show Tier 1 national news published in India or Global within the last 48 hours, excluding cricket and sports",
  "Include fintech, digital payments, and regulatory banking news in North America or Europe, exclude crypto and gambling",
  "Strict Tier 1 and Tier 2 trade press regarding mergers, acquisitions, and funding rounds from the past 7 days"
];

export default function RulesPage() {
  const { fetchWithAuth } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [activeRules, setActiveRules] = useState<ActiveRule[]>([]);
  const [loadingRules, setLoadingRules] = useState<boolean>(false);

  // Natural Language state
  const [nlPrompt, setNlPrompt] = useState<string>('');
  const [parsingNl, setParsingNl] = useState<boolean>(false);
  const [parseMessage, setParseMessage] = useState<string | null>(null);

  // Form Filter state
  const [ruleName, setRuleName] = useState<string>('National Tier 1 Coverage Filter');
  const [geographyInput, setGeographyInput] = useState<string>('');
  const [geographies, setGeographies] = useState<string[]>(['India', 'Global']);
  const [domainTiers, setDomainTiers] = useState<("tier1" | "tier2" | "tier3")[]>(['tier1', 'tier2']);
  const [recencyHours, setRecencyHours] = useState<number>(48);
  const [mandatoryInput, setMandatoryInput] = useState<string>('');
  const [mandatoryTerms, setMandatoryTerms] = useState<string[]>(['fintech', 'payments']);
  const [excludedInput, setExcludedInput] = useState<string>('');
  const [excludedTerms, setExcludedTerms] = useState<string[]>(['crypto', 'sports', 'cricket']);

  // Preview state
  const [previewing, setPreviewing] = useState<boolean>(false);
  const [previewResult, setPreviewResult] = useState<{ matched_article_count: number; sample_matches: string[] } | null>(null);
  const [savingRule, setSavingRule] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch clients on mount
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

  // Fetch active rules when client changes
  useEffect(() => {
    if (!selectedClientId) return;
    loadClientRules(selectedClientId);
  }, [selectedClientId]);

  async function loadClientRules(clientId: string) {
    setLoadingRules(true);
    try {
      const res = await fetchWithAuth(`/api/v1/rules/client/${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveRules(data);
      }
    } catch (err) {
      console.error('Failed to load rules:', err);
    } finally {
      setLoadingRules(false);
    }
  }

  // Parse natural language rule
  async function handleParseNl() {
    if (!nlPrompt.trim() || !selectedClientId) return;
    setParsingNl(true);
    setParseMessage(null);
    try {
      const res = await fetchWithAuth('/api/v1/rules/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClientId,
          natural_language_rule: nlPrompt.trim(),
        }),
      });
      if (res.ok) {
        const parsed: RuleFilterData = await res.json();
        if (parsed.geography?.length) setGeographies(parsed.geography);
        if (parsed.domain_tiers?.length) setDomainTiers(parsed.domain_tiers);
        if (parsed.recency_hours) setRecencyHours(parsed.recency_hours);
        if (parsed.mandatory_terms?.length) setMandatoryTerms(parsed.mandatory_terms);
        if (parsed.excluded_terms?.length) setExcludedTerms(parsed.excluded_terms);
        setParseMessage('Successfully parsed natural language query into structured filter criteria!');
      } else {
        setParseMessage('Agent could not fully parse prompt. Please review manual criteria.');
      }
    } catch (err) {
      setParseMessage('Error parsing prompt. Please adjust manually.');
    } finally {
      setParsingNl(false);
    }
  }

  // Preview rule against corpus
  async function handlePreview() {
    if (!selectedClientId) return;
    setPreviewing(true);
    setStatusMessage(null);
    try {
      const filterData: RuleFilterData = {
        client_id: selectedClientId,
        geography: geographies,
        domain_tiers: domainTiers,
        recency_hours: recencyHours > 0 ? recencyHours : null,
        mandatory_terms: mandatoryTerms,
        excluded_terms: excludedTerms,
      };

      const res = await fetchWithAuth('/api/v1/rules/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filterData),
      });

      if (res.ok) {
        const data = await res.json();
        setPreviewResult(data);
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to simulate rule preview.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Error simulating rule preview.' });
    } finally {
      setPreviewing(false);
    }
  }

  // Save rule
  async function handleSaveRule() {
    if (!selectedClientId || !ruleName.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid rule name.' });
      return;
    }
    setSavingRule(true);
    setStatusMessage(null);
    try {
      const filterData: RuleFilterData = {
        client_id: selectedClientId,
        geography: geographies,
        domain_tiers: domainTiers,
        recency_hours: recencyHours > 0 ? recencyHours : null,
        mandatory_terms: mandatoryTerms,
        excluded_terms: excludedTerms,
      };

      const payload = {
        client_id: selectedClientId,
        name: ruleName.trim(),
        natural_language_text: nlPrompt.trim() || null,
        filter_data: filterData,
      };

      const res = await fetchWithAuth('/api/v1/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: `Rule "${ruleName}" successfully committed!` });
        loadClientRules(selectedClientId);
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to save rule. Please verify inputs.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Network error while saving rule.' });
    } finally {
      setSavingRule(false);
    }
  }

  // Delete rule
  async function handleDeleteRule(ruleId: string) {
    try {
      const res = await fetchWithAuth(`/api/v1/rules/${ruleId}`, { method: 'DELETE' });
      if (res.ok) {
        setActiveRules(prev => prev.filter(r => r.id !== ruleId));
      }
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  }

  // Helpers for tag inputs
  const addTag = (val: string, list: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    const trimmed = val.trim();
    if (trimmed && !list.includes(trimmed)) {
      setter([...list, trimmed]);
    }
  };

  const removeTag = (item: string, list: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(list.filter(x => x !== item));
  };

  const toggleTier = (tier: "tier1" | "tier2" | "tier3") => {
    if (domainTiers.includes(tier)) {
      if (domainTiers.length > 1) {
        setDomainTiers(domainTiers.filter(t => t !== tier));
      }
    } else {
      setDomainTiers([...domainTiers, tier]);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-16">
      {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400">
                <Sliders className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Adaptive Business Rules Engine</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Agent 5
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Translate plain-English editorial directives into verifiable, simulated filter constraints before applying them to discovery.
            </p>
          </div>

          {/* Client Selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Target Client:</span>
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white text-sm font-medium focus:outline-none focus:border-amber-500/50 transition-all shadow-inner"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                  {c.name} {c.industry ? `(${c.industry})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm animate-in fade-in duration-200 ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Top Section: Natural Language Parser Box */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-semibold text-white">Natural Language Rule Translation</h2>
            </div>
            <span className="text-xs text-slate-500 font-mono">Agent5 · RuleEngineAgent.parse_natural_language()</span>
          </div>

          <p className="text-xs text-slate-400 mb-3">
            Type any plain-English editorial requirement, geography exclusion, or tier condition. The agent extracts structured parameters automatically.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={nlPrompt}
                onChange={e => setNlPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleParseNl()}
                placeholder="e.g. Only keep national Tier 1 news from India or Global published in the past 48 hours, exclude sports and cricket"
                className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-all"
              />
            </div>
            <button
              onClick={handleParseNl}
              disabled={parsingNl || !nlPrompt.trim()}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-amber-500/20"
            >
              {parsingNl ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{parsingNl ? 'Parsing with LLM...' : 'Parse Rule'}</span>
            </button>
          </div>

          {/* Quick Preset Badges */}
          <div className="mt-4 pt-4 border-t border-slate-800/60">
            <div className="text-xs font-semibold text-slate-400 mb-2">Quick Editorial Presets:</div>
            <div className="flex flex-wrap gap-2">
              {PRESET_RULES.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setNlPrompt(preset);
                  }}
                  className="text-left text-xs px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-amber-500/40 text-slate-300 transition-all group flex items-center gap-2"
                >
                  <ChevronRight className="w-3 h-3 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                  <span>{preset}</span>
                </button>
              ))}
            </div>
          </div>

          {parseMessage && (
            <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{parseMessage}</span>
            </div>
          )}
        </div>

        {/* Middle Section: 2 Columns (Structured Criteria Editor & Live 7-Day Preview Simulator) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Column 1: Structured Rule Form (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-semibold text-white">Structured Filter Definition</h3>
                </div>
                <span className="text-xs text-slate-400">Deterministic Rule Engine</span>
              </div>

              {/* Rule Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Rule Name / Label
                </label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={e => setRuleName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. National Tier 1 Coverage Filter"
                />
              </div>

              {/* Domain Tiers */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Target Domain Tiers
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'tier1', label: 'Tier 1', desc: 'National & Global Leaders', color: 'indigo' },
                    { id: 'tier2', label: 'Tier 2', desc: 'Regional & Trade Press', color: 'cyan' },
                    { id: 'tier3', label: 'Tier 3', desc: 'Blogs, Niche & Local', color: 'emerald' },
                  ].map(t => {
                    const isSelected = domainTiers.includes(t.id as any);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTier(t.id as any)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected 
                            ? 'bg-indigo-600/20 border-indigo-500/50 text-white shadow-md shadow-indigo-500/10' 
                            : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">{t.label}</span>
                          <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-400 shadow-sm shadow-indigo-400' : 'bg-slate-700'}`} />
                        </div>
                        <div className="text-[11px] text-slate-400 leading-tight">{t.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Recency Hours Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Recency Lookback Limit</span>
                  </label>
                  <span className="text-xs font-bold text-amber-400 font-mono">{recencyHours} Hours ({Math.round(recencyHours / 24)} days)</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="168"
                  step="6"
                  value={recencyHours}
                  onChange={e => setRecencyHours(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                  <span>6h (Breaking)</span>
                  <span>24h (Daily)</span>
                  <span>48h</span>
                  <span>7d (Weekly)</span>
                </div>
              </div>

              {/* Geographies */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Geographic Targets</span>
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={geographyInput}
                    onChange={e => setGeographyInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(geographyInput, geographies, setGeographies);
                        setGeographyInput('');
                      }
                    }}
                    placeholder="Add geography (e.g. India, US, Europe)..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      addTag(geographyInput, geographies, setGeographies);
                      setGeographyInput('');
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {geographies.map(geo => (
                    <span key={geo} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs">
                      {geo}
                      <button onClick={() => removeTag(geo, geographies, setGeographies)} className="hover:text-cyan-100">×</button>
                    </span>
                  ))}
                  {geographies.length === 0 && <span className="text-xs text-slate-500 italic">No geographic limits (global)</span>}
                </div>
              </div>

              {/* Mandatory Terms */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Mandatory Inclusions (Article Must Contain At Least One)</span>
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={mandatoryInput}
                    onChange={e => setMandatoryInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(mandatoryInput, mandatoryTerms, setMandatoryTerms);
                        setMandatoryInput('');
                      }
                    }}
                    placeholder="Add mandatory term..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      addTag(mandatoryInput, mandatoryTerms, setMandatoryTerms);
                      setMandatoryInput('');
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {mandatoryTerms.map(term => (
                    <span key={term} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                      +{term}
                      <button onClick={() => removeTag(term, mandatoryTerms, setMandatoryTerms)} className="hover:text-emerald-100">×</button>
                    </span>
                  ))}
                  {mandatoryTerms.length === 0 && <span className="text-xs text-slate-500 italic">No required keywords</span>}
                </div>
              </div>

              {/* Excluded Terms */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Excluded Terms (Disqualifies Article Automatically)</span>
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={excludedInput}
                    onChange={e => setExcludedInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(excludedInput, excludedTerms, setExcludedTerms);
                        setExcludedInput('');
                      }
                    }}
                    placeholder="Add exclusion (e.g. cricket, sports, gambling)..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-rose-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      addTag(excludedInput, excludedTerms, setExcludedTerms);
                      setExcludedInput('');
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {excludedTerms.map(term => (
                    <span key={term} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                      -{term}
                      <button onClick={() => removeTag(term, excludedTerms, setExcludedTerms)} className="hover:text-rose-100">×</button>
                    </span>
                  ))}
                  {excludedTerms.length === 0 && <span className="text-xs text-slate-500 italic">No exclusion filters</span>}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={previewing}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all"
                >
                  {previewing ? <RefreshCw className="w-4 h-4 animate-spin text-amber-400" /> : <Play className="w-4 h-4 text-amber-400 fill-amber-400/20" />}
                  <span>{previewing ? 'Simulating Corpus...' : 'Preview Rule (7-Day Simulator)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveRule}
                  disabled={savingRule || !ruleName.trim()}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
                >
                  {savingRule ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{savingRule ? 'Saving Rule...' : 'Save & Activate Rule'}</span>
                </button>
              </div>

            </div>
          </div>

          {/* Column 2: 7-Day Preview Simulator Results (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-card p-6 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <Play className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-semibold text-white">Live Simulator Output</h3>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                  {previewResult ? `${previewResult.matched_article_count} Matched` : 'Ready'}
                </span>
              </div>

              {!previewResult ? (
                <div className="text-center py-12 px-4 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-200">No Simulation Run Yet</h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Click &ldquo;Preview Rule (7-Day Simulator)&rdquo; to test your structured criteria against the current ingested article corpus before committing.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="text-xs text-slate-400 mb-1">Estimated Ingestion Volume</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-white">{previewResult.matched_article_count}</span>
                      <span className="text-xs text-emerald-400 font-medium">articles meet all rule criteria</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                      Sample Matched Headlines:
                    </div>
                    {previewResult.sample_matches.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
                        No articles in current test corpus matched these exact constraints.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {previewResult.sample_matches.map((headline, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 flex items-start gap-2.5 transition-colors"
                          >
                            <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                              ✓
                            </span>
                            <span className="leading-snug">{headline}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Rule Engine Explainability Tip */}
            <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-2">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Zero-Hallucination Pipeline Guard</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Rules are evaluated as strict boolean conjunctions before contextual validation. If an article violates an exclusion or tier barrier, it is disqualified immediately with an audit log reason code, saving downstream LLM compute.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Section: Active Rules Table */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-base font-bold text-white">Active Client Rules</h3>
                <p className="text-xs text-slate-400">Rules applied in production to discovery and alerts for this client</p>
              </div>
            </div>
            <button
              onClick={() => selectedClientId && loadClientRules(selectedClientId)}
              disabled={loadingRules}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Refresh Rules"
            >
              <RefreshCw className={`w-4 h-4 ${loadingRules ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {activeRules.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              No active rules configured for this client yet. Create one above to tailor feed filtering!
            </div>
          ) : (
            <div className="space-y-3">
              {activeRules.map(rule => (
                <div
                  key={rule.id}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-semibold text-white">{rule.name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {rule.recency_hours ? `Last ${rule.recency_hours}h` : 'No recency limit'}
                      </span>
                    </div>

                    {rule.natural_language_text && (
                      <p className="text-xs text-slate-400 italic">
                        &ldquo;{rule.natural_language_text}&rdquo;
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      {/* Tiers */}
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-semibold">Tiers:</span>
                        {rule.domain_tiers.map(t => (
                          <span key={t} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase font-mono text-[10px]">
                            {t}
                          </span>
                        ))}
                      </div>

                      {/* Geography */}
                      {rule.geography.length > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500 font-semibold">Geo:</span>
                          <span className="text-cyan-400">{rule.geography.join(', ')}</span>
                        </div>
                      )}

                      {/* Excluded */}
                      {rule.excluded_terms.length > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500 font-semibold">Excluded:</span>
                          <span className="text-rose-400">{rule.excluded_terms.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(rule.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
  );
}
