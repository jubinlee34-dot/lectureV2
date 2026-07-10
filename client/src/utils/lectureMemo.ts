import type { Lecture, LectureFormData } from "@/types/lecture";

type LectureMemoSource = Pick<Partial<Lecture | LectureFormData>, "preparationItems" | "requestMemo" | "instructorMemo">;

function cleanMemoPart(value?: string | null) {
  return value?.trim() || "";
}

function includesPart(memo: string, part: string) {
  return !part || memo.includes(part);
}

export function buildUnifiedLectureMemo(source?: LectureMemoSource | null) {
  if (!source) return "";

  const preparationItems = cleanMemoPart(source.preparationItems);
  const requestMemo = cleanMemoPart(source.requestMemo);
  const instructorMemo = cleanMemoPart(source.instructorMemo);
  const legacyParts = [preparationItems, requestMemo].filter(Boolean);

  if (legacyParts.length === 0) return instructorMemo;

  if (instructorMemo && legacyParts.every((part) => includesPart(instructorMemo, part))) {
    return instructorMemo;
  }

  return [
    { label: "준비물", value: preparationItems },
    { label: "요청사항", value: requestMemo },
    { label: "내부 메모", value: instructorMemo },
  ]
    .filter((item) => item.value)
    .map((item) => `${item.label}: ${item.value}`)
    .join("\n");
}
