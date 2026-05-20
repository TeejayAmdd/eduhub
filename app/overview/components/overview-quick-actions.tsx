"use client";

import { useRouter } from "next/navigation";
import { Bell, FileText, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/app/_components/section-card";

const quickActions = [
  { label: "New Class", icon: Plus, href: "/class-preparation" },
  { label: "Add Student", icon: UserPlus, href: "/students" },
  { label: "Create Assignment", icon: FileText, href: "/assignments" },
  { label: "Send Announcement", icon: Bell, href: "/messages" },
];

const actionStyles = [
  "border-chart-1/20 bg-chart-1/10 text-chart-1",
  "border-chart-2/20 bg-chart-2/10 text-chart-2",
  "border-chart-4/20 bg-chart-4/10 text-chart-4",
  "border-chart-5/20 bg-chart-5/10 text-chart-5",
];

export function OverviewQuickActions() {
  const router = useRouter();

  return (
    <SectionCard
      title="Quick Actions"
      subtitle="Start the most common tasks without digging through menus."
      contentClassName="pt-0"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickActions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.label}
              variant="outline"
              className="h-auto flex-col gap-2 rounded-2xl border-border bg-background py-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-foreground/20"
              onClick={() => router.push(action.href)}
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl border ${actionStyles[index]}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-medium leading-tight">
                {action.label}
              </span>
            </Button>
          );
        })}
      </div>
    </SectionCard>
  );
}
