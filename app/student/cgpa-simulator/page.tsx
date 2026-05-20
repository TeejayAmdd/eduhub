'use client'

import { useState, useId } from 'react'
import { Plus, Trash2, Calculator, BookOpen, TrendingUp, Info, GraduationCap } from 'lucide-react'
import { PageContainer } from '@/app/_components/page-container'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// Nigerian university grading scale (5-point system)
const GRADES = [
  { label: 'A', points: 5, range: '70 – 100' },
  { label: 'B', points: 4, range: '60 – 69' },
  { label: 'C', points: 3, range: '50 – 59' },
  { label: 'D', points: 2, range: '45 – 49' },
  { label: 'E', points: 1, range: '40 – 44' },
  { label: 'F', points: 0, range: '0 – 39' },
]

interface Course {
  id: string
  code: string
  title: string
  units: string
  grade: string
}

function getClassification(cgpa: number) {
  if (cgpa >= 4.5) return { label: 'First Class', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' }
  if (cgpa >= 3.5) return { label: 'Second Class Upper', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' }
  if (cgpa >= 2.4) return { label: 'Second Class Lower', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' }
  if (cgpa >= 1.5) return { label: 'Third Class', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' }
  if (cgpa >= 1.0) return { label: 'Pass', color: 'text-orange-500', bg: 'bg-orange-50 border-orange-200' }
  return { label: 'Fail', color: 'text-red-600', bg: 'bg-red-50 border-red-200' }
}

function calcGPA(courses: Course[]) {
  let totalPoints = 0
  let totalUnits = 0
  for (const c of courses) {
    const units = parseFloat(c.units)
    const grade = GRADES.find(g => g.label === c.grade)
    if (!c.grade || !grade || isNaN(units) || units <= 0) continue
    totalPoints += grade.points * units
    totalUnits += units
  }
  if (totalUnits === 0) return { gpa: null, totalUnits: 0 }
  return { gpa: totalPoints / totalUnits, totalUnits }
}

export default function CGPASimulatorPage() {
  const uid = useId()

  const [courses, setCourses] = useState<Course[]>([
    { id: `${uid}-1`, code: '', title: '', units: '', grade: '' },
  ])

  const [prevCGPA, setPrevCGPA] = useState('')
  const [prevUnits, setPrevUnits] = useState('')
  const [showScale, setShowScale] = useState(false)

  const addCourse = () =>
    setCourses(prev => [...prev, { id: `${uid}-${Date.now()}`, code: '', title: '', units: '', grade: '' }])

  const removeCourse = (id: string) =>
    setCourses(prev => prev.length > 1 ? prev.filter(c => c.id !== id) : prev)

  const updateCourse = (id: string, field: keyof Course, value: string) =>
    setCourses(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))

  const { gpa: semesterGPA, totalUnits: semUnits } = calcGPA(courses)

  const prevCGPANum = parseFloat(prevCGPA)
  const prevUnitsNum = parseFloat(prevUnits)
  const hasPrev = !isNaN(prevCGPANum) && prevCGPANum >= 0 && prevCGPANum <= 5
    && !isNaN(prevUnitsNum) && prevUnitsNum > 0

  let cgpa: number | null = null
  let totalUnitsEarned = 0
  if (semesterGPA !== null && hasPrev) {
    totalUnitsEarned = prevUnitsNum + semUnits
    cgpa = (prevCGPANum * prevUnitsNum + semesterGPA * semUnits) / totalUnitsEarned
  } else if (semesterGPA !== null && !hasPrev) {
    cgpa = semesterGPA
    totalUnitsEarned = semUnits
  }

  const classification = cgpa !== null ? getClassification(cgpa) : null

  const filledCourses = courses.filter(c => c.grade && parseFloat(c.units) > 0)

  return (
    <PageContainer>
      <div className="max-w-3xl space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="w-6 h-6 text-primary" />
              CGPA Simulator
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Calculate your semester GPA and cumulative CGPA using the 5-point grading scale.
            </p>
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => setShowScale(s => !s)}
            className="gap-1.5 shrink-0"
          >
            <Info className="w-3.5 h-3.5" />
            Grade Scale
          </Button>
        </div>

        {/* Grading scale reference */}
        {showScale && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">
                Nigerian University 5-Point Grading Scale
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {GRADES.map(g => (
                  <div key={g.label} className="rounded-lg border bg-background p-2 text-center">
                    <p className="text-lg font-bold text-primary">{g.label}</p>
                    <p className="text-xs font-semibold">{g.points}.0 pts</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{g.range}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs text-muted-foreground">
                {[
                  { range: '4.50 – 5.00', cls: 'First Class' },
                  { range: '3.50 – 4.49', cls: '2nd Class Upper' },
                  { range: '2.40 – 3.49', cls: '2nd Class Lower' },
                  { range: '1.50 – 2.39', cls: 'Third Class' },
                  { range: '1.00 – 1.49', cls: 'Pass' },
                  { range: 'Below 1.00', cls: 'Fail' },
                ].map(r => (
                  <div key={r.cls} className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground">{r.range}</span>
                    <span>→ {r.cls}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Semester courses */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                This Semester&apos;s Courses
              </CardTitle>
              <Button size="sm" onClick={addCourse} className="gap-1.5">
                <Plus className="w-4 h-4" /> Add Course
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">

            {/* Column labels */}
            <div className="hidden sm:grid grid-cols-12 gap-2 px-1">
              <p className="col-span-2 text-xs text-muted-foreground font-medium">Code</p>
              <p className="col-span-4 text-xs text-muted-foreground font-medium">Course Title</p>
              <p className="col-span-2 text-xs text-muted-foreground font-medium">Units</p>
              <p className="col-span-3 text-xs text-muted-foreground font-medium">Grade</p>
              <p className="col-span-1"></p>
            </div>

            {courses.map((course, idx) => (
              <div key={course.id} className="grid grid-cols-12 gap-2 items-center">
                {/* Course code */}
                <div className="col-span-12 sm:col-span-2">
                  <Input
                    placeholder="e.g. CSC301"
                    value={course.code}
                    onChange={e => updateCourse(course.id, 'code', e.target.value.toUpperCase())}
                    className="text-xs h-9"
                  />
                </div>

                {/* Title */}
                <div className="col-span-12 sm:col-span-4">
                  <Input
                    placeholder="Course title"
                    value={course.title}
                    onChange={e => updateCourse(course.id, 'title', e.target.value)}
                    className="text-xs h-9"
                  />
                </div>

                {/* Units */}
                <div className="col-span-5 sm:col-span-2">
                  <Input
                    type="number"
                    placeholder="Units"
                    min={1} max={6}
                    value={course.units}
                    onChange={e => updateCourse(course.id, 'units', e.target.value)}
                    className="text-xs h-9"
                  />
                </div>

                {/* Grade selector */}
                <div className="col-span-6 sm:col-span-3">
                  <div className="flex gap-1">
                    {GRADES.map(g => (
                      <button
                        key={g.label}
                        type="button"
                        onClick={() => updateCourse(course.id, 'grade', g.label)}
                        className={cn(
                          'flex-1 h-9 rounded-md text-xs font-bold border-2 transition-all',
                          course.grade === g.label
                            ? g.label === 'F'
                              ? 'border-red-500 bg-red-50 text-red-600'
                              : 'border-primary bg-primary text-primary-foreground'
                            : 'border-input text-muted-foreground hover:border-primary/50'
                        )}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Delete */}
                <div className="col-span-1 flex justify-end">
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => removeCourse(course.id)}
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    disabled={courses.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Semester GPA result */}
            <div className={cn(
              'mt-4 rounded-xl border-2 p-4 transition-all',
              semesterGPA !== null
                ? 'border-primary/30 bg-primary/5'
                : 'border-dashed border-muted-foreground/20 bg-muted/30'
            )}>
              {semesterGPA !== null ? (
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Semester GPA</p>
                    <p className="text-3xl font-black text-primary mt-0.5">{semesterGPA.toFixed(2)}<span className="text-base font-medium text-muted-foreground"> / 5.00</span></p>
                    <p className="text-xs text-muted-foreground mt-1">{filledCourses.length} course{filledCourses.length !== 1 ? 's' : ''} · {semUnits} unit{semUnits !== 1 ? 's' : ''}</p>
                  </div>
                  <div className={cn('rounded-xl border px-4 py-2 text-sm font-bold', getClassification(semesterGPA).bg, getClassification(semesterGPA).color)}>
                    {getClassification(semesterGPA).label}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Fill in at least one course with units and grade to see your GPA.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Previous CGPA */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Previous Academic Record
              <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your CGPA from previous semesters to calculate your updated cumulative GPA.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prev-cgpa">Previous CGPA <span className="text-muted-foreground font-normal">(out of 5.0)</span></Label>
                <Input
                  id="prev-cgpa"
                  type="number"
                  placeholder="e.g. 3.75"
                  min={0} max={5} step={0.01}
                  value={prevCGPA}
                  onChange={e => setPrevCGPA(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prev-units">Total Units Earned Previously</Label>
                <Input
                  id="prev-units"
                  type="number"
                  placeholder="e.g. 90"
                  min={1}
                  value={prevUnits}
                  onChange={e => setPrevUnits(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Final CGPA result */}
        {cgpa !== null && (
          <Card className={cn('border-2 overflow-hidden', classification!.bg)}>
            <div className={cn(
              'px-6 py-8 text-center',
              cgpa >= 4.5 ? 'bg-gradient-to-br from-emerald-500 to-green-600'
              : cgpa >= 3.5 ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
              : cgpa >= 2.4 ? 'bg-gradient-to-br from-violet-500 to-purple-600'
              : cgpa >= 1.5 ? 'bg-gradient-to-br from-amber-500 to-orange-500'
              : cgpa >= 1.0 ? 'bg-gradient-to-br from-orange-500 to-red-500'
              : 'bg-gradient-to-br from-red-500 to-rose-600'
            )}>
              <GraduationCap className="w-12 h-12 mx-auto mb-3 text-white/80" />
              <p className="text-white/70 text-sm font-medium uppercase tracking-widest mb-1">
                {hasPrev ? 'Cumulative CGPA' : 'Semester GPA'}
              </p>
              <p className="text-6xl font-black text-white">{cgpa.toFixed(2)}</p>
              <p className="text-white/70 text-base mt-1">out of 5.00</p>
              <div className="mt-4 inline-block bg-white/20 rounded-full px-5 py-1.5">
                <p className="text-white font-bold text-sm">{classification!.label}</p>
              </div>
            </div>

            <CardContent className="pt-5 pb-5">
              <div className={cn('grid gap-3', hasPrev ? 'grid-cols-3' : 'grid-cols-2')}>
                <div className="text-center rounded-lg bg-background/80 p-3">
                  <p className="text-xs text-muted-foreground">Semester GPA</p>
                  <p className="text-xl font-bold text-primary mt-0.5">{semesterGPA!.toFixed(2)}</p>
                </div>
                {hasPrev && (
                  <div className="text-center rounded-lg bg-background/80 p-3">
                    <p className="text-xs text-muted-foreground">Previous CGPA</p>
                    <p className="text-xl font-bold mt-0.5">{prevCGPANum.toFixed(2)}</p>
                  </div>
                )}
                <div className="text-center rounded-lg bg-background/80 p-3">
                  <p className="text-xs text-muted-foreground">Total Units</p>
                  <p className="text-xl font-bold mt-0.5">{totalUnitsEarned}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>0.00</span>
                  <span className="font-medium text-foreground">{cgpa.toFixed(2)} / 5.00</span>
                  <span>5.00</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      cgpa >= 4.5 ? 'bg-emerald-500'
                      : cgpa >= 3.5 ? 'bg-blue-500'
                      : cgpa >= 2.4 ? 'bg-violet-500'
                      : cgpa >= 1.5 ? 'bg-amber-500'
                      : 'bg-red-500'
                    )}
                    style={{ width: `${(cgpa / 5) * 100}%` }}
                  />
                </div>
              </div>

              {/* Classification thresholds hint */}
              <div className="mt-4 rounded-lg bg-muted/50 px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">To reach the next class:</p>
                {cgpa < 4.5 && (
                  <p className="text-xs text-foreground">
                    {cgpa >= 3.5
                      ? `You need a CGPA of 4.50 for First Class — you're ${(4.5 - cgpa).toFixed(2)} points away.`
                      : cgpa >= 2.4
                      ? `You need a CGPA of 3.50 for 2nd Class Upper — you're ${(3.5 - cgpa).toFixed(2)} points away.`
                      : cgpa >= 1.5
                      ? `You need a CGPA of 2.40 for 2nd Class Lower — you're ${(2.4 - cgpa).toFixed(2)} points away.`
                      : `You need a CGPA of 1.50 for Third Class — you're ${(1.5 - cgpa).toFixed(2)} points away.`
                    }
                  </p>
                )}
                {cgpa >= 4.5 && (
                  <p className="text-xs text-emerald-600 font-medium">You have achieved the highest class. Excellent work!</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reset button */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setCourses([{ id: `${uid}-reset-${Date.now()}`, code: '', title: '', units: '', grade: '' }])
              setPrevCGPA('')
              setPrevUnits('')
            }}
          >
            Reset All
          </Button>
        </div>

      </div>
    </PageContainer>
  )
}
