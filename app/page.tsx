'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  BookOpen,
  Users,
  BarChart3,
  Calendar,
  CheckCircle2,
  MessageSquare,
  GraduationCap,
  ArrowRight,
  Star,
  Shield,
  Zap,
  Globe,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const features = [
  {
    icon: BookOpen,
    title: 'Smart Course Management',
    description: 'Create, organise and deliver course content with ease. Upload materials, set deadlines and track progress in one place.',
  },
  {
    icon: Users,
    title: 'Student & Lecturer Portals',
    description: 'Separate dedicated dashboards for lecturers and students — everyone sees exactly what they need.',
  },
  {
    icon: CheckCircle2,
    title: 'Attendance Tracking',
    description: 'Mark and monitor attendance in real time. Get alerts for students at risk before it becomes a problem.',
  },
  {
    icon: BarChart3,
    title: 'Performance Analytics',
    description: 'Visual dashboards and reports that show grades, attendance trends and assignment completion at a glance.',
  },
  {
    icon: Calendar,
    title: 'Schedule Management',
    description: 'Keep everyone on the same page with a shared timetable. No more missed classes or double bookings.',
  },
  {
    icon: MessageSquare,
    title: 'Built-in Messaging',
    description: 'Direct communication between students and lecturers — no need for external email or chat tools.',
  },
]

const stats = [
  { value: '10,000+', label: 'Active Learners' },
  { value: '500+', label: 'Courses Delivered' },
  { value: '98%', label: 'Satisfaction Rate' },
  { value: '60+', label: 'Institutions' },
]

const testimonials = [
  {
    name: 'Dr. Amara Osei',
    role: 'Senior Lecturer, Business Studies',
    avatar: 'AO',
    quote: 'Cortex transformed how I manage my classes. The analytics show me exactly which students need support before they fall behind.',
  },
  {
    name: 'Marcus Thompson',
    role: 'Postgraduate Student',
    avatar: 'MT',
    quote: 'Having all my assignments, grades and schedule in one place saves me so much time. The mobile view works great too.',
  },
  {
    name: 'Prof. Linda Chukwu',
    role: 'Head of Department, Engineering',
    avatar: 'LC',
    quote: 'Attendance tracking alone has improved our pass rates by 18%. It is the best academic tool our faculty has adopted.',
  },
]

const steps = [
  { step: '01', title: 'Create your account', description: 'Sign up as a lecturer or student in under a minute.' },
  { step: '02', title: 'Set up your classes', description: 'Lecturers build courses and enrol students. Students see their dashboard instantly.' },
  { step: '03', title: 'Learn and grow', description: 'Track progress, submit work, communicate and succeed — all in one platform.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-7 w-7" />
            <span className="text-xl font-bold">Cortex</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">Testimonials</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild><Link href="/login">Sign In</Link></Button>
            <Button asChild><Link href="/signup">Get Started</Link></Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <Badge variant="outline" className="w-fit gap-2 px-3 py-1.5">
                <Zap className="h-3.5 w-3.5" />
                Built for modern education
              </Badge>
              <h1 className="text-4xl lg:text-6xl font-bold leading-tight tracking-tight">
                The smarter way to{' '}
                <span className="underline decoration-4 decoration-primary underline-offset-4">
                  manage learning
                </span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
                Cortex connects lecturers and students on one powerful platform — from course delivery and attendance to grades and analytics.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" asChild>
                  <Link href="/signup">
                    Get started free <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/login">Sign in to your account</Link>
                </Button>
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-600" /> No credit card</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-600" /> Free to get started</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-600" /> Cancel anytime</span>
              </div>
            </div>

            {/* Hero image */}
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-border">
                <Image
                  src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&q=80"
                  alt="Adult learners in a modern classroom environment"
                  width={800}
                  height={560}
                  className="object-cover w-full h-[420px]"
                  priority
                />
              </div>
              {/* Floating badge */}
              <div className="absolute -bottom-4 -left-4 bg-card border border-border rounded-xl px-4 py-3 shadow-lg flex items-center gap-3">
                <div className="flex -space-x-2">
                  {['AO', 'MT', 'LC'].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center ring-2 ring-background">
                      {i}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-sm font-semibold">10,000+ learners</p>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl lg:text-4xl font-bold">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <Badge variant="outline" className="mb-4">Features</Badge>
          <h2 className="text-3xl lg:text-4xl font-bold">Everything you need in one place</h2>
          <p className="text-muted-foreground mt-4">
            Designed for higher education and professional training environments.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <Card key={f.title} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6 space-y-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-base">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Split section — For educators / students ── */}
      <section className="bg-muted/40 border-y border-border">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative rounded-2xl overflow-hidden shadow-xl ring-1 ring-border order-2 lg:order-1">
              <Image
                src="https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&q=80"
                alt="Professional lecturer presenting to adult students"
                width={800}
                height={500}
                className="object-cover w-full h-[380px]"
              />
            </div>
            <div className="space-y-6 order-1 lg:order-2">
              <Badge variant="outline">For Lecturers</Badge>
              <h2 className="text-3xl font-bold">Run your classes with confidence</h2>
              <p className="text-muted-foreground leading-relaxed">
                Manage enrolments, publish assignments, track attendance and view class-wide analytics — all from your lecturer dashboard.
              </p>
              <ul className="space-y-3">
                {['Bulk attendance marking', 'Assignment creation and grading', 'Student performance reports', 'Class announcements and messaging'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button asChild>
                <Link href="/signup">Start as a Lecturer <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <Badge variant="outline">For Students</Badge>
            <h2 className="text-3xl font-bold">Stay on top of your studies</h2>
            <p className="text-muted-foreground leading-relaxed">
              View your schedule, track assignments, check your attendance, and message lecturers — all in your personalised student portal.
            </p>
            <ul className="space-y-3">
              {['Assignment deadlines and submissions', 'Real-time attendance history', 'Exam results and GPA tracking', 'Direct messaging with lecturers'].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
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
              alt="Adult students collaborating on coursework"
              width={800}
              height={500}
              className="object-cover w-full h-[380px]"
            />
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="bg-muted/40 border-y border-border">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="text-center max-w-xl mx-auto mb-14">
            <Badge variant="outline" className="mb-4">How it works</Badge>
            <h2 className="text-3xl lg:text-4xl font-bold">Up and running in minutes</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.step} className="text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground text-xl font-bold flex items-center justify-center mx-auto">
                  {s.step}
                </div>
                <h3 className="font-semibold text-lg">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-center max-w-xl mx-auto mb-14">
          <Badge variant="outline" className="mb-4">Testimonials</Badge>
          <h2 className="text-3xl lg:text-4xl font-bold">Trusted by educators and learners</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <Card key={t.name} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6 space-y-4">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
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
      </section>

      {/* ── Trust badges ── */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {[
              { icon: Shield, title: 'Secure & Private', desc: 'All data encrypted in transit and at rest. GDPR compliant.' },
              { icon: Zap, title: 'Fast & Reliable', desc: '99.9% uptime SLA. Built on modern cloud infrastructure.' },
              { icon: Globe, title: 'Access Anywhere', desc: 'Works on any device — desktop, tablet or mobile browser.' },
            ].map((item) => (
              <div key={item.title} className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="mx-auto max-w-7xl px-6 py-24 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl lg:text-5xl font-bold">Ready to transform your institution?</h2>
          <p className="text-muted-foreground text-lg">
            Join thousands of educators and students already using Cortex. Get started for free today.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/signup">Create your free account <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <GraduationCap className="h-5 w-5" />
            Cortex
          </div>
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} Cortex. Built as a final year project. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}

