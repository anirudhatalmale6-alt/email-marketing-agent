'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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

interface BulkRow {
  index: number;
  firstName: string;
  lastName: string;
  cardType: string;
  trackingNo: string;
  mobile: string;
}

interface RowResult {
  index: number;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  error?: string;
}

const DELIVERY_TEMPLATE =
  'Dear {{firstName}}, your {{cardType}} card has been sent via DHL, Tracking No {{trackingNo}}. Please confirm if you received.';

const SIMPLE_TEMPLATE =
  'Hi {{firstName}}, this is Dennison Business Solutions. Your order is scheduled for delivery on {{date}}. Please reply RECEIVED once it arrives. Thank you!';

function fillRow(template: string, row: Partial<BulkRow> & { date?: string }): string {
  return template
    .replace(/\{\{\s*firstName\s*\}\}/gi, row.firstName || '')
    .replace(/\{\{\s*lastName\s*\}\}/gi, row.lastName || '')
    .replace(/\{\{\s*cardType\s*\}\}/gi, row.cardType || '')
    .replace(/\{\{\s*trackingNo\s*\}\}/gi, row.trackingNo || '')
    .replace(/\{\{\s*date\s*\}\}/gi, row.date || '');
}

export default function WhatsAppPage() {
  const [tab, setTab] = useState<'bulk' | 'single'>('bulk');

  // shared
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [loadingLog, setLoadingLog] = useState(true);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // single
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadId, setLeadId] = useState('');
  const [toNumber, setToNumber] = useState('');
  const [singleMessage, setSingleMessage] = useState(SIMPLE_TEMPLATE);
  const [date, setDate] = useState('');
  const [sending, setSending] = useState(false);

  // bulk
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [bulkTemplate, setBulkTemplate] = useState(DELIVERY_TEMPLATE);
  const [useButtons, setUseButtons] = useState(true);
  const [btn1, setBtn1] = useState('Yes');
  const [btn2, setBtn2] = useState('No');
  const [btn3, setBtn3] = useState('Call Back');
  const [bulkSending, setBulkSending] = useState(false);
  const [results, setResults] = useState<Record<number, RowResult>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads');
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

  // ---------- Bulk ----------
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setResults({});
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/whatsapp/parse', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not read the file');
      setRows(json.rows || []);
      setFileName(file.name);
      if ((json.valid || 0) === 0) {
        notify('error', 'No valid phone numbers found. Check the Mobile_no column.');
      } else {
        notify('success', `Loaded ${json.total} rows (${json.valid} with valid numbers).`);
      }
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to read the file');
    } finally {
      setParsing(false);
    }
  }

  const validRows = rows.filter((r) => r.mobile.replace(/[^0-9]/g, '').length >= 8);

  async function handleBulkSend() {
    if (validRows.length === 0) {
      notify('error', 'No valid rows to send.');
      return;
    }
    setBulkSending(true);
    const buttons = useButtons ? [btn1, btn2, btn3].filter((b) => b.trim()) : [];
    const init: Record<number, RowResult> = {};
    validRows.forEach((r) => (init[r.index] = { index: r.index, status: 'pending' }));
    setResults({ ...init });

    let sent = 0;
    let failed = 0;
    for (const row of validRows) {
      setResults((prev) => ({ ...prev, [row.index]: { index: row.index, status: 'sending' } }));
      const message = fillRow(bulkTemplate, row);
      try {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: row.mobile,
            message,
            mode: useButtons ? 'buttons' : 'text',
            buttons,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Send failed');
        sent++;
        setResults((prev) => ({ ...prev, [row.index]: { index: row.index, status: 'sent' } }));
      } catch (err) {
        failed++;
        setResults((prev) => ({
          ...prev,
          [row.index]: { index: row.index, status: 'failed', error: err instanceof Error ? err.message : 'Failed' },
        }));
      }
      // small pause to be gentle on the provider
      await new Promise((r) => setTimeout(r, 400));
    }

    setBulkSending(false);
    notify(failed === 0 ? 'success' : 'error', `Done. Sent ${sent}, failed ${failed}.`);
    fetchMessages();
  }

  const bulkPreview = validRows.length > 0 ? fillRow(bulkTemplate, validRows[0]) : fillRow(bulkTemplate, { firstName: 'John', cardType: 'Wooden RFID', trackingNo: '1245645' });

  // ---------- Single ----------
  const selectedLead = leads.find((l) => l.id === leadId);
  function handleSelectLead(id: string) {
    setLeadId(id);
    const lead = leads.find((l) => l.id === id);
    if (lead?.phone) setToNumber(lead.phone);
  }
  async function handleSingleSend() {
    if (!singleMessage.trim()) { notify('error', 'Please write a message.'); return; }
    if (!leadId && !toNumber.trim()) { notify('error', 'Enter a number or pick a customer.'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: toNumber, message: singleMessage, leadId: leadId || undefined, date }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      notify('success', 'WhatsApp message sent!');
      fetchMessages();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }
  function singlePreview(): string {
    return fillRow(singleMessage, {
      firstName: selectedLead?.firstName || 'there',
      lastName: selectedLead?.lastName || '',
      date: date || '[date]',
    });
  }

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      sent: 'bg-blue-100 text-blue-700',
      sending: 'bg-amber-100 text-amber-700',
      pending: 'bg-gray-100 text-gray-500',
      delivered: 'bg-emerald-100 text-emerald-700',
      received: 'bg-emerald-100 text-emerald-700',
      failed: 'bg-red-100 text-red-700',
    };
    return map[status] || 'bg-gray-100 text-gray-600';
  }

  const sentCount = Object.values(results).filter((r) => r.status === 'sent').length;
  const doneCount = Object.values(results).filter((r) => r.status === 'sent' || r.status === 'failed').length;

  return (
    <div className="p-6 space-y-6">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${notification.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {notification.message}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500">
          <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2z"/>
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp</h1>
          <p className="text-sm text-gray-500">Send delivery notifications and track replies</p>
        </div>
      </div>

      {configured === false && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          WhatsApp isn&apos;t connected yet. Go to <a href="/settings" className="font-semibold underline">Settings</a> and paste your mittosapi Session Message API link, then come back here.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('bulk')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'bulk' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>Bulk from Excel</button>
        <button onClick={() => setTab('single')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'single' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>Single message</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {tab === 'bulk' ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Bulk delivery messages</h2>

              {/* Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">1. Upload Excel / CSV</label>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
                <button onClick={() => fileRef.current?.click()} disabled={parsing} className="w-full border-2 border-dashed border-gray-300 rounded-lg py-6 text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors disabled:opacity-50">
                  {parsing ? 'Reading file...' : fileName ? `${fileName} — click to replace` : 'Click to choose a file (First Name, Card_Type, Tracking No, Mobile_no)'}
                </button>
                {rows.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">{rows.length} rows loaded, {validRows.length} with valid numbers.</p>
                )}
              </div>

              {/* Message */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">2. Message</label>
                  <button onClick={() => setBulkTemplate(DELIVERY_TEMPLATE)} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Reset template</button>
                </div>
                <textarea value={bulkTemplate} onChange={(e) => setBulkTemplate(e.target.value)} rows={4} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                <p className="mt-1 text-xs text-gray-400">Tags: {'{{firstName}}'}, {'{{cardType}}'}, {'{{trackingNo}}'}</p>
              </div>

              {/* Buttons */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <input type="checkbox" checked={useButtons} onChange={(e) => setUseButtons(e.target.checked)} className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                  3. Add reply buttons
                </label>
                {useButtons && (
                  <div className="grid grid-cols-3 gap-2">
                    <input value={btn1} onChange={(e) => setBtn1(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    <input value={btn2} onChange={(e) => setBtn2(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    <input value={btn3} onChange={(e) => setBtn3(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Preview (first row)</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{bulkPreview}</p>
                {useButtons && (
                  <div className="mt-2 space-y-1">
                    {[btn1, btn2, btn3].filter((b) => b.trim()).map((b, i) => (
                      <div key={i} className="text-center text-sm text-emerald-600 border border-gray-200 rounded-md py-1 bg-white">{b}</div>
                    ))}
                  </div>
                )}
              </div>

              {bulkSending && (
                <div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${validRows.length ? (doneCount / validRows.length) * 100 : 0}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 text-center">{doneCount} / {validRows.length} processed ({sentCount} sent)</p>
                </div>
              )}

              <button onClick={handleBulkSend} disabled={bulkSending || validRows.length === 0} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {bulkSending ? 'Sending...' : `Send to all (${validRows.length})`}
              </button>

              {/* Parsed rows table */}
              {rows.length > 0 && (
                <div className="mt-2 max-h-64 overflow-auto border border-gray-100 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-1.5 font-medium">Name</th>
                        <th className="text-left px-2 py-1.5 font-medium">Card</th>
                        <th className="text-left px-2 py-1.5 font-medium">Tracking</th>
                        <th className="text-left px-2 py-1.5 font-medium">Mobile</th>
                        <th className="text-left px-2 py-1.5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r) => {
                        const valid = r.mobile.replace(/[^0-9]/g, '').length >= 8;
                        const res = results[r.index];
                        return (
                          <tr key={r.index} className={valid ? '' : 'opacity-40'}>
                            <td className="px-2 py-1.5 text-gray-700">{r.firstName || '—'}</td>
                            <td className="px-2 py-1.5 text-gray-600">{r.cardType || '—'}</td>
                            <td className="px-2 py-1.5 text-gray-600">{r.trackingNo || '—'}</td>
                            <td className="px-2 py-1.5 font-mono text-gray-600">{r.mobile || '—'}</td>
                            <td className="px-2 py-1.5">
                              {res ? (
                                <span className={`px-1.5 py-0.5 rounded-full font-medium ${statusBadge(res.status)}`} title={res.error || ''}>{res.status}</span>
                              ) : valid ? (
                                <span className="text-gray-400">ready</span>
                              ) : (
                                <span className="text-red-400">no number</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* Single */
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Send a single message</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer (optional)</label>
                <select value={leadId} onChange={(e) => handleSelectLead(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                  <option value="">— Type a number below —</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>{l.firstName} {l.lastName}{l.company ? ` (${l.company})` : ''} — {l.phone}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone number (country code, no +)</label>
                <input type="text" value={toNumber} onChange={(e) => setToNumber(e.target.value)} placeholder="e.g. 971507024564" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery date (fills {'{{date}}'})</label>
                <input type="text" value={date} onChange={(e) => setDate(e.target.value)} placeholder="e.g. Monday, 21 July" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea value={singleMessage} onChange={(e) => setSingleMessage(e.target.value)} rows={5} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                <p className="mt-1 text-xs text-gray-400">Tags: {'{{firstName}}'}, {'{{lastName}}'}, {'{{date}}'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Preview</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{singlePreview()}</p>
              </div>
              <button onClick={handleSingleSend} disabled={sending} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {sending ? 'Sending...' : 'Send WhatsApp message'}
              </button>
            </div>
          )}
        </div>

        {/* Log */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Messages &amp; replies</h2>
            <button onClick={fetchMessages} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">Refresh</button>
          </div>
          {loadingLog ? (
            <div className="py-12 flex justify-center"><div className="h-6 w-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No messages yet.</div>
          ) : (
            <div className="space-y-3 max-h-[620px] overflow-y-auto">
              {messages.map((m) => (
                <div key={m.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.direction === 'inbound' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{m.direction === 'inbound' ? 'Reply' : 'Sent'}</span>
                      <span className="text-sm font-medium text-gray-800 truncate">{m.lead ? `${m.lead.firstName} ${m.lead.lastName}` : (m.direction === 'inbound' ? m.fromNumber : m.toNumber)}</span>
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
