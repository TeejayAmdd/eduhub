'use client'

import { Button } from '@/components/ui/button'
import { StatsGrid } from './_components/stats-grid'
import { RecentActivity } from './_components/recent-activity'
import { Plus, UserPlus, FileText, Bell } from 'lucide-react'
import { PageContainer } from '../_components/page-container'
import { SectionCard } from '../_components/section-card'

export default function OverviewPage() {
  const quickActions = [
    { label: 'New Class', icon: Plus, href: '#' },
    { label: 'Add Student', icon: UserPlus, href: '#' },
    { label: 'Create Assignment', icon: FileText, href: '#' },
    { label: 'Send Announcement', icon: Bell, href: '#' },
  ]

  return (
    <PageContainer
      title="Overview"
      description="Welcome back! Here's your dashboard overview."
    >
      <div className="space-y-8">
        {/* Stats Grid */}
        <StatsGrid />

        {/* Quick Actions */}
        <SectionCard title="Quick Actions">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Button
                  key={action.label}
                  variant="outline"
                  className="h-auto flex-col py-4 px-3"
                  onClick={() => console.log(`Navigate to ${action.label}`)}
                >
                  <Icon className="w-5 h-5 mb-2" />
                  <span className="text-xs">{action.label}</span>
                </Button>
              )
            })}
          </div>
        </SectionCard>

        {/* Recent Activity */}
        <RecentActivity />
      </div>
    </PageContainer>
  )
}
