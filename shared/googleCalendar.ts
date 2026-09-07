export const CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events.owned";
export const CALENDAR_TIME_ZONE = "Asia/Seoul";

export interface CalendarEvent {
  id: string;
  summary?: string;
  status?: string;
  transparency?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
}

export interface CalendarLecture {
  id: string;
  title: string;
  organization: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  duration?: string;
}

export function monthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new Error("월 형식이 올바르지 않습니다.");
  const [year, value] = month.split("-").map(Number);
  if (year < 1900 || year > 2200) throw new Error("지원하지 않는 연도입니다.");
  const next =
    value === 12
      ? `${year + 1}-01`
      : `${year}-${String(value + 1).padStart(2, "0")}`;
  return {
    timeMin: `${month}-01T00:00:00+09:00`,
    timeMax: `${next}-01T00:00:00+09:00`,
  };
}

export function lectureEvent(lecture: CalendarLecture) {
  const fallback =
    lecture.duration?.split("~").map(value => value.trim()) ?? [];
  const start = lecture.startTime || fallback[0];
  const end = lecture.endTime || fallback[1];
  const date = new Date(`${lecture.date}T00:00:00Z`);
  const validTime = (value?: string | null): value is string =>
    !!value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(lecture.date) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== lecture.date ||
    !validTime(start) ||
    !validTime(end) ||
    end <= start
  ) {
    throw new Error(
      "강의 날짜와 시작·종료 시간을 확인하세요. 종일·자정 이후 종료 일정은 지원하지 않습니다."
    );
  }
  return {
    summary: `[강의] ${lecture.title} - ${lecture.organization}`.slice(0, 500),
    start: {
      dateTime: `${lecture.date}T${start}:00+09:00`,
      timeZone: CALENDAR_TIME_ZONE,
    },
    end: {
      dateTime: `${lecture.date}T${end}:00+09:00`,
      timeZone: CALENDAR_TIME_ZONE,
    },
  };
}

const eventTimestamp = (value: CalendarEvent["start"]) => {
  const source = value.dateTime || (value.date ? `${value.date}T00:00:00+09:00` : "");
  const timestamp = Date.parse(source);
  return Number.isFinite(timestamp) ? timestamp : undefined;
};

export function sameCalendarEvent(
  expected: Pick<CalendarEvent, "summary" | "start" | "end">,
  actual: CalendarEvent
) {
  if (actual.status === "cancelled") return false;
  const expectedStart = eventTimestamp(expected.start);
  const expectedEnd = eventTimestamp(expected.end);
  const actualStart = eventTimestamp(actual.start);
  const actualEnd = eventTimestamp(actual.end);
  return (
    expected.summary === actual.summary &&
    expectedStart !== undefined &&
    expectedEnd !== undefined &&
    expectedStart === actualStart &&
    expectedEnd === actualEnd
  );
}

export function overlaps(
  a: Pick<CalendarEvent, "start" | "end">,
  b: CalendarEvent
) {
  if (b.status === "cancelled" || b.transparency === "transparent")
    return false;
  const startA = eventTimestamp(a.start);
  const endA = eventTimestamp(a.end);
  const startB = eventTimestamp(b.start);
  const endB = eventTimestamp(b.end);
  if (
    startA === undefined ||
    endA === undefined ||
    startB === undefined ||
    endB === undefined
  )
    return false;
  return startA < endB && endA > startB;
}
