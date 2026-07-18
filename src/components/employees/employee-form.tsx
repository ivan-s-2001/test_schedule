"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EmployeeRow = {
  firstName: string;
  lastName: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
};

const emptyRow: EmployeeRow = {
  firstName: "",
  lastName: "",
  email: "",
  role: "EMPLOYEE",
};

export function EmployeeForm() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<EmployeeRow[]>([{ ...emptyRow }]);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (employees: EmployeeRow[]) => {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employees }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка добавления");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const count = data.members?.length ?? 0;
      toast.success(
        count === 1
          ? "Сотрудник добавлен"
          : `${count} сотрудников добавлено`
      );
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setOpen(false);
      setRows([{ ...emptyRow }]);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  function updateRow(index: number, field: keyof EmployeeRow, value: string) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      )
    );
  }

  function addRow() {
    setRows((prev) => [...prev, { ...emptyRow }]);
  }

  function removeRow(index: number) {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Basic validation
    const valid = rows.every(
      (r) => r.firstName.trim() && r.lastName.trim() && r.email.trim()
    );
    if (!valid) {
      toast.error("Заполните все обязательные поля");
      return;
    }

    createMutation.mutate(rows);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Добавить сотрудников
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Добавить сотрудников</DialogTitle>
            <DialogDescription>
              Добавьте одного или нескольких сотрудников.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4 max-h-[50vh] overflow-y-auto">
            {rows.map((row, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-end gap-2 rounded-md border p-3"
              >
                <div className="space-y-1.5">
                  <Label>Vorname *</Label>
                  <Input
                    value={row.firstName}
                    onChange={(e) =>
                      updateRow(index, "firstName", e.target.value)
                    }
                    placeholder="Max"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nachname *</Label>
                  <Input
                    value={row.lastName}
                    onChange={(e) =>
                      updateRow(index, "lastName", e.target.value)
                    }
                    placeholder="Mustermann"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>E-Mail *</Label>
                  <Input
                    type="email"
                    value={row.email}
                    onChange={(e) =>
                      updateRow(index, "email", e.target.value)
                    }
                    placeholder="max@beispiel.de"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Роль</Label>
                  <Select
                    value={row.role}
                    onValueChange={(v) =>
                      updateRow(index, "role", v)
                    }
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">Сотрудники</SelectItem>
                      <SelectItem value="MANAGER">Руководитель</SelectItem>
                      <SelectItem value="ADMIN">Администратор</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(index)}
                  disabled={rows.length === 1}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={addRow}
          >
            <Plus className="size-4" />
            Добавить ещё
          </Button>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {rows.length === 1
                ? "Добавить сотрудника"
                : `${rows.length} Добавить сотрудника`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
