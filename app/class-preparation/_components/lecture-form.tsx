'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { Upload, X } from 'lucide-react'

interface LectureFormProps {
  onSubmit?: (data: LectureData) => void
}

export interface LectureData {
  title: string
  subject: string
  date: string
  topics: string
  file?: File
}

export function LectureForm({ onSubmit }: LectureFormProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState<LectureData>({
    title: '',
    subject: '',
    date: '',
    topics: '',
  })
  const [fileName, setFileName] = useState<string>('')

  const subjects = [
    'Mathematics',
    'English',
    'Science',
    'History',
    'Geography',
    'Physics',
    'Chemistry',
  ]

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFileName(file.name)
      setFormData((prev) => ({ ...prev, file }))
    }
  }

  const handleSubmit = () => {
    if (formData.title && formData.subject && formData.date) {
      onSubmit?.(formData)
      setFormData({ title: '', subject: '', date: '', topics: '' })
      setFileName('')
      setOpen(false)
    }
  }

  const handleClearFile = () => {
    setFileName('')
    setFormData((prev) => ({ ...prev, file: undefined }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create New Lecture</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Lecture</DialogTitle>
          <DialogDescription>
            Add a new lecture with materials and topics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              name="title"
              placeholder="Lecture title"
              value={formData.title}
              onChange={handleInputChange}
              className="mt-1"
            />
          </div>

          {/* Subject Select */}
          <div>
            <label className="text-sm font-medium">Subject</label>
            <Select value={formData.subject} onValueChange={(value) => {
              setFormData((prev) => ({ ...prev, subject: value }))
            }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div>
            <label className="text-sm font-medium">Date</label>
            <Input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              className="mt-1"
            />
          </div>

          {/* Topics */}
          <div>
            <label className="text-sm font-medium">Topics</label>
            <Input
              name="topics"
              placeholder="E.g., Quadratic equations, Factorization"
              value={formData.topics}
              onChange={handleInputChange}
              className="mt-1"
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="text-sm font-medium">Lecture Materials</label>
            <label className="mt-2 flex items-center justify-center w-full h-20 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent transition-colors">
              <div className="flex flex-col items-center justify-center">
                <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">
                  Click to upload or drag and drop
                </span>
              </div>
              <input
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            {fileName && (
              <Card className="mt-3 p-3 flex items-center justify-between bg-accent/50">
                <span className="text-sm truncate">{fileName}</span>
                <button
                  onClick={handleClearFile}
                  className="p-1 hover:bg-background rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </Card>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Create Lecture</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
