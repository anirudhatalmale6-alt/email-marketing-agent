'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import CampaignStats from '@/components/CampaignStats';

interface CampaignLead {
  id: string;
  campaignId: string;
  leadId: string;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  repliedAt: string | null;
  followUpCount: number;
  lead: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    company: string | null;
  };
}

interface EmailEvent {
  id: string;
  campaignLeadId: string;
  leadId: string;
  type: string;
  metadata: string | null;
  createdAt: string;
}

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  templateId: string | null;
  template: { id: string; name: string; subject: string } | null;
  segmentTags: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  dailyLimit: number;
  delaySeconds: number;
  aiPersonalize: boolean;
  followUpEnabled: boolean;
  followUpDays: number;
  followUpMaxCount: number;
  fromName: string | null;
  fromEmail: string | null;
  smtpConfigId: string | null;
  createdAt: string;
  campaignLeads: CampaignLead[];
  stats: {
    total: number;
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    failed?: number;
    openRate: string;
    clickRate: string;
  };
}

const leadStatusStyles: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  opened: 'bg-emerald-100 text-emerald-700',
  clicked: 'bg-purple-100 text-purple-700',
  replied: 'bg-amber-100 text-amber-700',
  bounced: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
};

const eventTypeIcons: Record<string, { color: string; label: string }> = {
  sent: { color: 'text-blue-500', label: 'Email Sent' },
  opened: { color: 'text-emerald-500', label: 'Email Opened' },
  clicked: { color: 'text-purple-500', label: 'Link Clicked' },
  replied: { color: 'text-amber-500', label: 'Reply Received' },
  bounced: { color: 'text-red-500', label: 'Email Bounced' },
  failed: { color: 'text-red-500', label: 'Send Failed' },
  follow_up: { color: 'text-indigo-500', label: 'Follow-up Sent' },
};

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ sent: number; total: number } | null>(null);
  const cancelSendRef = useRef(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const fetchCampaign = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/campaigns/${id}`);
      if (!res.ok) throw new Error('Campaign not found');
      const json = await res.json();
      setCampaign(json);

      // Collect events from campaign leads
      const allEvents: EmailEvent[] = [];
      if (json.campaignLeads) {
        for (const cl of json.campaignLeads) {
          if (cl.events) {
            allEvents.push(...cl.events);
          }
        }
      }
      allEvents.sort((a: EmailEvent, b: EmailEvent) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setEvents(allEvents);
    } catch {
      showNotification('error', 'Failed to load campaign');
    } finally {
      setLoading(false);
    }
  }, [id, showNotification]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  // Drives the campaign by repeatedly asking the server to send one small
  // batch until everything is done. Each request stays well under the server
  // time limit, so large lists (100s of emails) send reliably instead of
  // freezing after the first few.
  async function runBatches() {
    let done = false;
    let guard = 0;
    while (!done && !cancelSendRef.current && guard < 5000) {
      guard++;
      const res = await fetch('/api/campaigns/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to send campaign');
      }
      const data = await res.json();
      if (typeof data.totalSent === 'number' && typeof data.total === 'number') {
        setSendProgress({ sent: data.totalSent, total: data.total });
      }
      if (data.paused) break;
      done = data.done;
    }
    return done;
  }

  async function handleAction(action: 'send' | 'pause' | 'resume') {
    try {
      if (action === 'pause') {
        cancelSendRef.current = true;
        const res = await fetch(`/api/campaigns/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'paused' }),
        });
        if (!res.ok) throw new Error('Failed to pause campaign');
        showNotification('success', 'Campaign paused');
        fetchCampaign();
        return;
      }

      // send or resume
      setActionLoading(true);
      cancelSendRef.current = false;
      setSendProgress({ sent: campaign?.stats.sent || 0, total: campaign?.stats.total || 0 });
      showNotification('success', action === 'resume' ? 'Resuming campaign...' : 'Campaign sending started - keep this tab open');

      const done = await runBatches();
      await fetchCampaign();
      if (done) {
        showNotification('success', 'Campaign finished - all emails sent');
      } else if (cancelSendRef.current) {
        showNotification('success', 'Campaign paused');
      }
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : `Failed to ${action} campaign`);
      fetchCampaign();
    } finally {
      setActionLoading(false);
      setSendProgress(null);
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatTimeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-sm font-medium text-gray-900">Campaign not found</p>
          <button
            onClick={() => router.push('/campaigns')}
            className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Back to campaigns
          </button>
        </div>
      </div>
    );
  }

  const statusStyle: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    scheduled: 'bg-blue-100 text-blue-700',
    sending: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-emerald-100 text-emerald-700',
    paused: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-slide-down ${
            notification.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/campaigns')}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle[campaign.status] || 'bg-gray-100 text-gray-700'}`}>
                {campaign.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">{campaign.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === 'draft' && (
            <button
              onClick={() => handleAction('send')}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? 'Sending...' : 'Send Campaign'}
            </button>
          )}
          {campaign.status === 'sending' && actionLoading && (
            <button
              onClick={() => handleAction('pause')}
              className="px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
            >
              Pause
            </button>
          )}
          {campaign.status === 'sending' && !actionLoading && (
            <button
              onClick={() => handleAction('resume')}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Continue Sending
            </button>
          )}
          {campaign.status === 'paused' && (
            <button
              onClick={() => handleAction('resume')}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? 'Sending...' : 'Resume'}
            </button>
          )}
          {(campaign.status === 'completed' || campaign.status === 'failed') && (
            <button
              onClick={() => handleAction('resume')}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? 'Sending...' : 'Send to Remaining'}
            </button>
          )}
        </div>
      </div>

      {/* Live send progress */}
      {actionLoading && sendProgress && sendProgress.total > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-emerald-800">
              Sending emails... {sendProgress.sent} of {sendProgress.total}
            </span>
            <span className="text-xs text-emerald-600">Keep this tab open until it finishes</span>
          </div>
          <div className="w-full bg-emerald-100 rounded-full h-2">
            <div
              className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.round((sendProgress.sent / sendProgress.total) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {/* Campaign Stats */}
      <CampaignStats stats={campaign.stats} />

      {/* Campaign Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaign Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Campaign Details</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">Template</dt>
              <dd className="text-sm text-gray-900 mt-0.5">{campaign.template?.name || 'None'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">From</dt>
              <dd className="text-sm text-gray-900 mt-0.5">
                {campaign.fromName || 'Default'} {campaign.fromEmail ? `<${campaign.fromEmail}>` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">Scheduled</dt>
              <dd className="text-sm text-gray-900 mt-0.5">{formatDate(campaign.scheduledAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">Started</dt>
              <dd className="text-sm text-gray-900 mt-0.5">{formatDate(campaign.startedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">Completed</dt>
              <dd className="text-sm text-gray-900 mt-0.5">{formatDate(campaign.completedAt)}</dd>
            </div>
          </dl>
        </div>

        {/* Settings */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Settings</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">Daily Limit</dt>
              <dd className="text-sm text-gray-900 mt-0.5">{campaign.dailyLimit} emails/day</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">Delay Between Sends</dt>
              <dd className="text-sm text-gray-900 mt-0.5">{campaign.delaySeconds}s</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">AI Personalization</dt>
              <dd className="text-sm text-gray-900 mt-0.5">{campaign.aiPersonalize ? 'Enabled' : 'Disabled'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">Follow-ups</dt>
              <dd className="text-sm text-gray-900 mt-0.5">
                {campaign.followUpEnabled
                  ? `Enabled (${campaign.followUpMaxCount}x, every ${campaign.followUpDays} days)`
                  : 'Disabled'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Event Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          {events.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {events.slice(0, 20).map((event) => {
                const info = eventTypeIcons[event.type] || { color: 'text-gray-500', label: event.type };
                return (
                  <div key={event.id} className="flex items-start gap-3">
                    <div className={`mt-0.5 ${info.color}`}>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 8 8">
                        <circle cx="4" cy="4" r="4" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{info.label}</p>
                      <p className="text-xs text-gray-400">{formatTimeAgo(event.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No activity yet</p>
          )}
        </div>
      </div>

      {/* Campaign Leads Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Campaign Leads ({campaign.campaignLeads?.length || 0})
          </h2>
        </div>
        {campaign.campaignLeads && campaign.campaignLeads.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Lead</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Email</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Company</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Sent</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Opened</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Clicked</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Follow-ups</th>
                </tr>
              </thead>
              <tbody>
                {campaign.campaignLeads.map((cl) => (
                  <tr key={cl.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {cl.lead.firstName} {cl.lead.lastName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{cl.lead.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{cl.lead.company || '--'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${leadStatusStyles[cl.status] || 'bg-gray-100 text-gray-700'}`}>
                        {cl.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{formatDate(cl.sentAt)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{formatDate(cl.openedAt)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{formatDate(cl.clickedAt)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{cl.followUpCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-400">No leads assigned to this campaign</p>
          </div>
        )}
      </div>
    </div>
  );
}
