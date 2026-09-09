'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import {
  Building2,
  Plus,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Tag,
  Users,
  ShieldCheck,
  Edit3
} from 'lucide-react';

interface ClientItem {
  id: string;
  client_id: string;
  name: string;
  parent_company?: string;
  aliases: string[];
  subsidiaries: string[];
  key_executives: string[];
  industry_terms: string[];
  last_edited_by?: string;
  manually_edited_fields: string[];
  generated_at?: string;
}

export default function ClientsPage() {
  const { fetchWithAuth } = useAuth();
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [clientName, setClientName] = useState('');
  const [seedDescription, setSeedDescription] = useState('');
  const [seedUrl, setSeedUrl] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/v1/clients');
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName) return;

    setGenerating(true);
    try {
      const res = await fetchWithAuth('/api/v1/clients', {
        method: 'POST',
        body: JSON.stringify({
          client_name: clientName,
          seed_description: seedDescription || null,
          seed_url: seedUrl || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to generate DNA profile');
      }

      setShowModal(false);
      setClientName('');
      setSeedDescription('');
      setSeedUrl('');
      await loadClients();
    } catch (err: any) {
      alert(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Client DNA Profiles</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Agent 2 Entity Knowledge Graph
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated corporate aliases, subsidiaries, executive leadership, and specialized industry jargon profiles.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition"
        >
          <Plus className="w-4 h-4" />
          Generate New Client DNA
        </button>
      </div>

      {/* Clients Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-slate-400">Loading Client DNA profiles...</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border border-slate-800">
          <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No Client Profiles Configured</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Create your first client profile (e.g., PayU, Apple, Amazon, Reliance) to automatically generate comprehensive DNA.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {clients.map((client) => {
            const hasOverrides = client.manually_edited_fields && client.manually_edited_fields.length > 0;

            return (
              <div
                key={client.id}
                className="glass-card rounded-2xl p-6 border border-slate-800/80 hover:border-indigo-500/40 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-tight">{client.name}</h2>
                      {client.parent_company && (
                        <p className="text-xs text-slate-400">
                          Parent: <span className="text-slate-200 font-medium">{client.parent_company}</span>
                        </p>
                      )}
                    </div>
                    {hasOverrides && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950/60 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                        <Edit3 className="w-2.5 h-2.5" />
                        Analyst Override
                      </span>
                    )}
                  </div>

                  {/* Industry Terms */}
                  <div className="mb-4">
                    <span className="text-[10px] uppercase font-semibold text-indigo-400 tracking-wider block mb-1.5">
                      Domain Jargon
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {client.industry_terms?.slice(0, 5).map((term, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md text-[10px] bg-slate-900 border border-slate-800 text-slate-300"
                        >
                          {term}
                        </span>
                      ))}
                      {(client.industry_terms?.length || 0) > 5 && (
                        <span className="px-1.5 py-0.5 text-[10px] text-slate-500">
                          +{client.industry_terms.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Aliases & Subs */}
                  <div className="space-y-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                    <p className="truncate">
                      <strong className="text-slate-300">Aliases:</strong> {client.aliases?.join(', ') || 'None'}
                    </p>
                    <p className="truncate">
                      <strong className="text-slate-300">Subsidiaries:</strong>{' '}
                      {client.subsidiaries?.join(', ') || 'None'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">
                    {client.last_edited_by ? `Edited by ${client.last_edited_by}` : 'Auto-generated via LLM'}
                  </span>
                  <Link
                    href={`/clients/${client.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                  >
                    View & Edit DNA
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Generation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-panel rounded-2xl p-6 border border-slate-700/80 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Generate Client DNA Profile</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Company / Brand Name</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. PayU, Apple, Amazon, Reliance"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Seed Description (Optional)</label>
                <textarea
                  rows={3}
                  value={seedDescription}
                  onChange={(e) => setSeedDescription(e.target.value)}
                  placeholder="e.g. Global payment services provider operating in emerging markets..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Corporate URL (Optional)</label>
                <input
                  type="url"
                  value={seedUrl}
                  onChange={(e) => setSeedUrl(e.target.value)}
                  placeholder="https://corporate.payu.com"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Synthesizing Knowledge Graph...
                    </>
                  ) : (
                    'Generate DNA Profile'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
