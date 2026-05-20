'use client'

import { StatsGrid } from './_components/stats-grid'
import { RecentActivity } from './_components/recent-activity'
import { PageContainer } from '../_components/page-container'
import { OverviewHero } from './components/overview-hero'
import { OverviewQuickActions } from './components/overview-quick-actions'
import { OverviewFocusPanel } from './components/overview-focus-panel'

export default function OverviewPage() {
  return (
    <PageContainer>
      <div className="space-y-4 sm:space-y-8">
        <OverviewHero />

        <StatsGrid />

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <OverviewQuickActions />

          <OverviewFocusPanel />
        </div>

        <RecentActivity />
      </div>
    </PageContainer>
  )
}
