"use client";

import { useState } from "react";
import { LectureForm, LectureData } from "./_components/lecture-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Calendar, FileText } from "lucide-react";
import { PageContainer } from "../_components/page-container";
import { PageHeader } from "../_components/page-header";
import { SectionCard } from "../_components/section-card";

export default function ClassPreparationPage() {
  const [lectures, setLectures] = useState([
    {
      id: 1,
      title: "Introduction to Algebra",
      subject: "Mathematics",
      date: "2024-01-15",
      topics: "Variables, Expressions, Equations",
      hasFile: true,
    },
    {
      id: 2,
      title: "Shakespeare Overview",
      subject: "English",
      date: "2024-01-16",
      topics: "Life, Works, Literary Techniques",
      hasFile: true,
    },
    {
      id: 3,
      title: "Cell Structure and Function",
      subject: "Science",
      date: "2024-01-17",
      topics: "Organelles, Nucleus, Mitochondria",
      hasFile: false,
    },
  ]);

  const handleCreateLecture = (data: LectureData) => {
    const newLecture = {
      id: lectures.length + 1,
      title: data.title,
      subject: data.subject,
      date: data.date,
      topics: data.topics,
      hasFile: !!data.file,
    };
    setLectures([newLecture, ...lectures]);
  };

  const getSubjectColor = (subject: string) => {
    const colors: Record<string, string> = {
      Mathematics: "bg-blue-100 text-blue-800",
      English: "bg-purple-100 text-purple-800",
      Science: "bg-green-100 text-green-800",
      History: "bg-amber-100 text-amber-800",
      Geography: "bg-emerald-100 text-emerald-800",
      Physics: "bg-cyan-100 text-cyan-800",
      Chemistry: "bg-pink-100 text-pink-800",
    };
    return colors[subject] || "bg-gray-100 text-gray-800";
  };

  return (
    <PageContainer>
      <PageHeader
        title="Class Preparation"
        description="Create and manage your lecture materials"
        action={<LectureForm onSubmit={handleCreateLecture} />}
      />

      <div className="space-y-6">
        {/* Upcoming Lectures */}
        <SectionCard
          title="Lecture Materials"
          subtitle={`${lectures.length} lectures prepared`}
        >
          <div className="space-y-3">
            {lectures.map((lecture) => (
              <Card
                key={lecture.id}
                className="hover:shadow-sm transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <BookOpen className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        <h3 className="font-semibold">{lecture.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {lecture.topics}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={getSubjectColor(lecture.subject)}>
                          {lecture.subject}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {new Date(lecture.date).toLocaleDateString()}
                        </div>
                        {lecture.hasFile && (
                          <div className="flex items-center gap-1 text-xs text-green-600">
                            <FileText className="w-3 h-3" />
                            Material attached
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
}
