'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'

interface AttendanceFiltersProps {
  selectedDate: string
  selectedClass: string
  onDateChange: (date: string) => void
  onClassChange: (classId: string) => void
}

const CLASSES = [
  { id: 'all', name: 'All Classes' },
  { id: 'class-a', name: 'Class A (Grade 10)' },
  { id: 'class-b', name: 'Class B (Grade 10)' },
  { id: 'class-c', name: 'Class C (Grade 11)' },
  { id: 'class-d', name: 'Class D (Grade 11)' },
]

export function AttendanceFilters({
  selectedDate,
  selectedClass,
  onDateChange,
  onClassChange,
}: AttendanceFiltersProps) {
  return (
    <Card className="p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="date" className="text-sm font-medium">
            Date
          </label>
          <Input
            id="date"
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="class" className="text-sm font-medium">
            Class
          </label>
          <Select value={selectedClass} onValueChange={onClassChange}>
            <SelectTrigger id="class">
              <SelectValue placeholder="Select a class" />
            </SelectTrigger>
            <SelectContent>
              {CLASSES.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  )
}
