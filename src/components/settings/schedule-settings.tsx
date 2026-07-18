"use client";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ScheduleSettingsProps {
  nameFormat: string;
  scheduleVisibility: string;
  onUpdate: (data: Record<string, unknown>) => void;
  isSaving: boolean;
}

export function ScheduleSettings({
  nameFormat,
  scheduleVisibility,
  onUpdate,
  isSaving,
}: ScheduleSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">График смен</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Einstellungen fuer den Schichtplan
        </p>
      </div>

      <Card className="p-6 space-y-6">
        {/* Name format */}
        <div className="space-y-2">
          <Label>Формат имени</Label>
          <p className="text-xs text-muted-foreground">
            Wie sollen Mitarbeiternamen im Schichtplan angezeigt werden?
          </p>
          <Select
            value={nameFormat}
            onValueChange={(value) => onUpdate({ nameFormat: value })}
            disabled={isSaving}
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LASTNAME_FIRSTNAME">
                Nachname, Vorname
              </SelectItem>
              <SelectItem value="FIRSTNAME_LASTNAME">
                Vorname Nachname
              </SelectItem>
              <SelectItem value="LASTNAME">Nur Nachname</SelectItem>
              <SelectItem value="FIRSTNAME">Nur Vorname</SelectItem>
              <SelectItem value="NICKNAME">Spitzname</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Schedule visibility */}
        <div className="space-y-2">
          <Label>Видимость</Label>
          <p className="text-xs text-muted-foreground">
            Welche Schichten koennen Mitarbeiter sehen?
          </p>
          <Select
            value={scheduleVisibility}
            onValueChange={(value) =>
              onUpdate({ scheduleVisibility: value })
            }
            disabled={isSaving}
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alle Schichten</SelectItem>
              <SelectItem value="OWN_ONLY">Nur eigene Schichten</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>
    </div>
  );
}
