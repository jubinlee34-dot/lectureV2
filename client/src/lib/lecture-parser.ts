import type { LectureFormData } from "@/types/lecture";

export type ParsedLectureFields = Partial<LectureFormData>;

export interface LectureTextParser {
  parse(input: string): ParsedLectureFields;
}

interface ParsedTarget {
  target: string | null;
  participants: number | null;
}

interface CoursePhrase {
  title: string;
  topic: string;
}

export function parseLectureTextToForm(input: string): ParsedLectureFields {
  return localLectureTextParser.parse(input);
}

export const localLectureTextParser: LectureTextParser = {
  parse(input: string) {
    const text = normalizeText(input);
    if (!text) return {};

    const parsed: ParsedLectureFields = {};
    const date = parseDate(text);
    const timeRange = parseTimeRange(text);
    const targetInfo = parseTarget(text);
    const participants = targetInfo.participants ?? parseParticipants(text);
    const phone = parsePhone(text);
    const locationName = parseLocationName(text);
    const coursePhrase = parseCoursePhrase(text);
    const title = parseTitle(text) || coursePhrase?.title || null;
    const managerName = parseManagerName(text);
    const memo = parseUnifiedMemo(text);

    if (date) parsed.date = date;
    if (timeRange) {
      parsed.startTime = timeRange.startTime;
      parsed.endTime = timeRange.endTime;
      parsed.duration = `${timeRange.startTime} ~ ${timeRange.endTime}`;
    }
    if (title) parsed.title = title;
    if (targetInfo.target) parsed.target = targetInfo.target;
    if (participants !== null) parsed.participants = participants;
    if (locationName) {
      parsed.locationName = locationName;
      parsed.location = locationName;
    }
    if (managerName) parsed.managerName = managerName;
    if (phone) parsed.managerPhone = phone;
    if (memo) parsed.instructorMemo = memo;

    return parsed;
  },
};

function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function parseDate(text: string): string | null {
  const currentYear = new Date().getFullYear();
  const fullDate = text.match(/(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (fullDate) return toDateString(Number(fullDate[1]), Number(fullDate[2]), Number(fullDate[3]));

  const monthDay = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (monthDay) return toDateString(currentYear, Number(monthDay[1]), Number(monthDay[2]));

  const slashDate = text.match(/(?<!\d)(\d{1,2})\s*[/.]\s*(\d{1,2})(?!\d)/);
  if (slashDate) return toDateString(currentYear, Number(slashDate[1]), Number(slashDate[2]));

  return null;
}

function toDateString(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseTimeRange(text: string): { startTime: string; endTime: string } | null {
  const numeric = text.match(/(오전|오후)?\s*(\d{1,2}):(\d{2})\s*(?:~|-|부터|에서)\s*(오전|오후)?\s*(\d{1,2}):(\d{2})/);
  if (numeric) {
    const startTime = normalizeTime(Number(numeric[2]), Number(numeric[3]), numeric[1] || "");
    const endTime = normalizeTime(Number(numeric[5]), Number(numeric[6]), numeric[4] || inferEndMeridiem(numeric[1] || "", Number(numeric[5])));
    if (startTime && endTime) return { startTime, endTime };
  }

  const korean = text.match(/(오전|오후)?\s*(\d{1,2})(?::(\d{2}))?\s*시?\s*(?:부터|에서|~|-)\s*(오전|오후)?\s*(\d{1,2})(?::(\d{2}))?\s*시?(?:까지)?/);
  if (!korean) return null;

  const startMeridiem = korean[1] || "";
  const endMeridiem = korean[4] || inferEndMeridiem(startMeridiem, Number(korean[5]));
  const startTime = normalizeTime(Number(korean[2]), Number(korean[3] || 0), startMeridiem);
  const endTime = normalizeTime(Number(korean[5]), Number(korean[6] || 0), endMeridiem);
  return startTime && endTime ? { startTime, endTime } : null;
}

function inferEndMeridiem(startMeridiem: string, endHour: number): string {
  if (endHour >= 13) return "";
  if (startMeridiem === "오전" && endHour === 12) return "";
  return startMeridiem;
}

function normalizeTime(hour: number, minute: number, meridiem: string): string | null {
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) return null;
  let nextHour = hour;
  if (meridiem === "오후" && nextHour < 12) nextHour += 12;
  if (meridiem === "오전" && nextHour === 12) nextHour = 0;
  if (nextHour < 0 || nextHour > 23) return null;
  return `${String(nextHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseParticipants(text: string): number | null {
  const match = text.match(/(?:참여자|참석자|대상|인원|수강생)?\s*(\d{1,4})\s*명/);
  return match ? Number(match[1]) : null;
}

function parsePhone(text: string): string | null {
  const match = text.match(/(?:010|02|0[3-6]\d)-?\d{3,4}-?\d{4}/);
  if (!match) return null;
  const raw = match[0].replace(/[^\d]/g, "");
  if (raw.startsWith("02")) return raw.replace(/^(02)(\d{3,4})(\d{4})$/, "$1-$2-$3");
  return raw.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
}

function parseTitle(text: string): string | null {
  const explicit = parseLabeledValue(text, ["제목", "강의명", "교육명"]);
  return explicit ? cleanLectureTitle(explicit) : null;
}

function parseCoursePhrase(text: string): CoursePhrase | null {
  const targetCourse = text.match(/대상으로\s*([^,.]{2,70}?\s*(?:수업|교육|강의))\s*(?:을|를)?(?:\s*(\d+)\s*차\s*주제로)?\s*(?:진행|실시|예정|합니다|했습니다|함|$)/);
  const generalCourse = text.match(/([^,.]{2,70}?\s*(?:수업|교육|강의))\s*(?:을|를)?(?:\s*(\d+)\s*차\s*주제로)?\s*(?:진행|실시|예정|합니다|했습니다|함|$)/);
  const raw = targetCourse?.[1] || generalCourse?.[1];
  if (!raw) return null;

  const round = targetCourse?.[2] || generalCourse?.[2] || "";
  const title = cleanCourseTitle(`${raw}${round ? ` ${round}차` : ""}`);
  if (!title) return null;
  return { title, topic: cleanTopic(title) };
}

function parseTarget(text: string): ParsedTarget {
  const explicit = parseLabeledValue(text, ["대상", "교육대상"]);
  const freeform = text.match(/([가-힣A-Za-z0-9\s]+?\d{0,4}\s*명)\s*(?:을\s*)?대상으로/);
  const raw = explicit || freeform?.[1];
  if (!raw) return { target: null, participants: null };

  const participants = parseParticipants(raw);
  const target = cleanTarget(raw);
  return { target, participants };
}

function parseManagerName(text: string): string | null {
  if (/담당자(?:는|가|명| 이름)?\s*(?:아직\s*)?(?:미등록|미정|없음|추후\s*안내|확인\s*필요|나중에)/.test(text)) return null;
  const match = text.match(/담당자(?:는|가|명| 이름)?\s*([가-힣]{2,5})(?:입니다|이고|이며|,|\.|$)/);
  return match ? cleanPersonName(match[1]) : null;
}

function parseLocationName(text: string): string | null {
  const explicit = parseLabeledValue(text, ["장소명", "장소", "교육장", "강의장소"]);
  if (explicit) return cleanLocationName(explicit);

  const atPlace = text.match(/([^,.]{2,70}?)(?:에서|교육장에서)\s*(?:[^,.]*?(?:대상|교육|강의|수업|진행|실시))/);
  if (!atPlace) return null;

  return cleanLocationName(atPlace[1]);
}

function parseUnifiedMemo(text: string): string | null {
  const memoParts = [
    parseMemoField(text, ["준비물", "준비"]),
    parseMemoField(text, ["기관 요청사항", "요청사항", "요청"]),
    parseMemoField(text, ["유의사항", "참고사항", "강의 관련 참고사항", "참고"]),
    parseMemoField(text, ["내부 메모", "메모"]),
  ].filter((value): value is string => Boolean(value));

  return memoParts.length > 0 ? Array.from(new Set(memoParts)).join("\n") : null;
}

function parseMemoField(text: string, labels: string[]): string | null {
  const match = parseLabeledValue(text, labels);
  return match ? cleanValue(match) : null;
}

function parseLabeledValue(text: string, labels: string[]): string | null {
  const escaped = labels.map(escapeRegExp).join("|");
  const nextLabel = "(?=\\s*(?:기관명|기관|주최|교육처|의뢰처|제목|강의명|교육명|교육주제|주제|대상|교육대상|장소명|장소|교육장|강의장소|강의일자|날짜|강의시간|시간|담당자|연락처|준비물|준비|기관 요청사항|요청사항|요청|유의사항|참고사항|참고|내부 메모|메모)\\s*(?:은|는|:))";
  const match = text.match(new RegExp(`(?:${escaped})(?:은|는|:)\\s*([^,.]+?)(?:입니다|이고|이며|임|,|\\.|${nextLabel}|$)`));
  return match ? cleanValue(match[1]) : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanValue(value: string): string {
  return value
    .replace(/^(은|는|이|가)\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,，。]+$/g, "")
    .replace(/\s*(?:입니다|이며|이고|하고|합니다|임)$/g, "")
    .trim();
}

function cleanLectureTitle(value: string): string {
  return cleanValue(value)
    .replace(/AI\s*활용/g, "AI 활용")
    .replace(/\s*(?:진행|실시|예정)$/g, "")
    .trim();
}

function cleanCourseTitle(value: string): string {
  return cleanLectureTitle(value)
    .replace(/^.*?에서\s*/, "")
    .replace(/^.*?대상으로\s*/, "")
    .replace(/^.*?대상\s*/, "")
    .trim();
}

function cleanTopic(value: string): string {
  return cleanLectureTitle(value)
    .replace(/\s*(?:수업|교육|강의|주제)$/g, "")
    .trim();
}

function cleanTarget(value: string): string | null {
  const cleaned = cleanValue(value)
    .replace(/^.*?에서\s*/, "")
    .replace(/\d{1,4}\s*명/g, "")
    .replace(/\s*(?:을|를)\s*대상으로.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function cleanLocationName(value: string): string | null {
  const cleaned = cleanValue(value)
    .replace(/^(?:20\d{2}\s*년\s*)?\d{1,2}\s*월\s*\d{1,2}\s*일\s*/, "")
    .replace(/^(?:다음\s*달|다음\s*주|추후|나중에|\d{1,2}\s*월\s*중|\d{1,2}\s*월\s*예정)\s*(?:에)?\s*/, "")
    .trim();
  return cleaned || null;
}

function cleanPersonName(value: string): string {
  return cleanValue(value).replace(/[^가-힣]/g, "").trim();
}
