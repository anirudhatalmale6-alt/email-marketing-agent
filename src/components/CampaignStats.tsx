'use client';

import StatsCard from './StatsCard';

interface CampaignStatsProps {
  stats: {
    total: number;
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    failed?: number;
  };
}

export default function CampaignStats({ stats }: CampaignStatsProps) {
  const openRate = stats.sent > 0 ? ((stats.opened / stats.sent) * 100) : 0;
  const clickRate = stats.sent > 0 ? ((stats.clicked / stats.sent) * 100) : 0;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Campaign Performance</h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatsCard
          title="Total Recipients"
          value={stats.total.toLocaleString()}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatsCard
          title="Sent"
          value={stats.sent.toLocaleString()}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          }
        />
        <StatsCard
          title="Open Rate"
          value={`${openRate.toFixed(1)}%`}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 19V5a2 2 0 012-2h14a2 2 0 012 2v14M3 19l6.75-4.5M21 19l-6.75-4.5M3 5l9 6 9-6" />
            </svg>
          }
        />
        <StatsCard
          title="Click Rate"
          value={`${clickRate.toFixed(1)}%`}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
            </svg>
          }
        />
        <StatsCard
          title="Replies"
          value={stats.replied.toLocaleString()}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          }
        />
      </div>
    </div>
  );
}
