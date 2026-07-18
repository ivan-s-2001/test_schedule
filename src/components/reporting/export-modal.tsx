"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "Maerz",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

type ExportFormat = "csv" | "pdf" | "excel";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMonth: number;
  defaultYear: number;
}

export function ExportModal({
  open,
  onOpenChange,
  defaultMonth,
  defaultYear,
}: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [month, setMonth] = useState(String(defaultMonth));
  const [year, setYear] = useState(String(defaultYear));
  const [isExporting, setIsExporting] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  async function handleExport() {
    if (format !== "csv") {
      toast.error("Dieses Format ist noch nicht verfuegbar");
      return;
    }

    setIsExporting(true);
    try {
      const res = await fetch(
        `/api/reporting/export?month=${month}&year=${year}&format=${format}`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Export fehlgeschlagen");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Auswertung_${MONTH_NAMES[parseInt(month) - 1]}_${year}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Export erfolgreich heruntergeladen");
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Export fehlgeschlagen"
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Auswertung exportieren</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Format selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Format</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors ${
                  format === "csv"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <FileText className="size-5" />
                <span className="font-medium">CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat("pdf")}
                disabled
                className="flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm border-border opacity-50 cursor-not-allowed relative"
              >
                <FileText className="size-5" />
                <span className="font-medium">PDF</span>
                <Badge
                  variant="secondary"
                  className="absolute -top-1.5 -right-1.5 text-[10px] px-1 py-0"
                >
                  Bald
                </Badge>
              </button>
              <button
                type="button"
                onClick={() => setFormat("excel")}
                disabled
                className="flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm border-border opacity-50 cursor-not-allowed relative"
              >
                <FileSpreadsheet className="size-5" />
                <span className="font-medium">Excel</span>
                <Badge
                  variant="secondary"
                  className="absolute -top-1.5 -right-1.5 text-[10px] px-1 py-0"
                >
                  Bald
                </Badge>
              </button>
            </div>
          </div>

          {/* Month + Year selection */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Месяц</label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Jahr</label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Download button */}
          <Button
            onClick={handleExport}
            disabled={isExporting || format !== "csv"}
            className="w-full"
          >
            {isExporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {isExporting ? "Exportiere..." : "Herunterladen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
