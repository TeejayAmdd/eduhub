'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'

export interface CreateAssignmentData {
  title: string
  description: string
  dueDate: string
  class: string
}

interface CreateAssignmentModalProps {
  onSubmit?: (data: CreateAssignmentData) => void
}

export function CreateAssignmentModal({ onSubmit }: CreateAssignmentModalProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState<CreateAssignmentData>({
    title: '',
    description: '',
    dueDate: '',
    class: '',
  })

  const classes = [
    'Class 10-A',
    'Class 10-B',
    'Class 11-A',
    'Class 11-B',
    'Class 12-A',
    'Class 12-B',
  ]

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = () => {
    if (formData.title && formData.dueDate && formData.class) {
      onSubmit?.(formData)
      setFormData({
        title: '',
        description: '',
        dueDate: '',
        class: '',
      })
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Assignment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Assignment</DialogTitle>
          <DialogDescription>
            Create a new assignment for your students.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              name="title"
              placeholder="Assignment title"
              value={formData.title}
              onChange={handleInputChange}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              name="description"
              placeholder="Assignment details and instructions"
              value={formData.description}
              onChange={handleInputChange}
              className="mt-1 w-full px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              rows={4}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Class</label>
            <Select value={formData.class} onValueChange={(value) => {
              setFormData((prev) => ({ ...prev, class: value }))
            }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls} value={cls}>
                    {cls}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Due Date</label>
            <Input
              type="date"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleInputChange}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
