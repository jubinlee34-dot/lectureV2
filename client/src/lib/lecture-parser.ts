import type { LectureFormData } from "@/types/lecture";

export type ParsedLectureFields = Partial<LectureFormData>;

export interface LectureTextParser {
  parse(input: string): ParsedLectureFields;
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
    const participants = parseParticipants(text);
    const phone = parsePhone(text);
    const fee = parseFee(text);
    const organization = parseOrganization(text);
    const title = parseTitle(text);
    const topic = parseTopic(text);
    const target = parseTarget(text);
    const managerName = parseManagerName(text);
    const locationName = parseLocationName(text);
    const address = parseAddress(text);
    const preparationItems = parseMemoField(text, ["준비물", "준비"]);
    const requestMemo = parseMemoField(text, ["요청사항", "요청"]);
    const instructorMemo = parseMemoField(text, ["내부 메모", "메모"]);

    if (date) parsed.date = date;
    if (timeRange) {
      parsed.startTime = timeRange.startTime;
      parsed.endTime = timeRange.endTime;
      parsed.duration = `${timeRange.startTime} ~ ${timeRange.endTime}`;
    }
    if (participants !== null) parsed.participants = participants;
    if (phone) parsed.managerPhone = phone;
    if (fee !== null) parsed.fee = fee;
    if (organization) parsed.organization = organization;
    if (title) parsed.title = title;
    if (topic) {
      parsed.topic = topic;
      if (!parsed.title) parsed.title = organization ? `[${organization}] ${topic}` : topic;
    }
    if (target) parsed.target = target;
    if (managerName) parsed.managerName = managerName;
    if (locationName) parsed.locationName = locationName;
    if (address) {
      parsed.location = address;
      parsed.roadAddress = address;
    } else if (locationName) {
      parsed.location = locationName;
    }
    if (preparationItems) parsed.preparationItems = preparationItems;
    if (requestMemo) parsed.requestMemo = requestMemo;
    if (instructorMemo) parsed.instructorMemo = instructorMemo;

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
  const numeric = text.match(/(\d{1,2}):(\d{2})\s*(?:~|-|부터|에서)\s*(\d{1,2}):(\d{2})/);
  if (numeric) {
    const startTime = normalizeTime(Number(numeric[1]), Number(numeric[2]), "");
    const endTime = normalizeTime(Number(numeric[3]), Number(numeric[4]), "");
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

function parseFee(text: string): number | null {
  const manwon = text.match(/(\d+(?:\.\d+)?)\s*만원/);
  if (manwon) return Math.round(Number(manwon[1]) * 10000);

  const won = text.match(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/);
  if (won) return Number(won[1].replace(/,/g, ""));

  return null;
}

function parseOrganization(text: string): string | null {
  if (text.includes("전사협")) return "전사협";

  const explicit = text.match(/(?:기관|기관명|주최|교육처|의뢰처)(?:은|는|:)?\s*([^,.]+?)(?:에서|이고|이며|입니다|,|\.|$)/);
  if (explicit) return cleanValue(explicit[1]);

  const atOrg = text.match(/(?:^|[.]\s*)([^,.]{2,30}?(?:복지관|센터|협회|상담소|학교|도서관|재단|기관))에서/);
  return atOrg ? cleanValue(atOrg[1]) : null;
}

function parseTitle(text: string): string | null {
  const explicit = text.match(/(?:강의명|교육명)(?:은|는|:)?\s*([^,.]+?)(?:입니다|이고|이며|,|\.|$)/);
  if (explicit) return cleanLectureTitle(explicit[1]);

  const afterOrg = text.match(/에서\s*([^,.]{2,50}?교육)\s*(?:을|를)?\s*(?:진행|실시|예정|합니다|합니다\.|$)/);
  if (afterOrg) return cleanLectureTitle(afterOrg[1]);

  return null;
}

function parseTopic(text: string): string | null {
  const explicit = text.match(/(?:교육주제|주제)(?:은|는|:)?\s*([^,.]+?)(?:입니다|이고|이며|,|\.|$)/);
  if (explicit) return cleanValue(explicit[1]);

  const educationName = text.match(/(?:교육명|강의명)(?:은|는|:)?\s*([^,.]+?)(?:입니다|이고|이며|,|\.|$)/);
  if (educationName) return cleanLectureTitle(educationName[1]);

  return null;
}

function parseTarget(text: string): string | null {
  const match = text.match(/(?:대상|교육대상)(?:은|는|:)?\s*([^,.]+?)(?:입니다|이고|이며|,|\.|$)/);
  return match ? cleanValue(match[1]) : null;
}

function parseManagerName(text: string): string | null {
  if (/담당자(?:는|가)?\s*(?:미등록|미정|없음)/.test(text)) return null;
  const match = text.match(/담당자(?:는|가|명| 이름)?\s*([가-힣]{2,5})(?:입니다|이고|이며|,|\.|$)/);
  return match ? cleanPersonName(match[1]) : null;
}

function parseLocationName(text: string): string | null {
  const explicit = text.match(/(?:장소명|장소|교육장|강의실)(?:은|는|:)?\s*([^,.]+?)(?:이고|이며|입니다|,|\.|$)/);
  if (!explicit) return null;

  const value = cleanValue(explicit[1]);
  return looksLikeAddress(value) ? null : value;
}

function parseAddress(text: string): string | null {
  const explicit = text.match(/(?:상세주소|주소)(?:은|는|:)?\s*([^,.]+?)(?:입니다|이고|이며|,|\.|$)/);
  if (explicit) return cleanValue(explicit[1]);

  const address = text.match(/([가-힣]+(?:시|도)\s+[가-힣]+(?:시|군|구)\s+[가-힣A-Za-z0-9·\s-]+(?:길|로)\s*\d+(?:-\d+)?)/);
  return address ? cleanValue(address[1]) : null;
}

function parseMemoField(text: string, labels: string[]): string | null {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const match = text.match(new RegExp(`(?:${escaped})(?:은|는|:)?\\s*([^\\.]+)(?:\\.|$)`));
  return match ? cleanValue(match[1]) : null;
}

function cleanValue(value: string): string {
  return value
    .replace(/^(은|는|이|가)\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,，。]+$/g, "")
    .replace(/\s*(?:입니다|이며|이고|하고|합니다)$/g, "")
    .trim();
}

function cleanLectureTitle(value: string): string {
  return cleanValue(value).replace(/\s*(?:진행|실시|예정)$/g, "").trim();
}

function cleanPersonName(value: string): string {
  return cleanValue(value).replace(/[^가-힣]/g, "").trim();
}

function looksLikeAddress(value: string): boolean {
  return /(?:시|도)\s+.+(?:길|로)\s*\d+/.test(value);
}
