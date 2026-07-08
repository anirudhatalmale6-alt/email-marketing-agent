'use client';

import { useState, useEffect, useCallback } from 'react';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  phone: string | null;
}

interface CallLead {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
}

interface Call {
  id: string;
  callType: string;
  toNumber: string;
  status: string;
  answeredBy: string | null;
  outcome: string | null;
  summary: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  durationSec: number | null;
  createdAt: string;
  lead: CallLead | null;
}

export default function CallsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  const [leadId, setLeadId] = useState('');
  const [toNumber, setToNumber] = useState('');
  const [callType, setCallType] = useState<'prospect' | 'customer'>('prospect');
  const [placing, setPlacing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const notify = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads');
      if (res.ok) {
        const data = await res.json();
        setLeads((data.leads ?? data) as Lead[]);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchCalls = useCallback(async () => {
    try {
      const res = await fetch('/api/calls');
      if (res.ok) setCalls(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchCalls();
  }, [fetchLeads, fetchCalls]);

  const onSelectLead = (id: string) => {
    setLeadId(id);
    const lead = leads.find((l) => l.id === id);
    if (lead?.phone) setToNumber(lead.phone);
  };

  const placeCall = async () => {
    if (!toNumber.trim() && !leadId) {
      notify('error', 'Pick a lead or enter a phone number to call.');
      return;
    }
    setPlacing(true);
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: leadId || undefined, toNumber: toNumber.trim() || undefined, callType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place call');
      notify('success', 'Call placed! The AI is dialing now. Hit Refresh in a minute to see the result.');
      setToNumber('');
      setLeadId('');
      fetchCalls();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to place call');
    } finally {
      setPlacing(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/calls/sync', { method: 'POST' });
      await fetchCalls();
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  const statusBadge = (call: Call) => {
    const s = call.status;
    if (s === 'completed') {
      if (call.answeredBy === 'human') return { label: 'Answered', cls: 'bg-emerald-100 text-emerald-700' };
      if (call.answeredBy === 'voicemail') return { label: 'Voicemail', cls: 'bg-amber-100 text-amber-700' };
      if (call.answeredBy === 'no-answer') return { label: 'No answer', cls: 'bg-gray-100 text-gray-600' };
      return { label: 'Completed', cls: 'bg-emerald-100 text-emerald-700' };
    }
    if (s === 'failed') return { label: 'Failed', cls: 'bg-red-100 text-red-700' };
    if (s === 'initiated') return { label: 'Calling…', cls: 'bg-blue-100 text-blue-700' };
    return { label: 'Queued', cls: 'bg-gray-100 text-gray-600' };
  };

  return (
    <div className="p-6 space-y-6">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-md ${
          notification.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Place a call */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Place an AI Call</h2>
        <p className="text-sm text-gray-500 mb-4">The AI agent (Tobjee from Dennison Business Solutions) will call the number and have a real conversation, then log the outcome below.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Call type</label>
            <select
              value={callType}
              onChange={(e) => setCallType(e.target.value as 'prospect' | 'customer')}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="prospect">New prospect — pitch Wooden RFID Key Cards</option>
              <option value="customer">Existing customer — reorder + Wooden Door Hangers</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lead (optional)</label>
            <select
              value={leadId}
              onChange={(e) => onSelectLead(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Ad-hoc call (no lead) —</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.firstName} {l.lastName}{l.company ? ` · ${l.company}` : ''}{l.phone ? '' : ' (no phone)'}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone number (with country code)</label>
            <input
              type="tel"
              value={toNumber}
              onChange={(e) => setToNumber(e.target.value)}
              placeholder="+14155550123"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="mt-1 text-xs text-gray-400">Must include the country code, e.g. +1 for US, +44 for UK, +91 for India. UAE numbers won&apos;t connect (carrier restriction).</p>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={placeCall}
            disabled={placing}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {placing ? 'Placing call…' : 'Call now'}
          </button>
        </div>
      </div>

      {/* Call history */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Call Results</h2>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : calls.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No calls yet. Place your first call above.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {calls.map((call) => {
              const badge = statusBadge(call);
              const who = call.lead ? `${call.lead.firstName} ${call.lead.lastName}` : call.toNumber;
              const isOpen = expanded === call.id;
              return (
                <div key={call.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{who}</span>
                        {call.lead?.company && <span className="text-xs text-gray-400">{call.lead.company}</span>}
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                        <span className="text-xs text-gray-400">
                          {call.callType === 'customer' ? 'Existing customer' : 'New prospect'}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500 font-mono">{call.toNumber}</div>
                      {call.summary && (
                        <p className="mt-2 text-sm text-gray-700">{call.summary}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-gray-400">{new Date(call.createdAt).toLocaleString()}</div>
                      {call.durationSec ? (
                        <div className="text-xs text-gray-400 mt-1">{Math.floor(call.durationSec / 60)}m {call.durationSec % 60}s</div>
                      ) : null}
                    </div>
                  </div>

                  {(call.transcript || call.recordingUrl) && (
                    <div className="mt-2">
                      <button
                        onClick={() => setExpanded(isOpen ? null : call.id)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        {isOpen ? 'Hide details' : 'Transcript & recording'}
                      </button>
                      {isOpen && (
                        <div className="mt-2 space-y-3">
                          {call.recordingUrl && (
                            <audio controls src={call.recordingUrl} className="w-full max-w-md">
                              Your browser does not support audio playback.
                            </audio>
                          )}
                          {call.transcript && (
                            <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-700 max-h-72 overflow-y-auto">{call.transcript}</pre>
                          )}
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
    </div>
  );
}
