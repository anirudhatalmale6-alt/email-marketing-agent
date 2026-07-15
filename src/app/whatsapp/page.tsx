'use client';

import { useState, useEffect, useCallback } from 'react';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  phone: string | null;
}

interface WaMessage {
  id: string;
  direction: string;
  toNumber: string;
  fromNumber: string | null;
  messageType: string;
  body: string;
  status: string;
  createdAt: string;
  lead: { id: string; firstName: string; lastName: string; company: string | null } | null;
}

const DELIVERY_TEMPLATE =
  'Hi {{firstName}}, this is Dennison Business Solutions. Your order is scheduled for delivery on {{date}}. Please reply RECEIVED once it arrives. Thank you!';

export default function WhatsAppPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadId, setLeadId] = useState('');
  const [toNumber, setToNumber] = useState('');
  const [message, setMessage] = useState(DELIVERY_TEMPLATE);
  const [date, setDate] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [loadingLog, setLoadingLog] = useState(true);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const notify = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads?limit=1000');
      if (!res.ok) return;
      const json = await res.json();
      const list: Lead[] = Array.isArray(json) ? json : json.leads || [];
      setLeads(list.filter((l) => l.phone));
    } catch {
      /* ignore */
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/messages?limit=50');
      if (res.ok) setMessages(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoadingLog(false);
    }
  }, []);

  const checkConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const json = await res.json();
        setConfigured(Boolean(json.whatsappSessionUrl));
      }
    } catch {
      setConfigured(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchMessages();
    checkConfig();
  }, [fetchLeads, fetchMessages, checkConfig]);

  const selectedLead = leads.find((l) => l.id === leadId);

  function handleSelectLead(id: string) {
    setLeadId(id);
    const lead = leads.find((l) => l.id === id);
    if (lead?.phone) setToNumber(lead.phone);
  }

  async function handleSend() {
    if (!message.trim()) {
      notify('error', 'Please write a message first.');
      return;
    }
    if (!leadId && !toNumber.trim()) {
      notify('error', 'Enter a phone number or pick a customer.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: toNumber, message, leadId: leadId || undefined, date }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      notify('success', 'WhatsApp message sent!');
      fetchMessages();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to send WhatsApp message');
    } finally {
      setSending(false);
    }
  }

  function preview(): string {
    let m = message;
    m = m.replace(/\{\{\s*firstName\s*\}\}/g, selectedLead?.firstName || 'there');
    m = m.replace(/\{\{\s*lastName\s*\}\}/g, selectedLead?.lastName || '');
    m = m.replace(/\{\{\s*company\s*\}\}/g, selectedLead?.company || '');
    m = m.replace(/\{\{\s*date\s*\}\}/g, date || '[date]');
    return m;
  }

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      sent: 'bg-blue-100 text-blue-700',
      delivered: 'bg-emerald-100 text-emerald-700',
      received: 'bg-emerald-100 text-emerald-700',
      failed: 'bg-red-100 text-red-700',
    };
    return map[status] || 'bg-gray-100 text-gray-600';
  }

  return (
    <div className="p-6 space-y-6">
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            notification.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {notification.message}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500">
          <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.55 8.86c-.06-.11-.22-.17-.47-.29-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43z"/>
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp</h1>
          <p className="text-sm text-gray-500">Send delivery notifications and messages to customers</p>
        </div>
      </div>

      {configured === false && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          WhatsApp isn&apos;t connected yet. Go to <a href="/settings" className="font-semibold underline">Settings</a> and paste your mittosapi Session Message API link, then come back here to send.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Send a message</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer (optional)</label>
            <select
              value={leadId}
              onChange={(e) => handleSelectLead(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="">— Type a number below —</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.firstName} {l.lastName}{l.company ? ` (${l.company})` : ''} — {l.phone}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">Only customers with a saved phone number are listed. Picking one auto-fills the number and personalises {'{{firstName}}'}.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone number (with country code, no +)</label>
            <input
              type="text"
              value={toNumber}
              onChange={(e) => setToNumber(e.target.value)}
              placeholder="e.g. 447911123456"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery date (fills {'{{date}}'})</label>
            <input
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="e.g. Monday, 21 July"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Message</label>
              <button
                onClick={() => setMessage(DELIVERY_TEMPLATE)}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Reset to delivery template
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="mt-1 text-xs text-gray-400">Tags: {'{{firstName}}'}, {'{{lastName}}'}, {'{{company}}'}, {'{{date}}'}</p>
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-xs font-medium text-gray-500 mb-1">Preview</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{preview()}</p>
          </div>

          <button
            onClick={handleSend}
            disabled={sending}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {sending ? 'Sending...' : 'Send WhatsApp message'}
          </button>
        </div>

        {/* Log */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent messages</h2>
            <button onClick={fetchMessages} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">Refresh</button>
          </div>

          {loadingLog ? (
            <div className="py-12 flex justify-center">
              <div className="h-6 w-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No messages yet. Send your first one on the left.</div>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto">
              {messages.map((m) => (
                <div key={m.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.direction === 'inbound' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {m.direction === 'inbound' ? 'Reply' : 'Sent'}
                      </span>
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {m.lead ? `${m.lead.firstName} ${m.lead.lastName}` : (m.direction === 'inbound' ? m.fromNumber : m.toNumber)}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(m.status)}`}>{m.status}</span>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{m.body}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(m.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
