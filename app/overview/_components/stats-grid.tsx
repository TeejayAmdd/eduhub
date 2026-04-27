'use client'

import { StatCard } from '@/app/_components/stat-card'
import { Users, BookOpen, ClipboardList, CheckCircle2 } from 'lucide-react'

export function StatsGrid() {
  const stats = [
    {
      label: 'Total Students',
      value: '245',
      icon: Users,
      trend: { value: 12, direction: 'up' as const },
    },
    {
      label: 'Classes This Week',
      value: '12',
      icon: BookOpen,
      trend: { value: 5, direction: 'up' as const },
    },
    {
      label: 'Pending Assignments',
      value: '8',
      icon: ClipboardList,
      trend: { value: 2, direction: 'down' as const },
    },
    {
      label: 'Attendance Rate',
      value: '94%',
      icon: CheckCircle2,
      trend: { value: 3, direction: 'up' as const },
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <StatCard
          key={stat.label}
          label={stat.label}
          value={stat.value}
          icon={<stat.icon />}
          trend={stat.trend}
        />
      ))}
    </div>
  )
}
