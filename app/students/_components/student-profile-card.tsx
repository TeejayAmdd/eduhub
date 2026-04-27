'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X, Mail, Phone } from 'lucide-react'

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

interface StudentProfileCardProps {
  student: Student
  onClose: () => void
}

export function StudentProfileCard({
  student,
  onClose,
}: StudentProfileCardProps) {
  return (
    <Card className="absolute right-0 top-0 w-80 shadow-lg z-50">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <h3 className="font-semibold">Student Profile</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Avatar and Name */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {student.name.charAt(0)}
          </div>
          <div>
            <h2 className="font-semibold">{student.name}</h2>
            <p className="text-sm text-muted-foreground">Roll No: {student.rollNo}</p>
            <Badge variant="outline" className="mt-1">
              {student.class}
            </Badge>
          </div>
        </div>

        {/* Contact Information */}
        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span className="truncate">{student.email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <span>{student.phone}</span>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Attendance</span>
            <span className="font-semibold">{student.attendance}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full"
              style={{ width: `${student.attendance}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-muted-foreground">Grade</span>
            <Badge>{student.grade}</Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-border pt-4 flex gap-2">
          <Button size="sm" className="flex-1" variant="outline">
            Message
          </Button>
          <Button size="sm" className="flex-1">
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
