'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  User, Lock, Bell, Info, LogOut, CheckCircle2, AlertCircle,
  Eye, EyeOff, Loader2, Shield, GraduationCap, Hash, Mail, BadgeCheck,
  Moon, Sun, Monitor, Trash2, TriangleAlert, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { users, notifications, type UserProfile, type NotificationPrefs } from '@/lib/api'
import { useMemo } from 'react'

const LEVELS = ['100L', '200L', '300L', '400L', '500L', '600L']

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        checked ? 'bg-primary' : 'bg-input'
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
        checked ? 'translate-x-5' : 'translate-x-0'
      )} />
    </button>
  )
}

function StatusBanner({ type, msg }: { type: 'success' | 'error'; msg: string }) {
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg px-4 py-3 text-sm',
      type === 'success'
        ? 'bg-green-50 border border-green-200 text-green-800'
        : 'bg-destructive/10 border border-destructive/20 text-destructive'
    )}>
      {type === 'success'
        ? <CheckCircle2 className="w-4 h-4 shrink-0" />
        : <AlertCircle className="w-4 h-4 shrink-0" />}
      {msg}
    </div>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
    </div>
  )
}

export function SettingsPage({ role }: { role: 'lecturer' | 'student' }) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  // ── Profile state ────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [level, setLevel] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileStatus, setProfileStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // ── Password state ────────────────────────────────────────────────────────────
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwStatus, setPwStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // ── Notification prefs (synced with backend, real-time) ──────────────────────
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs | null>(null)

  useEffect(() => {
    notifications.getPreferences().then(setNotifPrefs).catch(() => {})
  }, [])

  const toggleNotif = async (key: keyof NotificationPrefs) => {
    if (!notifPrefs) return
    const prev = notifPrefs
    const next = { ...notifPrefs, [key]: !notifPrefs[key] }
    setNotifPrefs(next)  // optimistic — applies immediately
    try {
      await notifications.setPreferences({ [key]: next[key] })
    } catch {
      setNotifPrefs(prev)  // revert if the save failed
    }
  }

  // ── Load profile ─────────────────────────────────────────────────────────────
  useEffect(() => {
    users.me()
      .then((me) => {
        setProfile(me)
        setName(me.name)
        setDepartment(me.department ?? '')
        setLevel(me.level ?? '')
      })
      .catch(console.error)
      .finally(() => setProfileLoading(false))
  }, [])

  const initials = name
    ? name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    : role === 'student' ? 'ST' : 'LC'

  // ── Save profile ─────────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!name.trim()) {
      setProfileStatus({ type: 'error', msg: 'Full name cannot be empty.' })
      return
    }
    setProfileSaving(true)
    setProfileStatus(null)
    try {
      const updated = await users.updateMe({
        name: name.trim(),
        // Students cannot change department — locked to signup value
        department: role === 'lecturer' ? department.trim() : undefined,
        level: role === 'student' ? level : undefined,
      })
      setProfile(updated)
      setProfileStatus({ type: 'success', msg: 'Profile updated successfully.' })
      setTimeout(() => setProfileStatus(null), 4000)
    } catch (err: unknown) {
      setProfileStatus({ type: 'error', msg: err instanceof Error ? err.message : 'Failed to save profile.' })
    } finally {
      setProfileSaving(false)
    }
  }

  // ── Change password ───────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      setPwStatus({ type: 'error', msg: 'All password fields are required.' })
      return
    }
    if (newPw.length < 6) {
      setPwStatus({ type: 'error', msg: 'New password must be at least 6 characters.' })
      return
    }
    if (newPw !== confirmPw) {
      setPwStatus({ type: 'error', msg: 'New passwords do not match.' })
      return
    }
    if (newPw === currentPw) {
      setPwStatus({ type: 'error', msg: 'New password must be different from the current one.' })
      return
    }
    setPwSaving(true)
    setPwStatus(null)
    try {
      await users.changePassword(currentPw, newPw)
      setPwStatus({ type: 'success', msg: 'Password changed successfully.' })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => setPwStatus(null), 4000)
    } catch (err: unknown) {
      setPwStatus({ type: 'error', msg: err instanceof Error ? err.message : 'Failed to change password.' })
    } finally {
      setPwSaving(false)
    }
  }

  // ── Account deletion state ────────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen]         = useState(false)
  const [deleteIdNumber, setDeleteIdNumber] = useState('')
  const [deleteTyped, setDeleteTyped]       = useState('')
  const [deleting, setDeleting]             = useState(false)
  const [deleteError, setDeleteError]       = useState('')

  const confirmPhrase = useMemo(() => {
    const words = ['delete', 'remove', 'erase', 'clear', 'wipe']
    const nouns = ['account', 'profile', 'data', 'record', 'access']
    const nums  = Math.floor(1000 + Math.random() * 9000)
    return `${words[Math.floor(Math.random() * words.length)]}-${nouns[Math.floor(Math.random() * nouns.length)]}-${nums}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteOpen])

  const handleDeleteAccount = async () => {
    if (!deleteIdNumber.trim()) { setDeleteError('Please enter your ID number.'); return }
    if (deleteTyped !== confirmPhrase) { setDeleteError('Confirmation phrase does not match.'); return }
    setDeleting(true)
    setDeleteError('')
    try {
      await users.deleteAccount(deleteIdNumber.trim())
      localStorage.clear()
      router.push('/login?deleted=1')
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Deletion failed. Please try again.')
      setDeleting(false)
    }
  }

  // ── Sign out ──────────────────────────────────────────────────────────────────
  const handleSignOut = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('userId')
    router.push('/login')
  }

  // ── Settings sections (left nav) ──────────────────────────────────────────────
  const SECTIONS = [
    { id: 'profile',       label: 'Profile',       icon: User },
    { id: 'account',       label: 'Account',       icon: Info },
    { id: 'password',      label: 'Password',      icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance',    label: 'Appearance',    icon: Moon },
    { id: 'session',       label: 'Session',       icon: LogOut },
    { id: 'danger',        label: 'Danger Zone',   icon: Trash2, danger: true },
  ] as const
  const [activeSection, setActiveSection] = useState<typeof SECTIONS[number]['id']>('profile')
  const [mobileOpen, setMobileOpen] = useState(false)   // mobile drill-down: list → section

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row gap-6">

        {/* ── Settings nav (full list on mobile, sidebar on desktop) ── */}
        <nav className={cn('md:w-56 lg:w-60 shrink-0 md:block', mobileOpen ? 'hidden' : 'block')}>
          <div className="flex flex-col gap-1 rounded-xl border overflow-hidden md:rounded-none md:border-0 md:overflow-visible">
            {SECTIONS.map((s) => {
              const Icon = s.icon
              const active = activeSection === s.id
              const isDanger = 'danger' in s && s.danger
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setActiveSection(s.id); setMobileOpen(true) }}
                  className={cn(
                    'flex items-center gap-2.5 w-full text-left text-sm font-medium transition-colors px-3.5 py-3 border-b last:border-b-0 md:px-3 md:py-2 md:border-0 md:rounded-lg',
                    active
                      ? (isDanger ? 'text-destructive md:bg-destructive/10' : 'text-foreground md:bg-muted')
                      : (isDanger ? 'text-destructive/80 md:hover:bg-destructive/5' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'),
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {s.label}
                  <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground/40 md:hidden" />
                </button>
              )
            })}
          </div>
        </nav>

        {/* ── Active section (its own page on mobile) ── */}
        <div className={cn('flex-1 min-w-0 space-y-4 md:space-y-6 md:block', mobileOpen ? 'block' : 'hidden')}>

          {/* Back to list — mobile only */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="md:hidden flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Settings
          </button>

      {activeSection === 'profile' && (
      <section>
        <SectionHeader icon={User} title="Profile" />
        <Card>
          <CardContent className="pt-6 space-y-5">
            {/* Avatar + name display */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 text-lg">
                <AvatarFallback className="text-xl font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-base">{profile?.name}</p>
                <Badge variant="outline" className="text-xs capitalize mt-1">{role}</Badge>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Editable fields */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>

              {role === 'student' ? (
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 h-10">
                    <GraduationCap className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm flex-1 truncate">{department || 'Not set'}</span>
                    <span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground bg-muted rounded px-1.5 py-0.5">Locked</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Department is set at signup and cannot be changed. Contact admin if incorrect.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Computer Science"
                  />
                  <p className="text-xs text-muted-foreground">
                    Must match students&apos; department for your courses to appear to the right students.
                  </p>
                </div>
              )}

              {role === 'student' && (
                <div className="space-y-1.5">
                  <Label>Level</Label>
                  <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your level" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Must match your current academic level for courses to show correctly.
                  </p>
                </div>
              )}
            </div>

            {profileStatus && <StatusBanner type={profileStatus.type} msg={profileStatus.msg} />}

            <Button onClick={handleSaveProfile} disabled={profileSaving} className="w-full sm:w-auto">
              {profileSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Profile
            </Button>
          </CardContent>
        </Card>
      </section>
      )}

      {activeSection === 'account' && (
      <section>
        <SectionHeader icon={Info} title="Account Information" />
        <Card>
          <CardContent className="pt-6">
            <dl className="space-y-4">
              <InfoRow icon={Mail} label="Email address" value={profile?.email ?? '—'} />
              {role === 'student' && profile?.matric_number && (
                <InfoRow icon={Hash} label="Matric number" value={profile.matric_number} />
              )}
              {role === 'lecturer' && profile?.staff_number && (
                <InfoRow icon={BadgeCheck} label="Staff number" value={profile.staff_number} />
              )}
              <InfoRow icon={GraduationCap} label="Department" value={profile?.department ?? 'Not set'} />
              {role === 'student' && (
                <InfoRow icon={Hash} label="Level" value={profile?.level ?? 'Not set'} />
              )}
              <InfoRow
                icon={Shield}
                label="Account status"
                value={profile?.is_active ? 'Active' : 'Inactive'}
                valueClass={profile?.is_active ? 'text-green-600 font-medium' : 'text-destructive font-medium'}
              />
              <InfoRow
                icon={Info}
                label="Member since"
                value={profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString('en-GB', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })
                  : '—'}
              />
            </dl>
            <p className="text-xs text-muted-foreground mt-4">
              Email, matric/staff numbers are permanent and cannot be changed. Contact admin if corrections are needed.
            </p>
          </CardContent>
        </Card>
      </section>
      )}

      {activeSection === 'password' && (
      <section>
        <SectionHeader icon={Lock} title="Change Password" />
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Current Password</Label>
              <div className="relative">
                <Input
                  type={showCurrent ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <div className="relative">
                  <Input
                    type={showNew ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Confirm New Password</Label>
                <Input
                  type="password"
                  placeholder="Repeat new password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className={cn(confirmPw && newPw && confirmPw !== newPw && 'border-destructive')}
                />
                {confirmPw && newPw && confirmPw !== newPw && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>
            </div>

            {/* Password strength */}
            {newPw && (
              <PasswordStrength password={newPw} />
            )}

            {pwStatus && <StatusBanner type={pwStatus.type} msg={pwStatus.msg} />}

            <Button onClick={handleChangePassword} disabled={pwSaving} variant="outline" className="w-full sm:w-auto">
              {pwSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
              Update Password
            </Button>
          </CardContent>
        </Card>
      </section>
      )}

      {activeSection === 'notifications' && (
      <section>
        <SectionHeader icon={Bell} title="Notification Preferences" />
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-3">
              Turn a category off and you&apos;ll stop receiving those notifications immediately.
            </p>
            {!notifPrefs ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-1">
                {/* Email master switch */}
                <div className="flex items-center justify-between py-3.5 gap-4 border-b border-border">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Email notifications</p>
                    <p className="text-xs text-muted-foreground">Emails for assignments, grades, deadlines and your weekly timetable (account & verification emails are always sent)</p>
                  </div>
                  <Toggle checked={notifPrefs.email} onChange={() => toggleNotif('email')} />
                </div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground pt-3 pb-1">In-app notifications</p>
                {(role === 'lecturer'
                  ? [
                      { key: 'messages',      label: 'New messages',          desc: 'When someone sends you a message' },
                      { key: 'submissions',   label: 'Assignment submissions', desc: 'When a student submits work — off by default (noisy in large classes)' },
                      { key: 'announcements', label: 'Announcements',         desc: 'Class and system announcements' },
                      { key: 'schedule',      label: 'Timetable updates',     desc: 'Weekly timetable and schedule changes' },
                    ] as const
                  : [
                      { key: 'messages',      label: 'New messages',          desc: 'When a lecturer sends you a message' },
                      { key: 'assignments',   label: 'Assignments',           desc: 'New assignments, quizzes and deadline changes' },
                      { key: 'grades',        label: 'Grades & results',      desc: 'When your work is graded' },
                      { key: 'announcements', label: 'Announcements',         desc: 'Class and school-wide announcements' },
                      { key: 'schedule',      label: 'Timetable updates',     desc: 'Weekly timetable and schedule changes' },
                    ] as const
                ).map((item, i, arr) => (
                  <div
                    key={item.key}
                    className={cn(
                      'flex items-center justify-between py-3.5 gap-4',
                      i < arr.length - 1 && 'border-b border-border'
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Toggle
                      checked={notifPrefs[item.key]}
                      onChange={() => toggleNotif(item.key)}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
      )}

      {activeSection === 'appearance' && (
      <section>
        <SectionHeader icon={Moon} title="Appearance" />
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium mb-1">Theme</p>
            <p className="text-xs text-muted-foreground mb-4">Choose how Cortex looks on this device.</p>
            <div className="flex gap-3">
              {([
                { value: 'light',  label: 'Light',  Icon: Sun },
                { value: 'dark',   label: 'Dark',   Icon: Moon },
                { value: 'system', label: 'System', Icon: Monitor },
              ] as const).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-2 rounded-xl border-2 py-4 text-sm font-medium transition-colors',
                    theme === value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-muted/40 text-muted-foreground hover:border-muted-foreground/40'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
      )}

      {activeSection === 'session' && (
      <section>
        <SectionHeader icon={LogOut} title="Session" />
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-destructive">Sign Out</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You will be logged out of this device. All local session data will be cleared.
            </p>
            <Button variant="destructive" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </section>
      )}

      {activeSection === 'danger' && (
      <section>
        <SectionHeader icon={Trash2} title="Danger Zone" />
        <Card className="border-destructive">
          <CardContent className="pt-6 space-y-4">

            {!deleteOpen ? (
              <>
                <div className="flex items-start gap-3">
                  <TriangleAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-destructive">Delete Account</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Permanently remove your account and all associated data from Cortex.
                      This action <strong>cannot be undone</strong>.
                    </p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => { setDeleteOpen(true); setDeleteError('') }}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete My Account
                </Button>
              </>
            ) : (
              <div className="space-y-5">
                {/* Warning banner */}
                <div className="rounded-xl bg-destructive/5 border border-destructive/30 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <TriangleAlert className="w-5 h-5 text-destructive shrink-0" />
                    <p className="text-sm font-bold text-destructive">This will permanently delete your account</p>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside pl-1">
                    <li>All your enrollments and course history</li>
                    <li>All submitted assignments and grades</li>
                    <li>All attendance records</li>
                    <li>All messages and notifications</li>
                    <li>Your login credentials — you will not be able to sign in again</li>
                  </ul>
                  <p className="text-sm font-medium text-destructive pt-1">
                    A confirmation email will be sent to your registered email address.
                  </p>
                </div>

                {/* ID number input */}
                <div className="space-y-1.5">
                  <Label>
                    Confirm your {role === 'student' ? 'Matric Number' : 'Staff Number'}
                  </Label>
                  <Input
                    placeholder={role === 'student' ? 'e.g. LASU/19/CS/001' : 'e.g. LASU/STAFF/042'}
                    value={deleteIdNumber}
                    onChange={(e) => setDeleteIdNumber(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your {role === 'student' ? 'matric' : 'staff'} number exactly as registered.
                  </p>
                </div>

                {/* Random confirmation phrase */}
                <div className="space-y-1.5">
                  <Label>Type the phrase below to confirm</Label>
                  <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2.5 mb-1">
                    <code className="text-sm font-bold font-mono tracking-wide text-destructive select-all flex-1">
                      {confirmPhrase}
                    </code>
                    <button
                      type="button"
                      onClick={() => setDeleteTyped('')}
                      className="text-muted-foreground hover:text-foreground"
                      title="Clear input"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Input
                    placeholder="Type the phrase exactly as shown above"
                    value={deleteTyped}
                    onChange={(e) => setDeleteTyped(e.target.value)}
                    className={cn(
                      deleteTyped && deleteTyped !== confirmPhrase && 'border-destructive',
                      deleteTyped === confirmPhrase && 'border-green-500'
                    )}
                  />
                  {deleteTyped && deleteTyped !== confirmPhrase && (
                    <p className="text-xs text-destructive">Phrase does not match — check capitalisation and hyphens</p>
                  )}
                  {deleteTyped === confirmPhrase && (
                    <p className="text-xs text-green-600">✓ Phrase matches</p>
                  )}
                </div>

                {deleteError && (
                  <StatusBanner type="error" msg={deleteError} />
                )}

                <div className="flex gap-3 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setDeleteOpen(false); setDeleteIdNumber(''); setDeleteTyped(''); setDeleteError('') }}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="flex-1"
                    onClick={handleDeleteAccount}
                    disabled={deleting || deleteTyped !== confirmPhrase || !deleteIdNumber.trim()}
                  >
                    {deleting
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting…</>
                      : <><Trash2 className="w-4 h-4 mr-2" />Permanently Delete</>
                    }
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
      )}

        </div>
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon, label, value, valueClass,
}: {
  icon: React.ElementType
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('text-sm font-medium truncate', valueClass)}>{value}</p>
      </div>
    </div>
  )
}

function PasswordStrength({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length

  const label = ['Too short', 'Weak', 'Fair', 'Strong', 'Very strong'][score]
  const color  = ['bg-destructive', 'bg-orange-400', 'bg-amber-400', 'bg-green-500', 'bg-green-600'][score]

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn('h-1.5 flex-1 rounded-full transition-colors', i < score ? color : 'bg-muted')}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Strength: <span className="font-medium">{label}</span></p>
    </div>
  )
}

