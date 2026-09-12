'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import {
  Building2,
  Save,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Tag,
  Users,
  Layers,
  Plus,
  Trash2,
  Edit3
} from 'lucide-react';

export default function ClientDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { fetchWithAuth, user } = useAuth();

  const [client, setClient] = useState<any>(null);
  const [parentCompany, setParentCompany] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [subsidiaries, setSubsidiaries] = useState<string[]>([]);
  const [keyExecutives, setKeyExecutives] = useState<string[]>([]);
  const [industryTerms, setIndustryTerms] = useState<string[]>([]);

  // Input helpers
  const [newAlias, setNewAlias] = useState('');
  const [newSub, setNewSub] = useState('');
  const [newExec, setNewExec] = useState('');
  const [newTerm, setNewTerm] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (id) loadClient();
  }, [id]);

  const loadClient = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/v1/clients/${id}`);
      if (res.ok) {
        const data = await res.json();
        setClient(data);
        setParentCompany(data.parent_company || '');
        setAliases(data.aliases || []);
        setSubsidiaries(data.subsidiaries || []);
        setKeyExecutives(data.key_executives || []);
        setIndustryTerms(data.industry_terms || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetchWithAuth(`/api/v1/clients/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          parent_company: parentCompany || null,
          aliases,
          subsidiaries,
          key_executives: keyExecutives,
          industry_terms: industryTerms,
        }),
      });

      if (!res.ok) throw new Error('Failed to update client DNA');

      const updated = await res.json();
      setClient(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      alert(e.message || 'Error saving edits');
    } finally {
      setSaving(false);
    }
  };

  const addItem = (
    val: string,
    setVal: React.Dispatch<React.SetStateAction<string>>,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (!val.trim()) return;
    if (!list.includes(val.trim())) {
      setList([...list, val.trim()]);
    }
    setVal('');
  };

  const removeItem = (item: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
    setList(list.filter((i) => i !== item));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>Client profile not found.</p>
        <Link href="/clients" className="text-indigo-400 underline text-xs mt-2 block">
          Back to Clients
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/clients"
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{client.name}</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                DNA Profile
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {client.last_edited_by
                ? `Last modified by ${client.last_edited_by} — Analyst overrides take priority on pipeline re-runs`
                : 'Auto-synthesized entity profile'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              Saved! Overrides Active
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Analyst Edits'}
          </button>
        </div>
      </div>

      {/* Editor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Parent Company Card */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Parent Company / Conglomerate
            </label>
            {client.manually_edited_fields?.includes('parent_company') && (
              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold flex items-center gap-1">
                <Edit3 className="w-2.5 h-2.5" /> Analyst Override
              </span>
            )}
          </div>
          <input
            type="text"
            value={parentCompany}
            onChange={(e) => setParentCompany(e.target.value)}
            placeholder="e.g. Prosus, Alphabet, Meta"
            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-sm"
          />
          <p className="text-[11px] text-slate-500">
            Mentioning parent company stories in discovery matches will route with high contextual priority.
          </p>
        </div>

        {/* Corporate Aliases */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
          <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Corporate Aliases & Tickers
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem(newAlias, setNewAlias, aliases, setAliases))}
              placeholder="Add alias (e.g. PayU India, AAPL)..."
              className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-sm"
            />
            <button
              type="button"
              onClick={() => addItem(newAlias, setNewAlias, aliases, setAliases)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-white transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-[48px] p-2 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800">
            {aliases.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm"
              >
                {item}
                <button onClick={() => removeItem(item, aliases, setAliases)} className="text-slate-400 hover:text-rose-500">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Operating Subsidiaries & Sub-brands */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
          <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Operating Subsidiaries & Sub-brands
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem(newSub, setNewSub, subsidiaries, setSubsidiaries))}
              placeholder="Add subsidiary (e.g. LazyPay, Wibmo)..."
              className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-sm"
            />
            <button
              type="button"
              onClick={() => addItem(newSub, setNewSub, subsidiaries, setSubsidiaries)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-white transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-[48px] p-2 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800">
            {subsidiaries.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm"
              >
                {item}
                <button onClick={() => removeItem(item, subsidiaries, setSubsidiaries)} className="text-slate-400 hover:text-rose-500">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Industry Jargon & Domain Terms */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
          <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Specialized Industry Jargon & Terms
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem(newTerm, setNewTerm, industryTerms, setIndustryTerms))}
              placeholder="Add term (e.g. BNPL, payment gateway)..."
              className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-sm"
            />
            <button
              type="button"
              onClick={() => addItem(newTerm, setNewTerm, industryTerms, setIndustryTerms)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-white transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-[48px] p-2 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800">
            {industryTerms.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm"
              >
                {item}
                <button onClick={() => removeItem(item, industryTerms, setIndustryTerms)} className="text-slate-400 hover:text-rose-500">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
