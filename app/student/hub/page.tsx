'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Users, ChevronRight, GraduationCap } from 'lucide-react'
import { PageContainer } from '@/app/_components/page-container'
import { PageHeader } from '@/app/_components/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { classes, type ClassAvailable } from '@/lib/api'

export default function StudyHubPage() {
  const [enrolled, setEnrolled] = useState<ClassAvailable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    classes.available()
      .then((all) => setEnrolled(all.filter((c) => c.is_enrolled)))
      .catch(() => setError('Failed to load courses'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <PageContainer>
      <PageHeader
        title="Study Hub"
        description="Connect with classmates, apply to be a peer tutor, and join live tutorial sessions"
      />

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <p className="text-center text-destructive py-10">{error}</p>
      )}

      {!loading && !error && enrolled.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No enrolled courses</p>
          <p className="text-sm text-muted-foreground mt-1">
            Enrol in courses first to access their Study Hubs
          </p>
        </div>
      )}

      {!loading && !error && enrolled.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {enrolled.map((cls) => (
            <Link key={cls.id} href={`/student/hub/${cls.id}`} className="group">
              <Card className="h-full transition-shadow hover:shadow-md border-border group-hover:border-primary/40">
                <CardContent className="p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{cls.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{cls.subject}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {cls.course_code && (
                      <Badge variant="secondary" className="text-xs">{cls.course_code}</Badge>
                    )}
                    {cls.level && (
                      <Badge variant="outline" className="text-xs">{cls.level}</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-auto">
                    <Users className="h-3.5 w-3.5" />
                    <span>View hub</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  )
}
