'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import CampaignForm from '@/components/CampaignForm';
import Modal from '@/components/Modal';

interface CampaignStats {
  total: number;
  sent: number;
  opened: number;
  clicked: number;
  openRate: string;
  clickRate: string;
}

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  templateId: string | null;
  template: { id: string; name: string } | null;
  segmentTags: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  dailyLimit: number;
  aiPersonalize: boolean;
  fromName: string | null;
  fromEmail: string | null;
  createdAt: string;
  stats: CampaignStats;
}

const STATUS_OPTIONS = ['all', 'draft', 'scheduled', 'sending', 'completed', 'paused'];

const statusStyles: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  sending: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-orange-100 text-orange-700',
};

const statusIcons: Record<string, string> = {
  draft: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  scheduled: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  sending: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8',
  completed: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  paused: 'M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z',
};

export default function CampaignsPage() {
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Campaign | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch('/api/campaigns');
      if (!res.ok) throw new Error('Failed to fetch campaigns');
      const json = await res.json();
      setCampaigns(json);
    } catch {
      showNotification('error', 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Check URL params for auto-open
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === 'true') {
      setShowCreateForm(true);
    }
  }, []);

  async function handleCreateCampaign(data: Record<string, unknown>) {
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create campaign');
      }
      showNotification('success', 'Campaign created');
      setShowCreateForm(false);
      fetchCampaigns();
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Failed to create campaign');
    }
  }

  async function handleDelete(campaign: Campaign) {
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete campaign');
      showNotification('success', 'Campaign deleted');
      setDeleteConfirm(null);
      fetchCampaigns();
    } catch {
      showNotification('error', 'Failed to delete campaign');
    }
  }

  async function handleSendNow(campaign: Campaign) {
    try {
      setSendingId(campaign.id);
      showNotification('success', 'Sending started - keep this tab open until it finishes');

      // Send in small batches until the whole list is done. Each request stays
      // under the server time limit so large lists send reliably.
      let done = false;
      let guard = 0;
      let lastSent = 0;
      let total = 0;
      while (!done && guard < 5000) {
        guard++;
        const res = await fetch(`/api/campaigns/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId: campaign.id }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to send campaign');
        }
        const data = await res.json();
        if (typeof data.totalSent === 'number') lastSent = data.totalSent;
        if (typeof data.total === 'number') total = data.total;
        if (data.paused) break;
        done = data.done;
      }
      showNotification('success', done ? `Done - ${lastSent}${total ? ` of ${total}` : ''} emails sent` : 'Sending paused');
      fetchCampaigns();
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Failed to send campaign');
      fetchCampaigns();
    } finally {
      setSendingId(null);
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

  function parseSegmentTags(tags: string | null): string[] {
    if (!tags) return [];
    try {
      const parsed = JSON.parse(tags);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  const filteredCampaigns = statusFilter === 'all'
    ? campaigns
    : campaigns.filter((c) => c.status === statusFilter);

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Campaign
          </span>
        </button>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              statusFilter === status
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Campaign Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredCampaigns.length > 0 ? (
        <div className="space-y-4">
          {filteredCampaigns.map((campaign) => {
            const segTags = parseSegmentTags(campaign.segmentTags);
            return (
              <div
                key={campaign.id}
                className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  {/* Campaign Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">{campaign.name}</h3>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[campaign.status] || 'bg-gray-100 text-gray-700'}`}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={statusIcons[campaign.status] || statusIcons.draft} />
                        </svg>
                        {campaign.status}
                      </span>
                    </div>

                    <p className="text-sm text-gray-500 mb-3 truncate">Subject: {campaign.subject}</p>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
                      {campaign.template && (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
                          </svg>
                          {campaign.template.name}
                        </span>
                      )}
                      {segTags.length > 0 && (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          {segTags.length} tag{segTags.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {campaign.scheduledAt && (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formatDate(campaign.scheduledAt)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {campaign.stats.total} leads
                      </span>
                    </div>

                    {/* Stats Bar */}
                    {campaign.stats.sent > 0 && (
                      <div className="mt-4 flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-gray-400">Sent</span>
                          <span className="ml-1 font-semibold text-gray-900">{campaign.stats.sent}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Opens</span>
                          <span className="ml-1 font-semibold text-blue-600">{campaign.stats.openRate}%</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Clicks</span>
                          <span className="ml-1 font-semibold text-emerald-600">{campaign.stats.clickRate}%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => router.push(`/campaigns/${campaign.id}`)}
                      className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      View Details
                    </button>
                    {campaign.status === 'draft' && (
                      <>
                        <button
                          onClick={() => router.push(`/campaigns/${campaign.id}?edit=true`)}
                          className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleSendNow(campaign)}
                          disabled={sendingId === campaign.id}
                          className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          {sendingId === campaign.id ? 'Starting...' : 'Send Now'}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setDeleteConfirm(campaign)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="mt-2 text-sm font-medium text-gray-900">No campaigns found</p>
          <p className="mt-1 text-sm text-gray-500">
            {statusFilter !== 'all' ? 'No campaigns with this status.' : 'Create your first email campaign.'}
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            New Campaign
          </button>
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCreateForm && (
        <Modal isOpen={true} title="New Campaign" onClose={() => setShowCreateForm(false)} maxWidth="max-w-3xl">
          <CampaignForm
            onSaved={() => { showNotification('success', 'Campaign created'); setShowCreateForm(false); fetchCampaigns(); }}
            onCancel={() => setShowCreateForm(false)}
          />
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <Modal isOpen={true} title="Delete Campaign" onClose={() => setDeleteConfirm(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
              This will also remove all associated lead records and email events.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
