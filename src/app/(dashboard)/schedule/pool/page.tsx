import { redirect } from "next/navigation";
import { ShiftPoolManager } from "@/components/schedule/shift-pool-manager";
import { ViewSwitcher } from "@/components/schedule/view-switcher";
import { getCurrentMember, isManagerOrAbove } from "@/lib/auth-helpers";

export default async function ShiftPoolPage() {
  const member = await getCurrentMember();

  if (!member) redirect("/");
  if (!isManagerOrAbove(member.role)) redirect("/schedule/employee");

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div>
          <h1 className="text-[26px] font-medium leading-tight text-[#111319]">
            Пул смен
          </h1>
          <p className="mt-1 text-sm text-[#66778f]">
            Цвета, время и пояснения обозначений графика
          </p>
        </div>
        <ViewSwitcher />
      </header>

      <ShiftPoolManager />
    </div>
  );
}
