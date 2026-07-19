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
  lastName: string;
  firstName: string;
  patronymic: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
};

const emptyRow: EmployeeRow = {
  lastName: "",
  firstName: "",
  patronymic: "",
  email: "",
  role: "EMPLOYEE",
};

export function EmployeeForm() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<EmployeeRow[]>([{ ...emptyRow }]);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (employees: EmployeeRow[]) => {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employees }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Не удалось добавить сотрудников");
      }

      return response.json();
    },
    onSuccess: (data) => {
      const count = data.members?.length ?? 0;
      toast.success(
        count === 1 ? "Сотрудник добавлен" : `Добавлено сотрудников: ${count}`
      );
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setOpen(false);
      setRows([{ ...emptyRow }]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function updateRow(index: number, field: keyof EmployeeRow, value: string) {
    setRows((previous) =>
      previous.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    );
  }

  function addRow() {
    setRows((previous) => [...previous, { ...emptyRow }]);
  }

  function removeRow(index: number) {
    if (rows.length === 1) return;
    setRows((previous) => previous.filter((_, rowIndex) => rowIndex !== index));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const valid = rows.every(
      (row) =>
        row.lastName.trim() &&
        row.firstName.trim() &&
        row.patronymic.trim() &&
        row.email.trim()
    );

    if (!valid) {
      toast.error("Заполните фамилию, имя, отчество и электронную почту");
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

      <DialogContent className="sm:max-w-5xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Добавить сотрудников</DialogTitle>
            <DialogDescription>
              ФИО хранится раздельно: фамилия, имя и отчество.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 max-h-[58vh] space-y-4 overflow-y-auto">
            {rows.map((row, index) => (
              <div
                key={index}
                className="grid grid-cols-1 items-end gap-2 rounded-md border p-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.25fr_150px_auto]"
              >
                <div className="space-y-1.5">
                  <Label>Фамилия *</Label>
                  <Input
                    value={row.lastName}
                    onChange={(event) =>
                      updateRow(index, "lastName", event.target.value)
                    }
                    placeholder="Иванов"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Имя *</Label>
                  <Input
                    value={row.firstName}
                    onChange={(event) =>
                      updateRow(index, "firstName", event.target.value)
                    }
                    placeholder="Иван"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Отчество *</Label>
                  <Input
                    value={row.patronymic}
                    onChange={(event) =>
                      updateRow(index, "patronymic", event.target.value)
                    }
                    placeholder="Иванович"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Электронная почта *</Label>
                  <Input
                    type="email"
                    value={row.email}
                    onChange={(event) =>
                      updateRow(index, "email", event.target.value)
                    }
                    placeholder="ivanov@qksr.ru"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Роль</Label>
                  <Select
                    value={row.role}
                    onValueChange={(value) => updateRow(index, "role", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">Сотрудник</SelectItem>
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {rows.length === 1
                ? "Добавить сотрудника"
                : `Добавить сотрудников: ${rows.length}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
