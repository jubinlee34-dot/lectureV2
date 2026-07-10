import type { Lecture, LectureFormData } from "@/types/lecture";

type LectureMemoSource = Pick<Partial<Lecture | LectureFormData>, "preparationItems" | "requestMemo" | "instructorMemo">;

const LEGACY_PREFIXES = ["준비물:", "요청사항:", "내부 메모:"];

function cleanMemoPart(value?: string | null) {
  return value?.trim() || "";
}

export function hasCombinedLectureMemo(value?: string | null) {
  const memo = cleanMemoPart(value);
  return LEGACY_PREFIXES.some((prefix) => memo.includes(prefix));
}

export function buildUnifiedLectureMemo(source?: LectureMemoSource | null) {
  if (!source) return "";

  const instructorMemo = cleanMemoPart(source.instructorMemo);
  if (hasCombinedLectureMemo(instructorMemo)) return instructorMemo;

  const parts = [
    { label: "준비물", value: cleanMemoPart(source.preparationItems) },
    { label: "요청사항", value: cleanMemoPart(source.requestMemo) },
    { label: "내부 메모", value: instructorMemo },
  ]
    .filter((item) => item.value)
    .map((item) => `${item.label}: ${item.value}`);

  return parts.join("\n");
}
