'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen, Video, ClipboardList, BarChart2, Users,
  CheckCircle2, ChevronRight, ChevronLeft, LayoutDashboard,
  GraduationCap, FileText, FlaskConical, MessageSquare,
  CalendarDays, ClipboardCheck, TrendingUp, ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { users } from '@/lib/api'

interface Slide {
  icon: React.ElementType
  label: string
  title: string
  description: string
  features: string[]
}

const STUDENT_SLIDES: Slide[] = [
  {
    icon: LayoutDashboard,
    label: 'Overview',
    title: 'Your learning hub, all in one place',
    description:
      'Cortex brings together everything you need as a student — courses, lectures, assignments, and progress tracking — in a single, unified platform.',
    features: [
      'Access all your enrolled courses from one dashboard',
      'Receive real-time notifications for deadlines and announcements',
      'Track your academic progress with detailed analytics',
    ],
  },
  {
    icon: BookOpen,
    label: 'Courses',
    title: 'Enroll and manage your courses',
    description:
      'Browse available courses, enroll using your matric number, and access all your learning materials instantly.',
    features: [
      'Enroll in courses with your matric number',
      'Download lecture notes, slides, and resources',
      'View your full course schedule and timetable',
    ],
  },
  {
    icon: Video,
    label: 'Live Lectures',
    title: 'Attend live lecture sessions',
    description:
      'Join real-time video lectures hosted by your lecturers. Attendance is tracked automatically — just click the attendance prompt when your lecturer activates it.',
    features: [
      'Join live sessions directly from your dashboard',
      'Attendance is recorded the moment you confirm presence',
      'Receive an email notification when a session goes live',
    ],
  },
  {
    icon: ClipboardList,
    label: 'Assignments',
    title: 'Submit assignments before the deadline',
    description:
      'View all your active assignments, upload your work, and receive grades and feedback directly on the platform.',
    features: [
      'See deadlines clearly highlighted in your dashboard',
      'Upload submissions in any supported file format',
      'Get notified the moment your work is graded',
    ],
  },
  {
    icon: FlaskConical,
    label: 'Quizzes',
    title: 'Take timed quizzes and see results instantly',
    description:
      'Lecturers publish timed quizzes directly to your portal. Once you begin, the timer starts — your score is displayed immediately after submission.',
    features: [
      'Timer starts when you open the quiz — no pausing',
      'Multiple choice and short-answer formats supported',
      'Results and correct answers shown right after submission',
    ],
  },
  {
    icon: TrendingUp,
    label: 'Analytics',
    title: 'Monitor your academic performance',
    description:
      'Your personal analytics dashboard shows attendance rates, assignment scores, quiz results, and overall standing — so you always know where you stand.',
    features: [
      'View attendance percentage per course',
      'Track assignment and exam scores over time',
      'Identify areas that need improvement early',
    ],
  },
]

const LECTURER_SLIDES: Slide[] = [
  {
    icon: LayoutDashboard,
    label: 'Overview',
    title: 'Everything you need to teach, in one place',
    description:
      'Cortex gives you a full suite of teaching tools from course creation and live lectures to assignments, grading, and performance analytics.',
    features: [
      'Manage all your courses from a single dashboard',
      'Monitor student activity and engagement in real time',
      'Receive notifications when students submit work',
    ],
  },
  {
    icon: Users,
    label: 'Class Setup',
    title: 'Create and manage your courses',
    description:
      'Set up courses, enroll students, upload lecture materials, and organise your teaching schedule — all from the Class Preparation section.',
    features: [
      'Create courses and assign course codes',
      'Upload slides, PDFs, and reference materials',
      'Set your weekly class schedule for students to see',
    ],
  },
  {
    icon: Video,
    label: 'Live Lectures',
    title: 'Host live lecture sessions',
    description:
      'Schedule upcoming sessions or start one instantly. When you go live, enrolled students are notified by email and can join directly from their portal.',
    features: [
      'Start an instant session or schedule one in advance',
      'Students are automatically notified when you go live',
      'Activate the attendance prompt at any point during the session',
    ],
  },
  {
    icon: ClipboardCheck,
    label: 'Assignments',
    title: 'Set assignments and grade submissions',
    description:
      'Create assignments with deadlines, review student submissions, and provide grades and written feedback — all in one place.',
    features: [
      'Set deadlines and attach assignment briefs or files',
      'Review, download, and grade each submission',
      'Students receive their grade and feedback instantly',
    ],
  },
  {
    icon: FileText,
    label: 'Quizzes',
    title: 'Build and publish quizzes',
    description:
      'Create timed quizzes with multiple choice and short-answer questions. Publish to your class with a single click — results are auto-graded and instantly visible.',
    features: [
      'Set a time limit per quiz attempt',
      'Students get only one attempt — results are immediate',
      'View per-student and class-wide score breakdowns',
    ],
  },
  {
    icon: BarChart2,
    label: 'Analytics',
    title: 'Track student performance and attendance',
    description:
      'Your analytics dashboard gives you a clear view of class-wide attendance, assignment completion rates, and individual student performance.',
    features: [
      'See attendance rates per course and per student',
      'Identify students who are falling behind early',
      'Export reports for department records',
    ],
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName]       = useState('')
  const [role, setRole]       = useState<'student' | 'lecturer' | null>(null)
  const [index, setIndex]     = useState(0)
  const [visible, setVisible] = useState(true)
  const [ready, setReady]     = useState(false)

  useEffect(() => {
    const storedRole = localStorage.getItem('role') as 'student' | 'lecturer' | null
    const userId     = localStorage.getItem('userId')

    if (!storedRole || !userId) { router.replace('/login'); return }

    setRole(storedRole)

    users.me()
      .then((profile) => setName(profile.name?.split(' ')[0] ?? ''))
      .catch(() => {})
      .finally(() => setReady(true))
  }, [router])

  const slides = role === 'lecturer' ? LECTURER_SLIDES : STUDENT_SLIDES
  const slide  = slides[index]
  const last   = index === slides.length - 1

  const finish = () => {
    const userId = localStorage.getItem('userId') ?? ''
    localStorage.setItem(`cortex_onboarded_${userId}`, '1')
    router.replace(role === 'lecturer' ? '/overview' : '/student/overview')
  }

  const transition = (fn: () => void) => {
    setVisible(false)
    setTimeout(() => { fn(); setVisible(true) }, 180)
  }

  const goNext = () => {
    if (last) { finish(); return }
    transition(() => setIndex((i) => i + 1))
  }

  const goPrev = () => {
    if (index === 0) return
    transition(() => setIndex((i) => i - 1))
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  const Icon = slide.icon

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 sm:px-10 py-5 shrink-0">
        <span className="font-bold text-lg tracking-tight">Cortex</span>
        <button
          onClick={finish}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
        >
          Skip
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div
          className="w-full max-w-lg transition-opacity duration-200"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {/* Welcome line — only on first slide */}
          {index === 0 && name && (
            <p className="text-sm font-medium text-primary mb-6 tracking-wide uppercase">
              Welcome, {name}
            </p>
          )}

          {/* Icon */}
          <div className="mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Icon className="w-8 h-8 text-primary" strokeWidth={1.5} />
            </div>
          </div>

          {/* Step label */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            {slide.label}
          </p>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold leading-snug mb-4">
            {slide.title}
          </h1>

          {/* Description */}
          <p className="text-muted-foreground leading-relaxed mb-8">
            {slide.description}
          </p>

          {/* Feature list */}
          <ul className="space-y-3">
            {slide.features.map((f, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground leading-relaxed">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="shrink-0 px-6 sm:px-10 pb-8 pt-4">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">

          {/* Back */}
          <Button
            variant="ghost"
            size="sm"
            onClick={goPrev}
            disabled={index === 0}
            className="w-24 text-muted-foreground disabled:opacity-0"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => transition(() => setIndex(i))}
                className={cn(
                  'rounded-full transition-all duration-200',
                  i === index
                    ? 'w-6 h-2 bg-primary'
                    : 'w-2 h-2 bg-muted hover:bg-muted-foreground/40'
                )}
              />
            ))}
          </div>

          {/* Next / Get Started */}
          <Button size="sm" onClick={goNext} className="w-24 gap-1">
            {last ? 'Get started' : (<>Next <ChevronRight className="w-4 h-4" /></>)}
          </Button>

        </div>
      </div>
    </div>
  )
}
