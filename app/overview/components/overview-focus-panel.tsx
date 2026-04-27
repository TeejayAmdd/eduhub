'use client'

import { SectionCard } from '@/app/_components/section-card'

const focusItems = [
  {
    title: 'Attendance follow-up',
    detail: '2 students marked absent this morning',
    accent: 'border-chart-1/20 bg-chart-1/5',
  },
  {
    title: 'Assignment review',
    detail: 'Math homework submissions are ready',
    accent: 'border-chart-2/20 bg-chart-2/5',
  },
  {
    title: 'Schedule update',
    detail: 'Tomorrow’s physics class moved to Lab 2',
    accent: 'border-chart-4/20 bg-chart-4/5',
  },
]

export function OverviewFocusPanel() {
  return (
    <SectionCard
      title="Focus"
      subtitle="A compact summary of what needs attention next."
      contentClassName="pt-0"
    >
      <div className="space-y-3">
        {focusItems.map((item) => (
          <div
            key={item.title}
            className={`rounded-2xl border p-4 ${item.accent}`}
          >
            <p className="text-sm font-medium">{item.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}