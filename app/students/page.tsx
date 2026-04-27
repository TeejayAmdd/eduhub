'use client'

import { useState, useMemo } from 'react'
import { StudentProfileCard } from './_components/student-profile-card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Filter } from 'lucide-react'
import { PageContainer } from '../_components/page-container'
import { PageHeader } from '../_components/page-header'
import { SectionCard } from '../_components/section-card'

interface Student {
  id: number
  name: string
  email: string
  phone: string
  class: string
  rollNo: number
  attendance: number
  grade: string
  avatar: string
}

export default function StudentsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterClass, setFilterClass] = useState('all')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  const students: Student[] = [
    {
      id: 1,
      name: 'Aarav Sharma',
      email: 'aarav.sharma@school.com',
      phone: '+91 98765 43210',
      class: 'Class 10-A',
      rollNo: 1,
      attendance: 95,
      grade: 'A',
      avatar: 'AS',
    },
    {
      id: 2,
      name: 'Priya Patel',
      email: 'priya.patel@school.com',
      phone: '+91 98765 43211',
      class: 'Class 10-A',
      rollNo: 2,
      attendance: 92,
      grade: 'A',
      avatar: 'PP',
    },
    {
      id: 3,
      name: 'Rohan Kumar',
      email: 'rohan.kumar@school.com',
      phone: '+91 98765 43212',
      class: 'Class 10-B',
      rollNo: 1,
      attendance: 88,
      grade: 'B',
      avatar: 'RK',
    },
    {
      id: 4,
      name: 'Ananya Gupta',
      email: 'ananya.gupta@school.com',
      phone: '+91 98765 43213',
      class: 'Class 10-A',
      rollNo: 3,
      attendance: 97,
      grade: 'A',
      avatar: 'AG',
    },
    {
      id: 5,
      name: 'Vikram Singh',
      email: 'vikram.singh@school.com',
      phone: '+91 98765 43214',
      class: 'Class 10-B',
      rollNo: 2,
      attendance: 85,
      grade: 'B',
      avatar: 'VS',
    },
    {
      id: 6,
      name: 'Divya Verma',
      email: 'divya.verma@school.com',
      phone: '+91 98765 43215',
      class: 'Class 11-A',
      rollNo: 1,
      attendance: 91,
      grade: 'A',
      avatar: 'DV',
    },
    {
      id: 7,
      name: 'Arjun Das',
      email: 'arjun.das@school.com',
      phone: '+91 98765 43216',
      class: 'Class 11-B',
      rollNo: 1,
      attendance: 78,
      grade: 'C',
      avatar: 'AD',
    },
    {
      id: 8,
      name: 'Isha Reddy',
      email: 'isha.reddy@school.com',
      phone: '+91 98765 43217',
      class: 'Class 11-A',
      rollNo: 2,
      attendance: 94,
      grade: 'A',
      avatar: 'IR',
    },
  ]

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchSearch =
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.rollNo.toString().includes(searchQuery)

      const matchClass =
        filterClass === 'all' || student.class === filterClass

      return matchSearch && matchClass
    })
  }, [searchQuery, filterClass])

  const classes = ['all', ...new Set(students.map((s) => s.class))]

  const getGradeColor = (grade: string) => {
    const colors: Record<string, string> = {
      A: 'bg-green-100 text-green-800',
      B: 'bg-blue-100 text-blue-800',
      C: 'bg-yellow-100 text-yellow-800',
      D: 'bg-orange-100 text-orange-800',
      F: 'bg-red-100 text-red-800',
    }
    return colors[grade] || 'bg-gray-100 text-gray-800'
  }

  const getAttendanceColor = (attendance: number) => {
    if (attendance >= 90) return 'text-green-600'
    if (attendance >= 80) return 'text-blue-600'
    if (attendance >= 70) return 'text-amber-600'
    return 'text-red-600'
  }

  return (
    <PageContainer>
      <PageHeader
        title="Students"
        description="Manage and view student information"
      />

      <div className="space-y-6">
        {/* Filters */}
        <SectionCard title="Filters">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger>
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.slice(1).map((cls) => (
                    <SelectItem key={cls} value={cls}>
                      {cls}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SectionCard>

        {/* Students Table */}
        <SectionCard title={`Students (${filteredStudents.length})`} className="relative">
          {selectedStudent && (
            <StudentProfileCard
              student={selectedStudent}
              onClose={() => setSelectedStudent(null)}
            />
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Roll No</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
                  <TableHead className="text-right">Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>{student.rollNo}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{student.class}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {student.email}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${getAttendanceColor(student.attendance)}`}>
                      {student.attendance}%
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={getGradeColor(student.grade)}>
                        {student.grade}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  )
}
