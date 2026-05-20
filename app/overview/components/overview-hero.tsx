"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { analytics, schedule, assignments, getCurrentUser, type ScheduleEntry } from "@/lib/api";

// Convert "HH:MM:SS" or "HH:MM" → "9:00 AM" / "2:30 PM"
function toAmPm(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// Minutes since midnight for a "HH:MM:SS" string
function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Pick the first slot that hasn't started yet (start_time >= now)
function findNextSlot(slots: ScheduleEntry[], now: Date): ScheduleEntry | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return slots.find((s) => toMinutes(s.start_time) >= nowMinutes) ?? null;
}

export function OverviewHero() {
  const router = useRouter();
  const [now, setNow] = useState(new Date());
  const [userName, setUserName] = useState("there");
  const [todaySlots, setTodaySlots] = useState<ScheduleEntry[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [attendanceRate, setAttendanceRate] = useState(0);

  // Live clock — ticks every minute (second precision only needed for the clock badge)
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Pull user name from token
  useEffect(() => {
    const user = getCurrentUser();
    if (user && (user as { name?: string }).name) {
      setUserName((user as { name?: string }).name!.split(" ")[0]);
    }
  }, []);

  // Fetch real data for the highlights
  useEffect(() => {
    // Weekly schedule → filter to today so we get class_name
    schedule.weekly().then((entries) => {
      const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
      const filtered = entries
        .filter((e) => e.day_of_week === todayName)
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
      setTodaySlots(filtered);
    }).catch(() => {});

    // Pending assignments count
    assignments.list().then((list) => {
      setPendingCount(list.length);
    }).catch(() => {});

    // Attendance rate from dashboard
    analytics.dashboard().then((d) => {
      setAttendanceRate(d.attendance_rate);
    }).catch(() => {});
  }, []);

  // Recomputed on every clock tick — always reflects the current moment
  const nextSlot = findNextSlot(todaySlots, now);
  const nextClassTime = nextSlot ? toAmPm(nextSlot.start_time) : null;
  const nextClassName = nextSlot?.class_name ?? null;

  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const dateStr = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const highlights = [
    {
      label: "Next class",
      value: nextClassTime ?? "—",
      detail: nextClassName
        ? nextClassName
        : todaySlots.length > 0
        ? "All done for today"
        : "No classes today",
      icon: CalendarDays,
      accent: "border-chart-1/20 bg-chart-1/5 text-chart-1",
    },
    {
      label: "Assignments",
      value: String(pendingCount),
      detail: pendingCount === 0 ? "None pending" : `${pendingCount} active`,
      icon: FileText,
      accent: "border-chart-2/20 bg-chart-2/5 text-chart-2",
    },
    {
      label: "Attendance",
      value: `${attendanceRate}%`,
      detail: attendanceRate === 0 ? "No data yet" : "Today's rate",
      icon: CheckCircle2,
      accent: "border-chart-4/20 bg-chart-4/5 text-chart-4",
    },
  ];

  const priorities = [
    pendingCount > 0
      ? `Review ${pendingCount} active assignment${pendingCount > 1 ? "s" : ""}`
      : "No assignments pending",
    nextClassTime
      ? `Next class at ${nextClassTime}${nextClassName ? ` — ${nextClassName}` : ""}`
      : todaySlots.length > 0
      ? "All classes done for today"
      : "No classes scheduled today",
    `Attendance rate is ${attendanceRate}%`,
  ];

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardContent className="p-4 sm:p-6 md:p-8">
        <div className="grid gap-5 sm:gap-6 md:grid-cols-[1.4fr_1fr] md:items-start">
          <div className="space-y-6">
            {/* Live time badge */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="rounded-full border border-chart-2/20 bg-chart-2/10 px-3 py-1 text-chart-2"
              >
                Live overview
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full border-chart-1/20 bg-chart-1/5 px-3 py-1 text-chart-1 font-mono tabular-nums"
              >
                {dayName}, {timeStr}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-muted-foreground">
                {dateStr}
              </Badge>
            </div>

            <div className="space-y-3">
              <h1 className="text-balance text-2xl sm:text-3xl font-semibold tracking-tight md:text-4xl">
                Welcome back, {userName}.
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                Your teaching day is organized here — classes, assignments, and
                student updates in one clear view.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                className="rounded-full bg-black px-5 text-white hover:bg-black/90"
                onClick={() => router.push("/class-preparation")}
              >
                New Class
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-chart-2/20 bg-chart-2/5 px-5 text-chart-2 hover:bg-chart-2/10"
                onClick={() => router.push("/assignments")}
              >
                Create Assignment
              </Button>
            </div>

            <div className="grid gap-3 grid-cols-3">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className={`rounded-2xl border p-3 sm:p-4 shadow-sm ${item.accent}`}
                  >
                    <div className="mb-2 sm:mb-4 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-current/20 bg-background/80">
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-semibold">{item.value}</p>
                    <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground line-clamp-2">
                      {item.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel — live priorities */}
          <div className="rounded-2xl border border-border bg-muted/30 p-4 sm:p-5">
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
              {priorities.map((item, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 rounded-2xl border p-4 ${
                    [
                      "border-chart-1/20 bg-chart-1/5",
                      "border-chart-2/20 bg-chart-2/5",
                      "border-chart-4/20 bg-chart-4/5",
                    ][index]
                  }`}
                >
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-current" />
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
