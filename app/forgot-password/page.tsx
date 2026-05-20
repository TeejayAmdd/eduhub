'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  GraduationCap, BookOpen, Loader2, Eye, EyeOff,
  ShieldCheck, Mail, KeyRound, CheckCircle2, ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { auth } from '@/lib/api'

type Role = 'student' | 'lecturer'
type Step = 1 | 2 | 3 | 4

const STEPS = [
  { icon: ShieldCheck, label: 'Find Account' },
  { icon: Mail,        label: 'Verify Email' },
  { icon: KeyRound,    label: 'Enter Code' },
  { icon: CheckCircle2,label: 'New Password' },
]

function maskName(name: string) {
  const parts = name.trim().split(' ')
  return parts
    .map((p) => (p.length <= 1 ? p : p[0] + '*'.repeat(p.length - 1)))
    .join(' ')
}

export default function ForgotPasswordPage() {
  const router = useRouter()

  const [role, setRole]         = useState<Role>('student')
  const [step, setStep]         = useState<Step>(1)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // step 1
  const [idNumber, setIdNumber] = useState('')
  const [account, setAccount]   = useState<{ name: string; masked_email: string } | null>(null)

  // step 2
  const [email, setEmail]       = useState('')
  const [confirmedEmail, setConfirmedEmail] = useState('')

  // step 3
  const [code, setCode]         = useState('')

  // step 4
  const [password, setPassword]       = useState('')
  const [confirm, setConfirm]         = useState('')
  const [showPw, setShowPw]           = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [done, setDone]               = useState(false)

  const err = (msg: string) => { setError(msg); setLoading(false) }

  // ── Step 1: lookup ──────────────────────────────────────────────────────────
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!idNumber.trim()) return err('Please enter your ID number')
    setLoading(true); setError('')
    try {
      const params = role === 'student'
        ? { matric_number: idNumber.trim() }
        : { staff_number: idNumber.trim() }
      const data = await auth.forgotLookup(params)
      setAccount(data)
      setStep(2)
    } catch (e: unknown) {
      err(e instanceof Error ? e.message : 'Account not found')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: send code ───────────────────────────────────────────────────────
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return err('Please enter your email address')
    setLoading(true); setError('')
    try {
      const params = role === 'student'
        ? { email: email.trim().toLowerCase(), matric_number: idNumber.trim() }
        : { email: email.trim().toLowerCase(), staff_number: idNumber.trim() }
      await auth.forgotSendCode(params)
      setConfirmedEmail(email.trim().toLowerCase())
      setStep(3)
    } catch (e: unknown) {
      err(e instanceof Error ? e.message : 'Could not send code')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3: verify code ─────────────────────────────────────────────────────
  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault()
    if (code.trim().length !== 6) return err('Enter the 6-digit code sent to your email')
    setError('')
    setStep(4)
  }

  // ── Step 4: reset password ──────────────────────────────────────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) return err('Password must be at least 6 characters')
    if (password !== confirm) return err('Passwords do not match')
    setLoading(true); setError('')
    try {
      await auth.forgotReset(confirmedEmail, code.trim(), password)
      setDone(true)
    } catch (e: unknown) {
      err(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — form ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-md mx-auto space-y-8">

          {/* Logo + back */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">EduHub</h1>
              <p className="text-muted-foreground mt-0.5 text-sm">Lagos State University LMS</p>
            </div>
            <Link
              href="/login"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </Link>
          </div>

          {/* Heading */}
          <div>
            <h2 className="text-2xl font-semibold">Forgot your password?</h2>
            <p className="text-muted-foreground text-sm mt-1">
              We&apos;ll verify your identity and help you set a new one.
            </p>
          </div>

          {/* Step progress */}
          {!done && (
            <div className="flex items-center gap-0">
              {STEPS.map((s, i) => {
                const n = (i + 1) as Step
                const active  = step === n
                const complete = step > n
                return (
                  <div key={n} className="flex items-center flex-1 last:flex-none">
                    <div className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold shrink-0 transition-all',
                      complete ? 'bg-primary text-primary-foreground'
                        : active   ? 'bg-primary/10 text-primary ring-2 ring-primary'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      {complete ? <CheckCircle2 className="w-4 h-4" /> : n}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={cn(
                        'h-0.5 flex-1 mx-1 transition-all',
                        step > n ? 'bg-primary' : 'bg-muted'
                      )} />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Step 1: Find Account ──────────────────────────────────────── */}
          {step === 1 && (
            <form onSubmit={handleLookup} className="space-y-5">
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Step 1 — Find your account
              </div>

              {/* Role toggle */}
              <div className="bg-muted rounded-xl p-1 grid grid-cols-2 gap-1">
                {(['student', 'lecturer'] as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { setRole(r); setIdNumber(''); setError('') }}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all',
                      role === r
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {r === 'student'
                      ? <GraduationCap className="w-4 h-4" />
                      : <BookOpen className="w-4 h-4" />}
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <Label>{role === 'student' ? 'Matric Number' : 'Staff Number'}</Label>
                <Input
                  placeholder={role === 'student' ? 'e.g. LASU/19/CS/001' : 'e.g. LASU/STAFF/042'}
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Enter your {role === 'student' ? 'university matric' : 'staff'} number to locate your account.
                </p>
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">{error}</p>
              )}

              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Looking up…</> : 'Find My Account'}
              </Button>
            </form>
          )}

          {/* ── Step 2: Confirm Email ─────────────────────────────────────── */}
          {step === 2 && account && (
            <form onSubmit={handleSendCode} className="space-y-5">
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Step 2 — Verify your email
              </div>

              {/* Account preview card */}
              <div className="rounded-2xl border bg-muted/30 p-5 space-y-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Account found</p>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                    {account.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-base">{maskName(account.name)}</p>
                    <p className="text-sm text-muted-foreground">{account.masked_email}</p>
                  </div>
                </div>
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  To protect your account, enter the <strong>full email address</strong> associated with this account below.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="Enter your full email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">{error}</p>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-11" onClick={() => { setStep(1); setAccount(null); setError('') }}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <Button type="submit" className="flex-1 h-11" disabled={loading}>
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> : 'Send Reset Code'}
                </Button>
              </div>
            </form>
          )}

          {/* ── Step 3: Enter Code ────────────────────────────────────────── */}
          {step === 3 && (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Step 3 — Enter reset code
              </div>

              <div className="rounded-2xl border bg-muted/30 p-5 text-center space-y-1">
                <Mail className="w-8 h-8 mx-auto text-primary mb-2" />
                <p className="text-sm font-medium">Code sent!</p>
                <p className="text-xs text-muted-foreground">
                  We sent a 6-digit code to <strong>{confirmedEmail}</strong>.
                  Check your inbox (and spam folder).
                </p>
              </div>

              <div className="space-y-2">
                <Label>6-Digit Code</Label>
                <Input
                  placeholder="e.g. 382910"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-[0.5em] font-mono h-14"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-center">Code expires in 15 minutes</p>
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">{error}</p>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-11" onClick={() => { setStep(2); setCode(''); setError('') }}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <Button type="submit" className="flex-1 h-11">
                  Verify Code
                </Button>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                Didn&apos;t receive it?{' '}
                <button
                  type="button"
                  onClick={() => { setStep(2); setError('') }}
                  className="text-primary font-medium hover:underline underline-offset-4"
                >
                  Resend code
                </button>
              </p>
            </form>
          )}

          {/* ── Step 4: New Password ──────────────────────────────────────── */}
          {step === 4 && !done && (
            <form onSubmit={handleReset} className="space-y-5">
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Step 4 — Set new password
              </div>

              <div className="space-y-2">
                <Label>New Password</Label>
                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <div className="relative">
                  <Input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Re-enter your new password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirm && password && (
                  <p className={cn('text-xs', password === confirm ? 'text-green-600' : 'text-destructive')}>
                    {password === confirm ? '✓ Passwords match' : 'Passwords do not match'}
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">{error}</p>
              )}

              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save New Password'}
              </Button>
            </form>
          )}

          {/* ── Done ─────────────────────────────────────────────────────── */}
          {done && (
            <div className="text-center space-y-6 py-4">
              <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Password updated!</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Your password has been successfully changed. You can now sign in with your new password.
                </p>
              </div>
              <Button className="w-full h-11" onClick={() => router.push('/login')}>
                Go to Sign In
              </Button>
            </div>
          )}

        </div>
      </div>

      {/* ── Right panel — image ────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <Image
          src="/signup-bg.jpg"
          alt="University campus"
          fill
          sizes="50vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-tl from-slate-900/80 to-slate-700/50" />
        <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white text-center">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-sm space-y-4">
            <ShieldCheck className="w-14 h-14 mx-auto opacity-90" />
            <h2 className="text-2xl font-bold">Account Recovery</h2>
            <p className="text-white/80 text-sm leading-relaxed">
              Your identity is verified through your student matric or staff number, followed by a one-time code sent to your registered email.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              {STEPS.map((s, i) => (
                <div key={i} className="bg-white/10 rounded-xl p-3 text-left">
                  <s.icon className="w-5 h-5 mb-1.5 opacity-80" />
                  <p className="text-xs font-medium">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
