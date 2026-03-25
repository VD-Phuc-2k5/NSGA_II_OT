import { BADGE_TEXT_VI } from "@/lib/schedule/constants";

export function BadgeLabel({ badge }: { badge: string }) {
  const colorMap: Record<string, string> = {
    excellent: "bg-emerald-100 text-emerald-800",
    good: "bg-teal-100 text-teal-800",
    acceptable: "bg-blue-100 text-blue-800",
    fair: "bg-amber-100 text-amber-800",
    warning: "bg-amber-100 text-amber-800",
    poor: "bg-red-100 text-red-800",
    critical: "bg-red-100 text-red-800"
  };
  const normalizedBadge = badge.toLowerCase();
  const colorClass = colorMap[normalizedBadge] ?? "bg-slate-100 text-slate-600";
  const textVi = BADGE_TEXT_VI[normalizedBadge] ?? badge;

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colorClass}`}>
      {textVi}
    </span>
  );
}
