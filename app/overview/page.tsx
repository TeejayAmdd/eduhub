'use client'

import { PageContainer } from '@/_components/page-container'
import { Card } from '@/components/ui/card'

export default function OverviewPage() {
  return (
    <PageContainer
      title="Overview"
      description="Welcome back! Here's your dashboard overview."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: '245' },
          { label: 'Classes This Week', value: '12' },
          { label: 'Pending Assignments', value: '8' },
          { label: 'Attendance Rate', value: '94%' },
        ].map((stat) => (
          <Card
            key={stat.label}
            className="p-6"
          >
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold mt-2">{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <p className="text-muted-foreground">No recent activity to display</p>
        </Card>
      </div>
    </PageContainer>
  )
}
