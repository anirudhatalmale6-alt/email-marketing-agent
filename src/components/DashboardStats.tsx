'use client';

import { useEffect, useState } from 'react';
import StatsCard from './StatsCard';

interface RecentCampaign {
  id: string;
  name: string;
  status: string;
  sentCount: number;
  openCount: number;
  clickCount: number;
  createdAt: string;
}

interface DashboardData {
  totalLeads: number;
  totalCampaigns: number;
  emailsSent: number;
  openRate: number;
  clickRate: number;
  recentCampaigns: RecentCampaign[];
}

export default function DashboardStats() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[120px] animate-pulse rounded-xl border border-gray-200 bg-gray-100" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl border border-gray-200 bg-gray-100" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
        <p className="text-gray-500">Failed to load dashboard data. Please try again.</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    scheduled: 'bg-blue-100 text-blue-700',
    sending: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-emerald-100 text-emerald-700',
    paused: 'bg-orange-100 text-orange-700',
  };

  // Generate visual bar data from recent campaigns for the mini chart
  const maxSent = Math.max(...data.recentCampaigns.map((c) => c.sentCount), 1);

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatsCard
          title="Total Leads"
          value={data.totalLeads.toLocaleString()}
          change={12}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatsCard
          title="Active Campaigns"
          value={data.totalCampaigns.toLocaleString()}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatsCard
          title="Emails Sent Today"
          value={data.emailsSent.toLocaleString()}
          change={8}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          }
        />
        <StatsCard
          title="Open Rate"
          value={`${data.openRate.toFixed(1)}%`}
          change={3.2}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        />
        <StatsCard
          title="Click Rate"
          value={`${data.clickRate.toFixed(1)}%`}
          change={-1.5}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent campaigns table */}
        <div className="lg:col-span-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h3 className="text-base font-semibold text-gray-900">Recent Campaigns</h3>
            <a href="/campaigns" className="text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors">
              View all
            </a>
          </div>

          {data.recentCampaigns.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              <svg className="mx-auto mb-3 h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">No campaigns yet. Create your first campaign to get started.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:table-cell">Sent</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 md:table-cell">Opens</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 md:table-cell">Clicks</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.recentCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5">
                      <a href={`/campaigns/${campaign.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors">
                        {campaign.name}
                      </a>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[campaign.status] || 'bg-gray-100 text-gray-600'}`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="hidden px-6 py-3.5 text-sm text-gray-600 sm:table-cell">{campaign.sentCount.toLocaleString()}</td>
                    <td className="hidden px-6 py-3.5 text-sm text-gray-600 md:table-cell">{campaign.openCount.toLocaleString()}</td>
                    <td className="hidden px-6 py-3.5 text-sm text-gray-600 md:table-cell">{campaign.clickCount.toLocaleString()}</td>
                    <td className="px-6 py-3.5 text-sm text-gray-500">
                      {new Date(campaign.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Activity chart (visual bars) */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-base font-semibold text-gray-900">Send Activity</h3>
            <p className="text-xs text-gray-400 mt-0.5">Emails sent per campaign</p>
          </div>

          <div className="p-6">
            {data.recentCampaigns.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No data to display</p>
            ) : (
              <div className="space-y-3">
                {data.recentCampaigns.slice(0, 6).map((campaign) => {
                  const sentPercent = (campaign.sentCount / maxSent) * 100;
                  const openPercent = campaign.sentCount > 0
                    ? (campaign.openCount / campaign.sentCount) * 100
                    : 0;

                  return (
                    <div key={campaign.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-700 truncate max-w-[140px]">{campaign.name}</span>
                        <span className="text-gray-400">{campaign.sentCount} sent</span>
                      </div>
                      <div className="relative h-6 w-full overflow-hidden rounded-md bg-gray-100">
                        <div
                          className="absolute inset-y-0 left-0 rounded-md bg-blue-200 transition-all duration-500"
                          style={{ width: `${sentPercent}%` }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 rounded-md bg-blue-500 transition-all duration-500"
                          style={{ width: `${(sentPercent * openPercent) / 100}%` }}
                        />
                        <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-medium text-gray-500">
                          {openPercent.toFixed(0)}% opened
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
                <span className="text-[11px] text-gray-500">Opened</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-blue-200" />
                <span className="text-[11px] text-gray-500">Sent</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
