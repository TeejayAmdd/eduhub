'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { BookOpen, GraduationCap, Loader2, ArrowLeft, ArrowRight, Check, Mail, RefreshCw, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { auth } from '@/lib/api'

type Role = 'lecturer' | 'student'

const DEPARTMENTS = [
  'Computer Science',
  'Engineering',
  'Business Administration',
  'Medicine & Surgery',
  'Law',
  'Education',
  'Arts & Humanities',
  'Sciences',
  'Social Sciences',
  'Architecture',
  'Pharmacy',
  'Nursing',
]

const LEVELS = ['100L', '200L', '300L', '400L', '500L', 'Postgraduate']

const STEPS = ['Role', 'Details', 'Account', 'Verify']

export default function SignupPage() {
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [role, setRole] = useState<Role>('student')

  // Step 2 fields
  const [name, setName] = useState('')
  const [matricNumber, setMatricNumber] = useState('')
  const [staffNumber, setStaffNumber] = useState('')
  const [department, setDepartment] = useState('')
  const [level, setLevel] = useState('')

  // Step 3 fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 4 — verification
  const [verifyCode, setVerifyCode] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const next = () => { setError(''); setStep((s) => s + 1) }
  const back = () => { setError(''); setStep((s) => s - 1) }

  const validateStep1 = () => true

  const validateStep2 = () => {
    if (!name.trim()) { setError('Full name is required'); return false }
    if (role === 'student' && !matricNumber.trim()) { setError('Matric number is required'); return false }
    if (role === 'lecturer' && !staffNumber.trim()) { setError('Staff number is required'); return false }
    if (!department) { setError('Please select your department'); return false }
    if (role === 'student' && !level) { setError('Please select your level'); return false }
    return true
  }

  const validateStep3 = () => {
    if (!email.trim()) { setError('Email is required'); return false }
    if (role === 'student' && !email.toLowerCase().endsWith('@st.lasu.edu.ng')) {
      setError('Student email must end with @st.lasu.edu.ng')
      return false
    }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return false }
    if (password !== confirmPassword) { setError('Passwords do not match'); return false }
    return true
  }

  const handleNext = () => {
    if (step === 0 && validateStep1()) next()
    else if (step === 1 && validateStep2()) next()
  }

  const handleSubmit = async () => {
    if (!validateStep3()) return
    setLoading(true)
    setError('')
    try {
      await auth.register(
        name, email, password, role,
        department,
        role === 'student' ? level : undefined,
        role === 'student' ? matricNumber : undefined,
        role === 'lecturer' ? staffNumber : undefined,
      )
      setVerifyCode('')
      setResendCooldown(60)
      next()  // move to step 4 — Verify
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    if (verifyCode.trim().length !== 6) { setError('Enter the 6-digit code sent to your email'); return }
    setLoading(true); setError('')
    try {
      await auth.verifyEmail(email, verifyCode.trim())
      // Flag this browser as having just created an account.
      // Persists until the user logs in, regardless of how long that takes.
      localStorage.setItem('cortex_new_account', '1')
      setStep(4)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setError('')
    try {
      await auth.resendCode(email)
      setResendCooldown(60)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend code')
    }
  }

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  return (
    <div className="min-h-screen flex relative">
      {/* Mobile background image */}
      <div className="absolute inset-0 lg:hidden overflow-hidden">
        <Image
          src="/signup-opt1.jpg"
          alt=""
          fill
          sizes="(max-width: 1023px) 100vw, 0px"
          className="object-cover blur-md scale-110"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/70 to-primary/50" />
      </div>

      {/* Left panel — background image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <Image
          src="/signup-opt1.jpg"
          alt="Students on campus"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 to-primary/40" />
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <h1 className="text-4xl font-bold mb-3">Cortex</h1>
          <p className="text-lg text-white/90 max-w-sm">
            Lagos State University's learning management platform — connecting students and lecturers seamlessly.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-6 py-10 sm:py-12 lg:px-16 overflow-y-auto lg:bg-background">
        <div className="w-full max-w-md mx-auto">
          <div className="rounded-2xl bg-background/95 backdrop-blur-sm p-6 sm:p-8 space-y-8 shadow-xl lg:rounded-none lg:bg-transparent lg:backdrop-blur-none lg:p-0 lg:shadow-none">

          {/* Header — hidden on success screen */}
          {step < 4 && (
            <>
              <div>
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-1">
                  Step {step + 1} of {STEPS.length}
                </p>
                <h2 className="text-2xl font-bold">
                  {step === 0 && 'Who are you?'}
                  {step === 1 && 'Your details'}
                  {step === 2 && 'Set up your account'}
                  {step === 3 && 'Verify your email'}
                </h2>
              </div>

              {/* Progress bar */}
              <div className="flex gap-2">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-all duration-300',
                      i <= step ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                ))}
              </div>
            </>
          )}

          {/* ── Step 1: Role selection ── */}
          {step === 0 && (
            <div className="space-y-6">
              <p className="text-muted-foreground text-sm">Select how you'll be using Cortex.</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={cn(
                    'flex flex-col items-center gap-3 rounded-2xl border-2 p-6 transition-all duration-200',
                    role === 'student'
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30'
                  )}
                >
                  <div className={cn(
                    'w-14 h-14 rounded-full flex items-center justify-center',
                    role === 'student' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}>
                    <GraduationCap className="h-7 w-7" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">Student</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Access courses & grades</p>
                  </div>
                  {role === 'student' && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setRole('lecturer')}
                  className={cn(
                    'flex flex-col items-center gap-3 rounded-2xl border-2 p-6 transition-all duration-200',
                    role === 'lecturer'
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30'
                  )}
                >
                  <div className={cn(
                    'w-14 h-14 rounded-full flex items-center justify-center',
                    role === 'lecturer' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}>
                    <BookOpen className="h-7 w-7" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">Lecturer</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Manage courses & students</p>
                  </div>
                  {role === 'lecturer' && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Personal details ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Adewale Johnson"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>

              {role === 'student' ? (
                <div className="space-y-2">
                  <Label htmlFor="matric">Matric Number</Label>
                  <Input
                    id="matric"
                    placeholder="e.g. LASU/19/CS/001"
                    value={matricNumber}
                    onChange={(e) => setMatricNumber(e.target.value.toUpperCase())}
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">Your university matric number</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="staff">Staff Number</Label>
                  <Input
                    id="staff"
                    placeholder="e.g. LASU/STAFF/0042"
                    value={staffNumber}
                    onChange={(e) => setStaffNumber(e.target.value.toUpperCase())}
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">Your staff identification number</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select your department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {role === 'student' && (
                <div className="space-y-2">
                  <Label htmlFor="level">Level / Year</Label>
                  <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger id="level">
                      <SelectValue placeholder="Select your current level" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Account setup ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-2">
                {role === 'student' ? (
                  <>
                    <Label htmlFor="email">Student Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="matricno@st.lasu.edu.ng"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                    <p className="text-xs text-muted-foreground">
                      Must end with <span className="font-medium text-foreground">@st.lasu.edu.ng</span>
                    </p>
                  </>
                ) : (
                  <>
                    <Label htmlFor="email">Staff Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="firstname.lastname@lasu.edu.ng"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              {/* Summary card */}
              <div className="rounded-xl bg-muted/50 p-4 text-sm space-y-1.5">
                <p className="font-medium text-foreground mb-2">Account summary</p>
                <div className="flex justify-between text-muted-foreground">
                  <span>Role</span>
                  <span className="capitalize font-medium text-foreground">{role}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Name</span>
                  <span className="font-medium text-foreground">{name}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{role === 'student' ? 'Matric No.' : 'Staff No.'}</span>
                  <span className="font-medium text-foreground font-mono text-xs">
                    {role === 'student' ? matricNumber : staffNumber}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Department</span>
                  <span className="font-medium text-foreground">{department}</span>
                </div>
                {role === 'student' && level && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Level</span>
                    <span className="font-medium text-foreground">{level}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 4: Email verification ── */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Icon + info */}
              <div className="flex flex-col items-center text-center gap-3 py-2">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    We sent a 6-digit code to
                  </p>
                  <p className="font-semibold text-foreground">{email}</p>
                  <p className="text-xs text-muted-foreground mt-1">Check your inbox (and spam folder).</p>
                </div>
              </div>

              {/* Code input */}
              <div className="space-y-2">
                <Label htmlFor="code" className="text-center block">Verification Code</Label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full text-center text-3xl font-bold tracking-[0.4em] rounded-xl border-2 border-input bg-background px-4 py-4 focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Resend */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Code expires in 15 minutes.
              </p>
            </div>
          )}

          {/* ── Step 5: Success ── */}
          {step === 4 && (
            <div className="flex flex-col items-center text-center gap-6 py-4">
              {/* Animated checkmark */}
              <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-[scale-in_0.4s_ease-out]">
                <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                  <Check className="w-10 h-10 text-white stroke-[3]" />
                </div>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">You're all set, {name.split(' ')[0]}!</h2>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                  Your Cortex {role} account has been verified and activated.
                  {role === 'student'
                    ? ' You can now enroll in courses, attend live lectures, and track your progress.'
                    : ' You can now create courses, schedule live lectures, and manage your students.'}
                </p>
              </div>

              {/* Account summary pill */}
              <div className="w-full rounded-xl border bg-muted/30 px-4 py-3 space-y-1.5 text-sm text-left">
                <div className="flex justify-between text-muted-foreground">
                  <span>Name</span>
                  <span className="font-medium text-foreground">{name}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Email</span>
                  <span className="font-medium text-foreground truncate max-w-[55%]">{email}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Role</span>
                  <span className="font-medium text-foreground capitalize">{role}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{role === 'student' ? 'Matric No.' : 'Staff No.'}</span>
                  <span className="font-medium text-foreground font-mono text-xs">
                    {role === 'student' ? matricNumber : staffNumber}
                  </span>
                </div>
              </div>

              {/* CTA */}
              <Button className="w-full gap-2" size="lg" onClick={() => router.push('/login?verified=1')}>
                <LogIn className="w-4 h-4" />
                Sign in to Cortex
              </Button>

              <p className="text-xs text-muted-foreground">
                A welcome email has been sent to {email}
              </p>
            </div>
          )}

          {/* Error — hidden on success screen */}
          {error && step < 4 && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          {/* Navigation buttons — hidden on success screen */}
          {step < 4 && (
            <div className="flex gap-3">
              {step > 0 && step < 3 && (
                <Button type="button" variant="outline" className="flex-1" onClick={back} disabled={loading}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              {step < 2 ? (
                <Button type="button" className="flex-1" onClick={handleNext}>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : step === 2 ? (
                <Button type="button" className="flex-1" onClick={handleSubmit} disabled={loading}>
                  {loading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending code…</>
                    : <><Mail className="w-4 h-4 mr-2" />Send Verification Code</>
                  }
                </Button>
              ) : (
                <Button type="button" className="flex-1" onClick={handleVerify} disabled={loading || verifyCode.length !== 6}>
                  {loading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</>
                    : <><Check className="w-4 h-4 mr-2" />Confirm & Create Account</>
                  }
                </Button>
              )}
            </div>
          )}

          {step < 4 && (
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-primary hover:underline underline-offset-4">
                Sign in
              </Link>
            </p>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}

