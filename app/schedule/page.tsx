'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageContainer } from '../_components/page-container'
import { PageHeader } from '../_components/page-header'
import { SectionCard } from '../_components/section-card'

interface TimeSlot {
  day: string
  time: string
  class: string
  subject: string
  room: string
  color: string
}

export default function SchedulePage() {
  const timeSlots: TimeSlot[] = [
    {
      day: 'Monday',
      time: '09:00-10:00',
      class: 'Class 10-A',
      subject: 'Mathematics',
      room: 'Room 101',
      color: 'bg-blue-50 border-l-4 border-blue-500',
    },
    {
      day: 'Monday',
      time: '10:15-11:15',
      class: 'Class 10-B',
      subject: 'English',
      room: 'Room 102',
      color: 'bg-purple-50 border-l-4 border-purple-500',
    },
    {
      day: 'Monday',
      time: '11:30-12:30',
      class: 'Class 11-A',
      subject: 'Science',
      room: 'Lab 1',
      color: 'bg-green-50 border-l-4 border-green-500',
    },
    {
      day: 'Monday',
      time: '14:00-15:00',
      class: 'Class 12-A',
      subject: 'Physics',
      room: 'Room 103',
      color: 'bg-cyan-50 border-l-4 border-cyan-500',
    },
    {
      day: 'Tuesday',
      time: '09:00-10:00',
      class: 'Class 10-B',
      subject: 'Mathematics',
      room: 'Room 101',
      color: 'bg-blue-50 border-l-4 border-blue-500',
    },
    {
      day: 'Tuesday',
      time: '10:15-11:15',
      class: 'Class 11-B',
      subject: 'History',
      room: 'Room 104',
      color: 'bg-amber-50 border-l-4 border-amber-500',
    },
    {
      day: 'Tuesday',
      time: '11:30-12:30',
      class: 'Class 12-B',
      subject: 'Chemistry',
      room: 'Lab 2',
      color: 'bg-pink-50 border-l-4 border-pink-500',
    },
    {
      day: 'Tuesday',
      time: '14:00-15:00',
      class: 'Class 10-A',
      subject: 'English',
      room: 'Room 102',
      color: 'bg-purple-50 border-l-4 border-purple-500',
    },
    {
      day: 'Wednesday',
      time: '09:00-10:00',
      class: 'Class 11-A',
      subject: 'Mathematics',
      room: 'Room 101',
      color: 'bg-blue-50 border-l-4 border-blue-500',
    },
    {
      day: 'Wednesday',
      time: '10:15-11:15',
      class: 'Class 12-A',
      subject: 'Biology',
      room: 'Lab 3',
      color: 'bg-emerald-50 border-l-4 border-emerald-500',
    },
    {
      day: 'Wednesday',
      time: '11:30-12:30',
      class: 'Class 10-B',
      subject: 'Science',
      room: 'Lab 1',
      color: 'bg-green-50 border-l-4 border-green-500',
    },
    {
      day: 'Wednesday',
      time: '14:00-15:00',
      class: 'Class 11-B',
      subject: 'Geography',
      room: 'Room 105',
      color: 'bg-teal-50 border-l-4 border-teal-500',
    },
    {
      day: 'Thursday',
      time: '09:00-10:00',
      class: 'Class 12-B',
      subject: 'Mathematics',
      room: 'Room 101',
      color: 'bg-blue-50 border-l-4 border-blue-500',
    },
    {
      day: 'Thursday',
      time: '10:15-11:15',
      class: 'Class 10-A',
      subject: 'Science',
      room: 'Lab 1',
      color: 'bg-green-50 border-l-4 border-green-500',
    },
    {
      day: 'Thursday',
      time: '11:30-12:30',
      class: 'Class 11-A',
      subject: 'English',
      room: 'Room 102',
      color: 'bg-purple-50 border-l-4 border-purple-500',
    },
    {
      day: 'Friday',
      time: '09:00-10:00',
      class: 'Class 10-B',
      subject: 'History',
      room: 'Room 104',
      color: 'bg-amber-50 border-l-4 border-amber-500',
    },
    {
      day: 'Friday',
      time: '10:15-11:15',
      class: 'Class 11-B',
      subject: 'Mathematics',
      room: 'Room 101',
      color: 'bg-blue-50 border-l-4 border-blue-500',
    },
    {
      day: 'Friday',
      time: '11:30-12:30',
      class: 'Class 12-A',
      subject: 'Physics',
      room: 'Room 103',
      color: 'bg-cyan-50 border-l-4 border-cyan-500',
    },
  ]

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  const times = ['09:00-10:00', '10:15-11:15', '11:30-12:30', '14:00-15:00']

  const getSlotForDayTime = (day: string, time: string) => {
    return timeSlots.find((slot) => slot.day === day && slot.time === time)
  }

  return (
    <PageContainer>
      <PageHeader
        title="Schedule"
        description="Weekly timetable and class schedule"
      />

      <div className="space-y-6">
        {/* Weekly Timetable Grid */}
        <SectionCard title="Weekly Timetable">
          <div className="overflow-x-auto">
            <div className="min-w-full">
              {/* Header */}
              <div className="grid grid-cols-6 gap-2 mb-4">
                <div className="font-semibold text-sm p-3 bg-muted rounded">
                  Time
                </div>
                {days.map((day) => (
                  <div
                    key={day}
                    className="font-semibold text-sm p-3 bg-muted rounded text-center"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Time Slots */}
              {times.map((time) => (
                <div key={time} className="grid grid-cols-6 gap-2 mb-2">
                  <div className="text-xs font-medium p-3 flex items-center">
                    {time}
                  </div>
                  {days.map((day) => {
                    const slot = getSlotForDayTime(day, time)
                    return (
                      <div key={`${day}-${time}`} className="min-h-24">
                        {slot ? (
                          <Card className={`h-full p-3 ${slot.color}`}>
                            <h4 className="font-semibold text-sm">
                              {slot.subject}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {slot.class}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {slot.room}
                            </p>
                          </Card>
                        ) : (
                          <div className="border-2 border-dashed border-border rounded h-full" />
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* Today's Schedule */}
        <SectionCard title="Today's Classes">
          <div className="space-y-2">
            {['Monday', 'Tuesday', 'Wednesday'].map((day) => {
              const todayClasses = timeSlots.filter(
                (slot) => slot.day === day
              )
              return (
                <div key={day}>
                  <p className="text-sm font-medium mb-2">{day}</p>
                  <div className="space-y-2 ml-4">
                    {todayClasses.map((slot) => (
                      <Card
                        key={`${slot.day}-${slot.time}`}
                        className="p-3 flex items-start justify-between"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {slot.time} - {slot.subject}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {slot.class} | {slot.room}
                          </p>
                        </div>
                        <Badge variant="outline">{slot.class}</Badge>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  )
}
