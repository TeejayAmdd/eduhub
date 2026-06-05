'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Users, BookOpen, ClipboardList, TrendingUp, Radio, Loader2, Award, Brain } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageContainer } from '../_components/page-container'
import { PageHeader } from '../_components/page-header'
import { analytics, type LecturerAnalytics, type LecturerClassStat } from '@/lib/api'
import { cn } from '@/lib/utils'

// Deterministic colour per class index so charts stay consistent
const CLASS_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']
const color = (i: number) => CLASS_COLORS[i % CLASS_COLORS.length]

function StatCard({
  icon: Icon, label, value, sub, iconClass,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  iconClass?: string
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', iconClass ?? 'bg-primary/10')}>
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function ClassTable({ classes }: { classes: LecturerClassStat[] }) {
  return (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40 text-xs text-muted-foreground">
            <th className="text-left px-4 py-3 font-medium">Class</th>
            <th className="text-center px-4 py-3 font-medium">Students</th>
            <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">Attendance</th>
            <th className="text-center px-4 py-3 font-medium hidden md:table-cell">Live Sessions</th>
            <th className="text-center px-4 py-3 font-medium hidden lg:table-cell">Submissions</th>
            <th className="text-center px-4 py-3 font-medium hidden lg:table-cell">Quiz Avg</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((c, i) => (
            <tr key={c.class_id} className={cn('border-t border-border/60', i % 2 !== 0 && 'bg-muted/20')}>
              <td className="px-4 py-3">
                <p className="font-medium leading-tight">{c.class_name}</p>
                {c.course_code && (
                  <p className="text-xs text-muted-foreground">{c.course_code}</p>
                )}
              </td>
              <td className="px-4 py-3 text-center font-semibold">{c.enrollment_count}</td>
              <td className="px-4 py-3 text-center hidden sm:table-cell">
                <span className={cn(
                  'font-semibold',
                  c.attendance_rate >= 75 ? 'text-green-600 dark:text-green-400'
                  : c.attendance_rate >= 50 ? 'text-amber-600 dark:text-amber-400'
                  : 'text-red-500 dark:text-red-400'
                )}>
                  {c.attendance_rate}%
                </span>
              </td>
              <td className="px-4 py-3 text-center text-muted-foreground hidden md:table-cell">
                {c.live_session_count}
              </td>
              <td className="px-4 py-3 text-center hidden lg:table-cell">
                {c.assignments_total > 0
                  ? <span className="font-medium">{c.submission_rate}%</span>
                  : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-4 py-3 text-center hidden lg:table-cell">
                {c.quiz_avg_score !== null
                  ? <span className="font-medium">{c.quiz_avg_score}%</span>
                  : <span className="text-muted-foreground">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<LecturerAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    analytics.lecturer()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="Analytics" description="Performance overview for your classes" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    )
  }

  if (error || !data) {
    return (
      <PageContainer>
        <PageHeader title="Analytics" description="Performance overview for your classes" />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Failed to load analytics. Please refresh the page.
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  const hasClasses = data.classes.length > 0
  const hasAssignments = data.classes.some(c => c.assignments_total > 0)
  const hasQuizzes = data.classes.some(c => c.quiz_count > 0)
  const hasLiveSessions = data.total_live_sessions > 0

  // Chart datasets — short name for x-axis labels
  const shortName = (c: LecturerClassStat) =>
    c.course_code ?? c.class_name.split(' ').slice(0, 2).join(' ')

  const enrollmentData = data.classes.map((c, i) => ({
    name: shortName(c),
    students: c.enrollment_count,
    fill: color(i),
  }))

  const attendanceData = data.classes.map((c, i) => ({
    name: shortName(c),
    rate: c.live_session_count > 0 ? c.live_attendance_rate : c.attendance_rate,
    fill: color(i),
  }))

  const submissionData = data.classes
    .filter(c => c.assignments_total > 0)
    .map((c, i) => ({
      name: shortName(c),
      rate: c.submission_rate,
      fill: color(i),
    }))

  const quizData = data.classes
    .filter(c => c.quiz_count > 0 && c.quiz_avg_score !== null)
    .map((c, i) => ({
      name: shortName(c),
      avg: c.quiz_avg_score!,
      fill: color(i),
    }))

  return (
    <PageContainer>
      <PageHeader title="Analytics" description="Performance overview for your classes" />

      <div className="space-y-8">

        {/* ── Stat cards ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Total Students"
            value={data.total_students}
            sub="across all your classes"
            iconClass="bg-blue-100 dark:bg-blue-950/40"
          />
          <StatCard
            icon={BookOpen}
            label="Classes"
            value={data.total_classes}
            iconClass="bg-purple-100 dark:bg-purple-950/40"
          />
          <StatCard
            icon={TrendingUp}
            label="Overall Attendance"
            value={`${data.overall_attendance_rate}%`}
            sub="across all records"
            iconClass="bg-green-100 dark:bg-green-950/40"
          />
          <StatCard
            icon={ClipboardList}
            label="Pending Grading"
            value={data.pending_grading}
            sub="submissions awaiting review"
            iconClass="bg-amber-100 dark:bg-amber-950/40"
          />
        </div>

        {!hasClasses ? (
          <Card>
            <CardContent className="py-16 text-center">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium text-sm">No class data yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create classes and enroll students to start seeing analytics.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ── Charts row 1 ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Enrollment per class */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    Students Enrolled per Class
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={enrollmentData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                          formatter={(v) => [`${v} students`, 'Enrolled']}
                        />
                        <Bar dataKey="students" radius={[4, 4, 0, 0]}>
                          {enrollmentData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Attendance rate per class */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    Attendance Rate per Class
                    {hasLiveSessions && (
                      <Badge variant="secondary" className="text-xs font-normal ml-auto">
                        <Radio className="w-3 h-3 mr-1" />cookie-based
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    {attendanceData.every(d => d.rate === 0) ? (
                      <EmptyChart message="No attendance records yet" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={attendanceData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                            formatter={(v) => [`${v}%`, 'Attendance']}
                          />
                          <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                            {attendanceData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Charts row 2 ─────────────────────────────────────────────── */}
            {(hasAssignments || hasQuizzes) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Assignment submission rate */}
                {hasAssignments && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-purple-500" />
                        Assignment Submission Rate
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-56">
                        {submissionData.length === 0 ? (
                          <EmptyChart message="No submissions yet" />
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={submissionData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                              <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                                formatter={(v) => [`${v}%`, 'Submitted']}
                              />
                              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                                {submissionData.map((entry, i) => (
                                  <Cell key={i} fill={entry.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Quiz average score */}
                {hasQuizzes && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Brain className="w-4 h-4 text-amber-500" />
                        Quiz Average Score per Class
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-56">
                        {quizData.length === 0 ? (
                          <EmptyChart message="No quiz attempts yet" />
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={quizData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                              <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                                formatter={(v) => [`${v}%`, 'Avg Score']}
                              />
                              <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                                {quizData.map((entry, i) => (
                                  <Cell key={i} fill={entry.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ── Live sessions summary ─────────────────────────────────────── */}
            {hasLiveSessions && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Radio className="w-4 h-4 text-primary" />
                    Live Session Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {data.classes.filter(c => c.live_session_count > 0).map((c, i) => (
                      <div key={c.class_id} className="rounded-xl border p-3 space-y-1">
                        <p className="text-xs font-medium truncate">{c.class_name}</p>
                        <p className="text-xl font-bold" style={{ color: color(data.classes.indexOf(c)) }}>
                          {c.live_session_count}
                        </p>
                        <p className="text-[10px] text-muted-foreground">sessions held</p>
                        {c.live_session_count > 0 && (
                          <p className="text-xs text-muted-foreground">
                            avg <span className="font-semibold text-foreground">{c.live_attendance_rate}%</span> attendance
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Per-class detail table ────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Award className="w-4 h-4 text-muted-foreground" />
                  Class Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-1">
                <ClassTable classes={data.classes} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PageContainer>
  )
}
