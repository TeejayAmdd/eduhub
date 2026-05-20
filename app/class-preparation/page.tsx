'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, Users, Loader2, GraduationCap, Hash, Layers, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PageContainer } from '@/app/_components/page-container'
import { PageHeader } from '@/app/_components/page-header'
import { CreateClassDialog } from './_components/lecture-form'
import { classes, type Class } from '@/lib/api'

const levelColor: Record<string, string> = {
  '100L': 'bg-blue-50 text-blue-700 border-blue-100',
  '200L': 'bg-violet-50 text-violet-700 border-violet-100',
  '300L': 'bg-amber-50 text-amber-700 border-amber-100',
  '400L': 'bg-green-50 text-green-700 border-green-100',
  '500L': 'bg-rose-50 text-rose-700 border-rose-100',
  '600L': 'bg-orange-50 text-orange-700 border-orange-100',
}

export default function ClassPreparationPage() {
  const [data, setData] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    classes.list().then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  const handleCreated = (c: Class) => setData((prev) => [c, ...prev])

  return (
    <PageContainer>
      <PageHeader
        title="Course Preparation"
        description="Create and manage your courses. Students in your department and level will see and enroll."
        action={<CreateClassDialog onCreated={handleCreated} />}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
            <BookOpen className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-base font-medium">No courses yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Create your first course. Students in your department and level will be able to find and enroll.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((cls) => (
            <Link key={cls.id} href={`/class-preparation/${cls.id}`}>
              <CourseCard cls={cls} />
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  )
}

function CourseCard({ cls }: { cls: Class }) {
  const unitLabel = cls.subject
    ? `${cls.subject} Unit${cls.subject !== '1' ? 's' : ''}`
    : null

  return (
    <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
      <CardContent className="p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div className="flex gap-1.5 flex-wrap justify-end">
            {cls.level && (
              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${levelColor[cls.level] ?? 'bg-muted text-foreground border-border'}`}>
                {cls.level}
              </span>
            )}
            {cls.course_code && (
              <Badge variant="outline" className="text-xs">{cls.course_code}</Badge>
            )}
          </div>
        </div>

        {/* Course Title + unit */}
        <div>
          <h3 className="font-semibold text-sm leading-snug">{cls.name}</h3>
          {unitLabel && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Layers className="w-3 h-3" /> {unitLabel}
            </p>
          )}
        </div>

        {/* Meta */}
        <div className="space-y-1.5 text-xs text-muted-foreground">
          {cls.department && (
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>{cls.department}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 shrink-0" />
            <span>{cls.academic_year}</span>
          </div>
          {cls.level && (
            <div className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 shrink-0" />
              <span>Visible to {cls.level} · {cls.department ?? 'your department'}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end pt-1">
          <span className="text-xs text-primary font-medium flex items-center gap-0.5">
            Open dashboard <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
