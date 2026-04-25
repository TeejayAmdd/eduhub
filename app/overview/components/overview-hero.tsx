"use client";

import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const highlights = [
  {
    label: "Next class",
    value: "10:15 AM",
    detail: "Class 10-B · English",
    icon: CalendarDays,
    accent: "border-chart-1/20 bg-chart-1/5 text-chart-1",
  },
  {
    label: "Assignments due",
    value: "8",
    detail: "3 need review today",
    icon: FileText,
    accent: "border-chart-2/20 bg-chart-2/5 text-chart-2",
  },
  {
    label: "Attendance",
    value: "94%",
    detail: "Up 3% from last week",
    icon: CheckCircle2,
    accent: "border-chart-4/20 bg-chart-4/5 text-chart-4",
  },
];

export function OverviewHero() {
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardContent className="p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="rounded-full border border-chart-2/20 bg-chart-2/10 px-3 py-1 text-chart-2"
              >
                Live overview
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full border-chart-1/20 bg-chart-1/5 px-3 py-1 text-chart-1"
              >
                Monday, 8:30 AM
              </Badge>
            </div>

            <div className="space-y-3">
              <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
                Welcome back, John.
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                Your teaching day is organized and calm here: classes,
                assignments, and student updates in one clear view.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                className="rounded-full bg-black px-5 text-white hover:bg-black/90"
                onClick={() => console.log("Create new class")}
              >
                New Class
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-chart-2/20 bg-chart-2/5 px-5 text-chart-2 hover:bg-chart-2/10"
                onClick={() => console.log("Create assignment")}
              >
                Create Assignment
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {highlights.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className={`rounded-2xl border p-4 shadow-sm ${item.accent}`}
                  >
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-current/20 bg-background/80">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold">{item.value}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-muted/30 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Today at a glance
                </p>
                <p className="text-lg font-semibold">Key priorities</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background">
                <BookOpen className="h-5 w-5" />
              </div>
            </div>

            <div className="space-y-3">
              {[
                "Review 3 pending assignments",
                "Attendance check for Class 10-A",
                "Send class reminder to parents",
              ].map((item, index) => (
                <div
                  key={item}
                  className={`flex items-start gap-3 rounded-2xl border p-4 ${
                    [
                      "border-chart-1/20 bg-chart-1/5",
                      "border-chart-2/20 bg-chart-2/5",
                      "border-chart-4/20 bg-chart-4/5",
                    ][index]
                  }`}
                >
                  <span className="mt-1 h-2 w-2 rounded-full bg-current" />
                  <p className="text-sm text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
