"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, Filter, Calendar, Loader2, FileText, X } from "lucide-react";
import { PageContainer } from "../_components/page-container";
import { SectionCard } from "../_components/section-card";
import { classes, type Class } from "@/lib/api";
import { cn } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ReportCard {
  id: string;
  title: string;
  description: string;
  date: string;
  students: number;
  file_size: string;
}

interface PreviewData {
  headers: string[];
  rows: string[][];
  total_rows: number;
}

async function authFetch<T>(path: string): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

async function triggerDownload(reportId: string, classId: string) {
  const token = localStorage.getItem("token");
  const qs = classId !== "all" ? `?class_id=${classId}` : "";
  const res = await fetch(`${BASE}/api/reports/download/${reportId}${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${reportId}_report.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [reportsList, setReportsList] = useState<ReportCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [classList, setClassList] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState("all");
  const [downloading, setDownloading] = useState<string | null>(null);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      authFetch<ReportCard[]>("/api/reports/summary"),
      classes.list(),
    ])
      .then(([reports, cls]) => {
        setReportsList(reports);
        setClassList(cls);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleClassChange = async (value: string) => {
    setSelectedClass(value);
    setLoading(true);
    try {
      const qs = value !== "all" ? `?class_id=${value}` : "";
      const reports = await authFetch<ReportCard[]>(`/api/reports/summary${qs}`);
      setReportsList(reports);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const handleDownload = async (reportId: string) => {
    setDownloading(reportId);
    try {
      await triggerDownload(reportId, selectedClass);
    } finally {
      setDownloading(null);
    }
  };

  const handlePreview = async (report: ReportCard) => {
    setPreviewTitle(report.title);
    setPreviewData(null);
    setPreviewOpen(true);
    setPreviewingId(report.id);
    setPreviewLoading(true);
    try {
      const qs = selectedClass !== "all" ? `?class_id=${selectedClass}` : "";
      const data = await authFetch<PreviewData>(`/api/reports/preview/${report.id}${qs}`);
      setPreviewData(data);
    } catch { /* silent */ }
    finally {
      setPreviewLoading(false);
      setPreviewingId(null);
    }
  };

  return (
    <PageContainer
      title="Reports"
      description="View and download student and class reports"
    >
      <div className="space-y-6">
        {/* Filters */}
        <SectionCard title="Filters" subtitle="Refine your report search">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filter by Date
            </Button>
            <Button variant="outline" className="gap-2">
              <Calendar className="w-4 h-4" />
              Select Range
            </Button>
            <Select value={selectedClass} onValueChange={handleClassChange}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classList.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}{c.course_code ? ` (${c.course_code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SectionCard>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reportsList.map((report) => (
              <Card
                key={report.id}
                className="p-6 hover:shadow-md transition-shadow cursor-pointer"
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
                      <p className="font-medium">{report.file_size}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      className="flex-1 gap-2"
                      disabled={downloading === report.id}
                      onClick={() => handleDownload(report.id)}
                    >
                      {downloading === report.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Download className="w-4 h-4" />}
                      {downloading === report.id ? "Downloading…" : "Download"}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      disabled={previewingId === report.id}
                      onClick={() => handlePreview(report)}
                    >
                      {previewingId === report.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <FileText className="w-4 h-4" />}
                      Preview
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {previewTitle}
            </DialogTitle>
            {previewData && (
              <DialogDescription>
                Showing first {previewData.rows.length} of {previewData.total_rows} rows
                {selectedClass !== "all" && (
                  <span> · filtered by selected class</span>
                )}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-auto min-h-0">
            {previewLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !previewData || previewData.rows.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                No data available for this report yet.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-muted/80 backdrop-blur">
                      {previewData.headers.map((h, i) => (
                        <th
                          key={i}
                          className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground whitespace-nowrap border-b border-border"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row, ri) => (
                      <tr
                        key={ri}
                        className={cn(
                          "border-t border-border/60",
                          ri % 2 !== 0 && "bg-muted/20"
                        )}
                      >
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2.5 whitespace-nowrap">
                            {cell || <span className="text-muted-foreground">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {previewData && previewData.total_rows > 10 && (
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              Download the CSV to see all {previewData.total_rows} rows.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
