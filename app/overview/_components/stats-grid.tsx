'use client'

import { useEffect, useState } from 'react'
import { StatCard } from '@/app/_components/stat-card'
import { Users, BookOpen, ClipboardList, CheckCircle2 } from 'lucide-react'
import { analytics } from '@/lib/api'

interface Stats {
  total_students: number
  classes_this_week: number
  pending_assignments: number
  attendance_rate: number
}

export function StatsGrid() {
  const [stats, setStats] = useState<Stats>({
    total_students: 0,
    classes_this_week: 0,
    pending_assignments: 0,
    attendance_rate: 0,
  })

  useEffect(() => {
    analytics.dashboard().then(setStats).catch(() => {})
  }, [])

  const cards = [
    { label: 'Total Students',      value: String(stats.total_students),     icon: Users },
    { label: 'Classes This Week',   value: String(stats.classes_this_week),  icon: BookOpen },
    { label: 'Pending Assignments', value: String(stats.pending_assignments), icon: ClipboardList },
    { label: 'Attendance Rate',     value: `${stats.attendance_rate}%`,      icon: CheckCircle2 },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card) => (
        <StatCard key={card.label} label={card.label} value={card.value} icon={<card.icon />} />
      ))}
    </div>
  )
}
