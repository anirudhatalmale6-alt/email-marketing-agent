'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardStats from '@/components/DashboardStats';

interface DashboardData {
  totalLeads: number;
  totalCampaigns: number;
  totalTemplates: number;
  emailsSent: number;
  openRate: string;
  clickRate: string;
  recentCampaigns: Campaign[];
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  subject: string;
  createdAt: string;
  stats?: {
    total: number;
    sent: number;
    opened: number;
    clicked: number;
    openRate: string;
    clickRate: string;
  };
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  sending: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-orange-100 text-orange-700',
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      // Set fallback data so the page still renders
      setData({
        totalLeads: 0,
        totalCampaigns: 0,
        totalTemplates: 0,
        emailsSent: 0,
        openRate: '0.0',
        clickRate: '0.0',
        recentCampaigns: [],
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm animate-slide-down">
          {error} - Showing default values.
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of your email marketing performance</p>
        </div>
      </div>

      {/* Stats Cards */}
      <DashboardStats />

      {/* Quick Actions + Recent Campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/campaigns?new=true')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors text-left"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">New Campaign</p>
                <p className="text-xs text-gray-500">Create and send a new email campaign</p>
              </div>
            </button>

            <button
              onClick={() => router.push('/leads?import=true')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-emerald-50 hover:border-emerald-200 transition-colors text-left"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Import Leads</p>
                <p className="text-xs text-gray-500">Upload CSV or Excel files</p>
              </div>
            </button>

            <button
              onClick={() => router.push('/templates/editor')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-purple-50 hover:border-purple-200 transition-colors text-left"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Create Template</p>
                <p className="text-xs text-gray-500">Design a new email template</p>
              </div>
            </button>
          </div>
        </div>

        {/* Recent Campaigns */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Campaigns</h2>
            <button
              onClick={() => router.push('/campaigns')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View all
            </button>
          </div>

          {data?.recentCampaigns && data.recentCampaigns.length > 0 ? (
            <div className="space-y-3">
              {data.recentCampaigns.slice(0, 5).map((campaign) => (
                <div
                  key={campaign.id}
                  onClick={() => router.push(`/campaigns/${campaign.id}`)}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{campaign.name}</p>
                    <p className="text-sm text-gray-500 truncate">{campaign.subject}</p>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    {campaign.stats && (
                      <div className="hidden sm:flex items-center gap-3 text-sm text-gray-500">
                        <span>{campaign.stats.sent} sent</span>
                        <span>{campaign.stats.openRate}% opens</span>
                      </div>
                    )}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[campaign.status] || 'bg-gray-100 text-gray-700'}`}>
                      {campaign.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="mt-2 text-sm text-gray-500">No campaigns yet</p>
              <button
                onClick={() => router.push('/campaigns?new=true')}
                className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Create your first campaign
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
