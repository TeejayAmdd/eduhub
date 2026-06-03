'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  BookOpen, BarChart3, Calendar, CheckCircle2,
  MessageSquare, ArrowRight, Star, Shield, Zap, Globe,
  Video, ClipboardList, PenSquare,
  FileText, Calculator, BookMarked, ChevronRight, ChevronLeft,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const features = [
  {
    icon: Sparkles,
    title: 'AI Study Assistant',
    description: 'AI answers grounded in your course materials — 24/7.',
    highlight: true,
  },
  {
    icon: Video,
    title: 'Live Virtual Lectures',
    description: 'Start a live class in one click. Attendance tracked automatically.',
  },
  {
    icon: CheckCircle2,
    title: 'Attendance Tracking',
    description: 'Real-time attendance during live sessions. Both sides see rates instantly.',
  },
  {
    icon: BookOpen,
    title: 'Course Materials',
    description: 'Upload PDFs per course. Students view and download anytime.',
  },
  {
    icon: ClipboardList,
    title: 'Assignments & Grading',
    description: 'Set deadlines, collect submissions, grade with feedback.',
  },
  {
    icon: PenSquare,
    title: 'Quizzes & Tests',
    description: 'Timed quizzes with instant results and score overview.',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    description: 'Attendance, grade and progress dashboards for all users.',
  },
  {
    icon: MessageSquare,
    title: 'Direct Messaging',
    description: 'Text, files and voice notes with reactions and read receipts.',
  },
  {
    icon: Calendar,
    title: 'Schedule & Timetable',
    description: 'Set class slots once. Students get their timetable automatically.',
  },
  {
    icon: BookMarked,
    title: 'Study Hub',
    description: 'Peer tutors host sessions and broadcast to classmates.',
  },
  {
    icon: Calculator,
    title: 'CGPA Simulator',
    description: 'Simulate grades to see the impact on your cumulative GPA.',
  },
  {
    icon: FileText,
    title: 'Document Converter',
    description: 'Convert PDF, Word and image formats inside the platform.',
  },
]

const lecturerFeatures = [
  'Create and manage multiple courses with full enrolment control',
  'Start live video lectures with one click — students are notified instantly',
  'Upload course materials (PDFs, documents) for students to access',
  'Create assignments with deadlines, grade submissions and give feedback',
  'Build timed multiple-choice quizzes — results visible immediately',
  'Track attendance in real time during live sessions',
  'View class-wide analytics: attendance rates, scores and trends',
  'Set up weekly class schedules — auto-timetable for students',
  'Select peer tutors from top-performing students via the Study Hub',
  'Communicate with students through direct messaging and announcements',
]

const studentFeatures = [
  'Join live video lectures from any device, anywhere',
  'Chat with an AI Study Assistant trained on your course materials',
  'Access all uploaded lecture materials and download them anytime',
  'Submit assignments as file uploads or links before deadlines',
  'Take timed quizzes and see your score and correct answers instantly',
  'Check your attendance record and rate per course in real time',
  'View your weekly class timetable, updated automatically',
  'Apply to be a peer tutor and host tutorial sessions',
  'Message lecturers and classmates with text, files and voice notes',
  'Simulate different grades using the CGPA calculator',
]

const stats = [
  { value: '12+', label: 'Core Features' },
  { value: '2', label: 'User Portals' },
  { value: 'AI', label: 'Powered Assistance' },
  { value: '100%', label: 'Mobile Friendly' },
]

const testimonials = [
  {
    name: 'Dr. Adewale Okafor',
    role: 'Senior Lecturer, Computer Science',
    avatar: 'AO',
    quote: 'Cortex changed how I run my classes entirely. The live lecture feature with automatic attendance tracking saves me 30 minutes every class. The analytics tell me exactly who needs help.',
  },
  {
    name: 'Fatima Ibrahim',
    role: 'Final Year Student',
    avatar: 'FI',
    quote: 'The AI Study Assistant is incredible. I can ask it to explain a concept from the lecturer\'s notes at 2am and it gives me a clear answer based on exactly what was taught.',
  },
  {
    name: 'Prof. Ngozi Chukwu',
    role: 'Head of Department, Engineering',
    avatar: 'NC',
    quote: 'Having attendance, grading, scheduling and communication all in one platform means my lecturers spend less time on admin and more time actually teaching.',
  },
]

const steps = [
  {
    step: '01',
    title: 'Create your account',
    description: 'Sign up as a lecturer or student in under two minutes. No payment required to get started.',
  },
  {
    step: '02',
    title: 'Set up your courses',
    description: 'Lecturers create courses and enrol students. Upload materials, set a schedule and publish assignments.',
  },
  {
    step: '03',
    title: 'Teach and learn — smarter',
    description: 'Go live for lectures, track attendance automatically, let the AI assist students and monitor progress through analytics.',
  },
]

export default function LandingPage() {
  const [featureIndex, setFeatureIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const prev = useCallback(() =>
    setFeatureIndex((i) => (i - 1 + features.length) % features.length), [])
  const next = useCallback(() =>
    setFeatureIndex((i) => (i + 1) % features.length), [])

  useEffect(() => {
    if (paused) return
    const id = setInterval(next, 3000)
    return () => clearInterval(id)
  }, [paused, next])

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/cortex-icon.svg" alt="Cortex" className="h-9 w-9 rounded-xl dark:block hidden" />
            <img src="/cortex-icon-light.svg" alt="Cortex" className="h-9 w-9 rounded-xl dark:hidden block" />
            <span className="text-xl font-bold">Cortex</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#for-lecturers" className="hover:text-foreground transition-colors">Lecturers</a>
            <a href="#for-students" className="hover:text-foreground transition-colors">Students</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" asChild><Link href="/login">Sign In</Link></Button>
            <Button size="sm" asChild><Link href="/signup">Get Started</Link></Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="space-y-6 sm:space-y-8">
              <Badge variant="outline" className="w-fit gap-2 px-3 py-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Now with AI Study Assistant
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                The complete learning platform for{' '}
                <span className="underline decoration-4 decoration-primary underline-offset-4">
                  modern education
                </span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground max-w-lg leading-relaxed">
                Cortex brings live lectures, AI-powered study assistance, attendance tracking, assignments, quizzes, analytics and communication together — in one platform built for lecturers and students.
              </p>
              <div className="flex flex-wrap gap-3 sm:gap-4">
                <Button size="lg" asChild>
                  <Link href="/signup">
                    Get started free <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/login">Sign in to your account</Link>
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-600" />No credit card</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-600" />Free to get started</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-600" />Works on any device</span>
              </div>
            </div>

            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-border">
                <Image
                  src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&q=80"
                  alt="Students and lecturers using Cortex"
                  width={800} height={560}
                  className="object-cover w-full h-[360px] sm:h-[420px]"
                  priority
                />
              </div>
              <div className="absolute -bottom-4 -left-4 bg-card border border-border rounded-xl px-4 py-3 shadow-lg flex items-center gap-3">
                <div className="flex -space-x-2">
                  {['FI', 'AO', 'NC'].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center ring-2 ring-background">
                      {i}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-sm font-semibold">Students & Lecturers</p>
                  <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold">{s.value}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Highlight ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20">
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-6 sm:p-10 lg:p-14 text-primary-foreground overflow-hidden relative">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }} />
          <div className="relative grid lg:grid-cols-2 gap-8 items-center">
            <div className="space-y-4 sm:space-y-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                <span className="font-semibold text-sm uppercase tracking-widest opacity-80">AI Study Assistant</span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">
                Chat with your course materials — powered by AI
              </h2>
              <p className="text-primary-foreground/80 leading-relaxed text-sm sm:text-base">
                Cortex uses Claude AI to read your lecturer's uploaded PDFs and answer student questions based solely on the course content. Ask for summaries, explanations, key points or anything about the material — available 24/7.
              </p>
              <ul className="space-y-2 text-sm">
                {[
                  'Answers grounded only in your course material — no hallucinations',
                  'Ask follow-up questions in a natural conversation',
                  'Available per enrolled course with materials uploaded',
                  'Chat history saved so you can pick up where you left off',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-xl p-5 border border-white/20 space-y-3">
              <p className="text-xs font-semibold opacity-60 uppercase tracking-wider">AI Study Assistant</p>
              {[
                { role: 'student', msg: 'Summarise the key points from Chapter 3' },
                { role: 'ai', msg: 'Based on the uploaded materials, Chapter 3 covers three main topics: data structures, algorithm complexity and sorting algorithms. Key points include...' },
                { role: 'student', msg: 'Explain Big O notation simply' },
                { role: 'ai', msg: 'Big O notation describes how an algorithm\'s performance scales with input size. According to your lecture notes, O(n) means the time grows linearly...' },
              ].map((item, i) => (
                <div key={i} className={`flex ${item.role === 'student' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`rounded-xl px-3 py-2 text-xs max-w-[80%] ${item.role === 'student' ? 'bg-white/20' : 'bg-white/10'}`}>
                    {item.msg}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features grid ──────────────────────────────────────────────────── */}
      <section id="features" className="bg-muted/40 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <Badge variant="outline" className="mb-4">Everything you need</Badge>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">One platform. Every feature.</h2>
            <p className="text-muted-foreground mt-4 text-sm sm:text-base">
              Cortex replaces every disconnected tool your institution uses — no more juggling emails, WhatsApp groups, USB drives and spreadsheets.
            </p>
          </div>
          {/* Sliding carousel — one card at a time */}
          <div
            className="relative"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {/* Slide track */}
            <div className="overflow-hidden rounded-2xl">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${featureIndex * 100}%)` }}
              >
                {features.map((f) => (
                  <div key={f.title} className="w-full shrink-0 px-1">
                    <Card className={`h-full ${f.highlight ? 'ring-2 ring-primary/30 bg-primary/5' : ''}`}>
                      <CardContent className="p-8 sm:p-10 flex flex-col items-center text-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${f.highlight ? 'bg-primary text-primary-foreground' : 'bg-primary/10'}`}>
                          <f.icon className={`h-7 w-7 ${f.highlight ? '' : 'text-primary'}`} />
                        </div>
                        <div className="space-y-2">
                          <h3 className="font-bold text-lg flex items-center justify-center gap-2">
                            {f.title}
                            {f.highlight && <Badge className="text-[10px] px-1.5 py-0 h-4">New</Badge>}
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{f.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>

            {/* Prev / Next arrows */}
            <button
              onClick={prev}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-9 h-9 rounded-full bg-background border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors z-10"
              aria-label="Previous feature"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={next}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-9 h-9 rounded-full bg-background border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors z-10"
              aria-label="Next feature"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Dot indicators */}
            <div className="flex justify-center gap-1.5 mt-6">
              {features.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setFeatureIndex(i)}
                  className={`rounded-full transition-all ${i === featureIndex ? 'w-6 h-2 bg-primary' : 'w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/60'}`}
                  aria-label={`Go to feature ${i + 1}`}
                />
              ))}
            </div>

            {/* Counter */}
            <p className="text-center text-xs text-muted-foreground mt-2">
              {featureIndex + 1} / {features.length}
            </p>
          </div>
        </div>
      </section>

      {/* ── For Lecturers ──────────────────────────────────────────────────── */}
      <section id="for-lecturers" className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="relative rounded-2xl overflow-hidden shadow-xl ring-1 ring-border order-2 lg:order-1">
            <Image
              src="https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&q=80"
              alt="Lecturer using Cortex to manage classes"
              width={800} height={500}
              className="object-cover w-full h-[300px] sm:h-[400px]"
            />
          </div>
          <div className="space-y-5 sm:space-y-6 order-1 lg:order-2">
            <Badge variant="outline">For Lecturers</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold">Run your classes with complete control</h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              From the moment you create a course to the day you publish final grades — Cortex handles every step so you can focus on what matters: teaching.
            </p>
            <ul className="space-y-2.5">
              {lecturerFeatures.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <Button asChild>
              <Link href="/signup">Start as a Lecturer <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── For Students ───────────────────────────────────────────────────── */}
      <section id="for-students" className="bg-muted/40 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="space-y-5 sm:space-y-6">
              <Badge variant="outline">For Students</Badge>
              <h2 className="text-2xl sm:text-3xl font-bold">Everything you need to succeed — in your pocket</h2>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                From attending live lectures to getting AI help at midnight — Cortex keeps you on track, organised and performing at your best.
              </p>
              <ul className="space-y-2.5">
                {studentFeatures.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button asChild>
                <Link href="/signup">Start as a Student <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="relative rounded-2xl overflow-hidden shadow-xl ring-1 ring-border">
              <Image
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80"
                alt="Students using Cortex on their devices"
                width={800} height={500}
                className="object-cover w-full h-[300px] sm:h-[400px]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center max-w-xl mx-auto mb-10 sm:mb-14">
          <Badge variant="outline" className="mb-4">How it works</Badge>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Up and running in minutes</h2>
          <p className="text-muted-foreground mt-3 text-sm sm:text-base">
            No lengthy onboarding. No IT department required. Just sign up and start.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
          {steps.map((s, i) => (
            <div key={s.step} className="relative text-center space-y-4">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-7 left-[calc(50%+28px)] right-[calc(-50%+28px)] h-px bg-border" />
              )}
              <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground text-xl font-bold flex items-center justify-center mx-auto relative z-10">
                {s.step}
              </div>
              <h3 className="font-semibold text-base sm:text-lg">{s.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────────────── */}
      <section id="testimonials" className="bg-muted/40 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center max-w-xl mx-auto mb-10 sm:mb-14">
            <Badge variant="outline" className="mb-4">Testimonials</Badge>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">What educators and students say</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
            {testimonials.map((t) => (
              <Card key={t.name} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 sm:p-6 space-y-4">
                  <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed italic">&ldquo;{t.quote}&rdquo;</p>
                  <div className="flex items-center gap-3 pt-2 border-t border-border">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center shrink-0">
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust ──────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-14 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 text-center">
          {[
            { icon: Shield, title: 'Secure & Private', desc: 'All data encrypted in transit and at rest. Your information never leaves the platform.' },
            { icon: Zap, title: 'Fast & Reliable', desc: 'Built on cloud infrastructure with uptime monitoring. Always on when you need it.' },
            { icon: Globe, title: 'Works Everywhere', desc: 'Fully responsive across desktop, tablet and mobile. No app download needed.' },
          ].map((item) => (
            <div key={item.title} className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-sm sm:text-base">{item.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24 text-center">
          <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold">Ready to transform how you teach and learn?</h2>
            <p className="text-muted-foreground text-sm sm:text-lg leading-relaxed">
              Join Cortex today. Create your account in under two minutes — no payment, no setup fee.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
              <Button size="lg" asChild>
                <Link href="/signup">Create your free account <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Already have an account? Sign in</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 font-semibold">
            <img src="/cortex-icon.svg" alt="Cortex" className="h-7 w-7 rounded-lg dark:block hidden" />
            <img src="/cortex-icon-light.svg" alt="Cortex" className="h-7 w-7 rounded-lg dark:hidden block" />
            <span>Cortex</span>
            <span className="text-muted-foreground font-normal text-xs ml-1">· Learning Platform</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} Cortex. Built as a final year project. All rights reserved.
          </p>
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
