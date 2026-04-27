'use client'

import { Card } from '@/components/ui/card'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { PageContainer } from '../_components/page-container'
import { SectionCard } from '../_components/section-card'

// Mock data for attendance trends
const attendanceTrends = [
  { week: 'Week 1', attendance: 92, target: 95 },
  { week: 'Week 2', attendance: 88, target: 95 },
  { week: 'Week 3', attendance: 94, target: 95 },
  { week: 'Week 4', attendance: 91, target: 95 },
  { week: 'Week 5', attendance: 96, target: 95 },
  { week: 'Week 6', attendance: 93, target: 95 },
]

// Mock data for performance metrics by subject
const performanceMetrics = [
  { subject: 'Mathematics', avgScore: 82, passRate: 88 },
  { subject: 'English', avgScore: 78, passRate: 85 },
  { subject: 'Science', avgScore: 85, passRate: 92 },
  { subject: 'History', avgScore: 80, passRate: 87 },
  { subject: 'Geography', avgScore: 76, passRate: 83 },
]

// Mock data for class distribution
const classDistribution = [
  { name: 'Class 10A', value: 35, color: '#3b82f6' },
  { name: 'Class 10B', value: 32, color: '#8b5cf6' },
  { name: 'Class 10C', value: 28, color: '#ec4899' },
  { name: 'Class 10D', value: 30, color: '#f59e0b' },
]

// Mock data for student engagement
const engagementData = [
  { day: 'Mon', active: 85, inactive: 25 },
  { day: 'Tue', active: 88, inactive: 22 },
  { day: 'Wed', active: 92, inactive: 18 },
  { day: 'Thu', active: 78, inactive: 32 },
  { day: 'Fri', active: 95, inactive: 15 },
  { day: 'Sat', active: 45, inactive: 65 },
  { day: 'Sun', active: 32, inactive: 78 },
]

export default function AnalyticsPage() {
  return (
    <PageContainer
      title="Analytics"
      description="View detailed analytics and performance metrics."
    >
      <div className="space-y-8">
        {/* Attendance Trends */}
        <SectionCard title="Attendance Trends" subtitle="Last 6 weeks">
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="attendance"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6' }}
                  name="Actual Attendance"
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#10b981' }}
                  name="Target"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Performance Metrics and Class Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance by Subject */}
          <SectionCard title="Performance by Subject">
            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="subject" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="avgScore"
                    fill="#3b82f6"
                    name="Avg Score"
                  />
                  <Bar
                    dataKey="passRate"
                    fill="#10b981"
                    name="Pass Rate %"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          {/* Class Distribution */}
          <SectionCard title="Class Distribution">
            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={classDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {classDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} students`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        {/* Student Engagement */}
        <SectionCard title="Student Engagement" subtitle="Activity throughout the week">
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="active" fill="#10b981" name="Active Students" />
                <Bar dataKey="inactive" fill="#ef4444" name="Inactive Students" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-6 border border-border">
            <p className="text-sm text-muted-foreground">Avg Attendance</p>
            <p className="text-2xl font-bold mt-2">92.3%</p>
            <p className="text-xs text-green-600 mt-2">+2.1% from last month</p>
          </Card>
          <Card className="p-6 border border-border">
            <p className="text-sm text-muted-foreground">Avg Score</p>
            <p className="text-2xl font-bold mt-2">80.2</p>
            <p className="text-xs text-green-600 mt-2">+1.8 points</p>
          </Card>
          <Card className="p-6 border border-border">
            <p className="text-sm text-muted-foreground">Pass Rate</p>
            <p className="text-2xl font-bold mt-2">87.5%</p>
            <p className="text-xs text-green-600 mt-2">+3.2% improvement</p>
          </Card>
          <Card className="p-6 border border-border">
            <p className="text-sm text-muted-foreground">Engagement</p>
            <p className="text-2xl font-bold mt-2">76.4%</p>
            <p className="text-xs text-yellow-600 mt-2">-2.1% decline</p>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
