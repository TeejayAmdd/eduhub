'use client'

import { useState } from 'react'
import { PageContainer } from '@/_components/page-container'
import { SectionCard } from '@/_components/section-card'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Download, Filter, Calendar } from 'lucide-react'

const reports = [
  {
    id: 1,
    title: 'Quarterly Attendance Report',
    description: 'Comprehensive attendance data for Q4 2024',
    date: 'December 15, 2024',
    students: 245,
    fileSize: '2.4 MB',
  },
  {
    id: 2,
    title: 'Performance Analysis Report',
    description: 'Student performance metrics across all subjects',
    date: 'December 10, 2024',
    students: 245,
    fileSize: '1.8 MB',
  },
  {
    id: 3,
    title: 'Class Progress Report',
    description: 'Weekly progress summary for all classes',
    date: 'December 8, 2024',
    students: 120,
    fileSize: '956 KB',
  },
  {
    id: 4,
    title: 'Exam Results Summary',
    description: 'Detailed exam performance and statistics',
    date: 'December 5, 2024',
    students: 245,
    fileSize: '3.2 MB',
  },
  {
    id: 5,
    title: 'Assignment Completion Report',
    description: 'Tracking student assignment submissions',
    date: 'December 1, 2024',
    students: 210,
    fileSize: '1.5 MB',
  },
  {
    id: 6,
    title: 'Parent-Teacher Feedback Report',
    description: 'Feedback and communication records',
    date: 'November 28, 2024',
    students: 180,
    fileSize: '892 KB',
  },
]

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null)

  const handleDownload = (reportTitle: string) => {
    console.log(`Downloading ${reportTitle}`)
  }

  return (
    <PageContainer
      title="Reports"
      description="View and download student and class reports"
    >
      <div className="space-y-6">
        {/* Filters Section */}
        <SectionCard>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filter by Date
            </Button>
            <Button variant="outline" className="gap-2">
              <Calendar className="w-4 h-4" />
              Select Range
            </Button>
            <Button variant="outline">All Classes</Button>
          </div>
        </SectionCard>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((report) => (
            <Card
              key={report.id}
              className="p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedReport(report.id.toString())}
            >
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{report.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {report.description}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Date</p>
                    <p className="font-medium">{report.date}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Students</p>
                    <p className="font-medium">{report.students}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">File Size</p>
                    <p className="font-medium">{report.fileSize}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 gap-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownload(report.title)
                    }}
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Preview
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}
