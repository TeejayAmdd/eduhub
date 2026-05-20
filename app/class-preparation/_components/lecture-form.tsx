'use client'

import { useState, useEffect } from 'react'
import { Plus, Loader2, Calendar, Trash2, ChevronRight, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { classes, schedule, users, type Class, type ScheduleSlotInput } from '@/lib/api'

const LEVELS = ['100L', '200L', '300L', '400L', '500L', '600L']
const UNITS  = ['1', '2', '3', '4', '5', '6']
const DAYS   = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Props {
  onCreated: (c: Class) => void
}

interface SlotDraft {
  day_of_week: string
  start_time: string
  end_time: string
  room: string
}

function emptySlot(): SlotDraft {
  return { day_of_week: 'Monday', start_time: '09:00', end_time: '11:00', room: '' }
}

function fmtSlot(s: SlotDraft) {
  return `${s.day_of_week} ${s.start_time}–${s.end_time}${s.room ? ` · ${s.room}` : ''}`
}

export function CreateClassDialog({ onCreated }: Props) {
  const [open, setOpen]     = useState(false)
  const [step, setStep]     = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  // Step 1 — basic info
  const [courseTitle, setCourseTitle] = useState('')
  const [unit, setUnit]               = useState('')
  const [courseCode, setCourseCode]   = useState('')
  const [department, setDepartment]   = useState('')
  const [level, setLevel]             = useState('')
  const [academicYear, setAcademicYear] = useState(() => {
    const y = new Date().getFullYear()
    return `${y}/${y + 1}`
  })

  // Step 2 — schedule slots
  const [slots, setSlots] = useState<SlotDraft[]>([emptySlot()])
  const [createdClass, setCreatedClass] = useState<Class | null>(null)

  useEffect(() => {
    if (!open) return
    users.me().then((me) => {
      if (me.department) setDepartment(me.department)
    }).catch(() => {})
  }, [open])

  function reset() {
    setCourseTitle(''); setUnit(''); setCourseCode('')
    setLevel(''); setError(''); setStep(1); setCreatedClass(null)
    setSlots([emptySlot()])
    const y = new Date().getFullYear()
    setAcademicYear(`${y}/${y + 1}`)
  }

  // ── Step 1: create the class ──────────────────────────────────────────────
  async function handleCreateClass() {
    if (!courseTitle.trim() || !unit || !level || !academicYear.trim()) {
      setError('Course title, unit, level, and academic year are required.')
      return
    }
    setLoading(true); setError('')
    try {
      const cls = await classes.create({
        name: courseTitle.trim(),
        subject: unit,
        course_code: courseCode.trim() || undefined,
        department: department.trim() || undefined,
        level,
        academic_year: academicYear.trim(),
      })
      setCreatedClass(cls)
      setStep(2)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create course')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: save schedule slots (optional) ────────────────────────────────
  async function handleSaveSchedule() {
    if (!createdClass) return
    const validSlots = slots.filter((s) => s.start_time && s.end_time && s.start_time < s.end_time)
    setLoading(true); setError('')
    try {
      if (validSlots.length > 0) {
        const input: ScheduleSlotInput[] = validSlots.map((s) => ({
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          room: s.room || undefined,
        }))
        await schedule.bulkCreate(createdClass.id, input)
      }
      onCreated(createdClass)
      reset()
      setOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule')
    } finally {
      setLoading(false)
    }
  }

  function handleSkipSchedule() {
    if (!createdClass) return
    onCreated(createdClass)
    reset()
    setOpen(false)
  }

  function addSlot() { setSlots((prev) => [...prev, emptySlot()]) }
  function removeSlot(i: number) { setSlots((prev) => prev.filter((_, idx) => idx !== i)) }
  function updateSlot(i: number, field: keyof SlotDraft, val: string) {
    setSlots((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s))
  }

  const hasValidSlots = slots.some((s) => s.start_time && s.end_time && s.start_time < s.end_time)

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Course
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={step === 1 ? 'default' : 'secondary'} className="text-xs">1 Course Info</Badge>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <Badge variant={step === 2 ? 'default' : 'secondary'} className="text-xs">2 Set Schedule</Badge>
          </div>
          <DialogTitle>
            {step === 1 ? 'Create New Course' : 'Set Class Schedule'}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Students in the same department and level will see this course and can enroll.'
              : `Add weekly time slots for ${createdClass?.name ?? 'this course'}. You can skip and add later.`}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Course Title <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Introduction to Data Structures"
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Unit <span className="text-destructive">*</span></Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger><SelectValue placeholder="Credit units" /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>{u} Unit{u !== '1' ? 's' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Course Code</Label>
                <Input placeholder="e.g. CSC301" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input placeholder="Your department" value={department} onChange={(e) => setDepartment(e.target.value)} />
                <p className="text-xs text-muted-foreground">Auto-filled from your profile</p>
              </div>
              <div className="space-y-1.5">
                <Label>Level <span className="text-destructive">*</span></Label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Academic Year <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. 2024/2025" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
            </div>

            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {slots.map((slot, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-border p-3 relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Slot {i + 1}</span>
                  {slots.length > 1 && (
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeSlot(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Day</Label>
                    <Select value={slot.day_of_week} onValueChange={(v) => updateSlot(i, 'day_of_week', v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Room <span className="text-muted-foreground">(optional)</span></Label>
                    <Input className="h-8 text-sm" placeholder="e.g. LT4" value={slot.room} onChange={(e) => updateSlot(i, 'room', e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Start Time</Label>
                    <Input type="time" className="h-8 text-sm" value={slot.start_time} onChange={(e) => updateSlot(i, 'start_time', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End Time</Label>
                    <Input type="time" className="h-8 text-sm" value={slot.end_time} onChange={(e) => updateSlot(i, 'end_time', e.target.value)} />
                  </div>
                </div>

                {slot.start_time && slot.end_time && slot.start_time >= slot.end_time && (
                  <p className="text-xs text-destructive">End time must be after start time</p>
                )}
              </div>
            ))}

            <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={addSlot}>
              <Plus className="h-3.5 w-3.5" /> Add Another Slot
            </Button>

            {hasValidSlots && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Schedule preview:</p>
                <div className="space-y-0.5">
                  {slots.filter((s) => s.start_time && s.end_time && s.start_time < s.end_time).map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 text-primary shrink-0" />
                      <span className="text-xs">{fmtSlot(s)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 1 && (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateClass} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Next: Set Schedule
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="mr-auto">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button variant="outline" onClick={handleSkipSchedule} disabled={loading}>
                Skip for Now
              </Button>
              <Button onClick={handleSaveSchedule} disabled={loading || !hasValidSlots}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Calendar className="w-4 h-4 mr-2" />}
                Save Schedule & Create
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
