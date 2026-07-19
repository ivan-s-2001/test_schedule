import { redirect } from "next/navigation";
import { ShiftPoolManager } from "@/components/schedule/shift-pool-manager";
import { ViewSwitcher } from "@/components/schedule/view-switcher";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";

export default async function ShiftPoolPage() {
  const member = await getCurrentMember();

  if (!member) redirect("/");
  if (!isManagerOrAbove(member.role)) redirect("/schedule/employee");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Пул смен</h1>
          <p className="text-sm text-muted-foreground">
            Управление обозначениями графика службы заботы
          </p>
        </div>
        <ViewSwitcher />
      </div>

      <ShiftPoolManager />
    </div>
  );
}
