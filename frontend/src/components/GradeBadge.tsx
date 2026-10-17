import { gradeColor } from "@/lib/config";

/** Glowing A/B/C/D badge in the grade's colour. */
export default function GradeBadge({ grade, big = false }: { grade: string; big?: boolean }) {
  const c = gradeColor(grade);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg border font-display font-bold ${big ? "h-14 w-14 text-3xl" : "h-8 w-8 text-base"}`}
      style={{ color: c, borderColor: c, background: `${c}18`, boxShadow: `0 0 ${big ? 22 : 10}px ${c}66` }}
      title={`Grade ${grade}`}
    >
      {grade}
    </span>
  );
}
