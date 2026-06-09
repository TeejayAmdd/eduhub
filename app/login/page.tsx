'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { GraduationCap, BookOpen, Loader2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { auth, decodeToken } from '@/lib/api'

type Role = 'student' | 'lecturer'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [role, setRole] = useState<Role>('student')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [wrongRole, setWrongRole] = useState<'student' | 'lecturer' | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    if (searchParams.get('registered') === '1') {
      setSuccessMsg('Account created! Sign in below.')
    }
    if (searchParams.get('deleted') === '1') {
      setSuccessMsg('Your account has been permanently deleted. Sorry to see you go.')
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim()) { setError('Please enter your identifier'); return }
    setLoading(true)
    setError('')
    setWrongRole(null)
    setSuccessMsg('')

    try {
      const data = await auth.login(identifier.trim(), password)
      const decoded = decodeToken(data.access_token)
      const actualRole = decoded?.role

      // Role mismatch — wrong login tab
      if (actualRole && actualRole !== role) {
        setWrongRole(actualRole as 'student' | 'lecturer')
        return
      }

      const userId = decoded?.sub ?? ''
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('role', actualRole ?? role)
      localStorage.setItem('userId', userId)

      // Show onboarding only if the account was just created in this browser
      // (flag set during email verification, expires after 1 hour)
      const isNewAccount = localStorage.getItem('cortex_new_account') === '1'
      localStorage.removeItem('cortex_new_account')

      if (isNewAccount) {
        router.push('/onboarding')
      } else {
        router.push(actualRole === 'student' ? '/student/overview' : '/overview')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex relative">
      {/* Mobile background image */}
      <div className="absolute inset-0 lg:hidden overflow-hidden">
        <Image
          src="/login-bg.jpg"
          alt=""
          fill
          sizes="(max-width: 1023px) 100vw, 0px"
          className="object-cover blur-md scale-110"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/60 to-primary/40" />
      </div>

      {/* Left panel — form */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-6 py-10 sm:py-12 lg:px-16 lg:bg-background">
        <div className="w-full max-w-md mx-auto">
          <div className="rounded-2xl bg-background/95 backdrop-blur-sm p-7 sm:p-9 space-y-7 shadow-2xl lg:rounded-none lg:bg-transparent lg:backdrop-blur-none lg:p-0 lg:shadow-none">

          {/* Logo */}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Sign in to Cortex</h1>
            <p className="text-sm text-muted-foreground">Lagos State University Learning Portal</p>
          </div>

          {/* Role toggle */}
          <div className="bg-muted rounded-xl p-1 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => { setRole('student'); setIdentifier(''); setError(''); setWrongRole(null) }}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium transition-all duration-200',
                role === 'student'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <GraduationCap className="w-4 h-4" />
              Student
            </button>
            <button
              type="button"
              onClick={() => { setRole('lecturer'); setIdentifier(''); setError(''); setWrongRole(null) }}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium transition-all duration-200',
                role === 'lecturer'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <BookOpen className="w-4 h-4" />
              Lecturer
            </button>
          </div>

          {/* Success message */}
          {successMsg && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              {successMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="identifier">
                {role === 'student' ? 'Matric Number or Email' : 'Staff Number or Email'}
              </Label>
              <Input
                id="identifier"
                className="h-11"
                placeholder={role === 'student' ? 'e.g. LASU/19/CS/001 or email' : 'e.g. LASU/STAFF/042 or email'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {wrongRole && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 space-y-1.5">
                <p className="text-sm font-semibold text-amber-800">Wrong login tab</p>
                <p className="text-sm text-amber-700">
                  {wrongRole === 'lecturer'
                    ? 'This is a Lecturer account. Switch to the Lecturer tab to sign in.'
                    : 'This is a Student account. Switch to the Student tab to sign in.'
                  }
                </p>
                <button
                  type="button"
                  className="text-sm font-medium text-amber-900 underline underline-offset-2 hover:opacity-80"
                  onClick={() => { setRole(wrongRole); setWrongRole(null); setIdentifier('') }}
                >
                  Switch to {wrongRole === 'lecturer' ? 'Lecturer' : 'Student'} tab →
                </button>
              </div>
            )}

            {error && !wrongRole && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full h-11 text-base font-semibold mt-1" disabled={loading}>
              {loading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</>
                : 'Sign In'
              }
            </Button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">New here?</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Link
            href="/signup"
            className="flex items-center justify-center w-full h-10 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Create an account
          </Link>
          </div>
        </div>
      </div>

      {/* Right panel — background image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <Image
          src="/login-bg.jpg"
          alt="University students"
          fill
          sizes="50vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-tl from-primary/70 to-primary/30" />
        <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white text-center">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-sm">
            {role === 'student'
              ? <GraduationCap className="w-12 h-12 mx-auto mb-4" />
              : <BookOpen className="w-12 h-12 mx-auto mb-4" />}
            <h2 className="text-2xl font-bold mb-2">Welcome Back</h2>
            <p className="text-white/85 text-sm leading-relaxed">
              {role === 'student'
                ? 'Access your courses, assignments, and grades all in one place.'
                : 'Manage your classes, track attendance, and engage with your students.'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

