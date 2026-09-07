import { describe, expect, it } from "vitest";
import { calendarAction } from "./google-calendar";
import {
  CALENDAR_SCOPE,
  lectureEvent,
  monthRange,
  overlaps,
  sameCalendarEvent,
  type CalendarEvent,
} from "../../shared/googleCalendar";

const env = {
  VITE_SUPABASE_URL: "https://test.supabase.co",
  VITE_SUPABASE_ANON_KEY: "public-test",
  VITE_GOOGLE_CLIENT_ID: "test-client",
};
const lecture = {
  id: "lecture-1",
  date: "2026-09-06",
  title: "테스트 강의",
  organization: "테스트 기관",
  startTime: "10:00",
  endTime: "11:00",
  managerPhone: "must-not-be-exported",
  content: "private notes",
};
const body = {
  action: "create",
  lectureId: lecture.id,
  googleAccessToken: "test-token",
};
const monthBody = {
  action: "createMonth",
  month: "2026-09",
  googleAccessToken: "test-token",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });

function upstream(
  options: {
    sub?: string;
    aud?: string;
    scope?: string;
    authStatus?: number;
    tokenStatus?: number;
    rows?: unknown[];
    existing?: number;
    items?: CalendarEvent[];
    pages?: boolean;
    secondPageItems?: CalendarEvent[];
    insertStatuses?: number[];
  } = {}
) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const inserted = new Map<string, CalendarEvent>();
  let insertIndex = 0;
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/auth/v1/user"))
      return json(
        {
          id: "owner",
          identities: [
            { provider: "google", identity_data: { sub: "google-user" } },
          ],
        },
        options.authStatus ?? 200
      );
    if (url.includes("/tokeninfo?"))
      return json(
        {
          sub: options.sub ?? "google-user",
          aud: options.aud ?? "test-client",
          scope: options.scope ?? `openid ${CALENDAR_SCOPE}`,
        },
        options.tokenStatus ?? 200
      );
    if (url.includes("/rest/v1/lectures?"))
      return json(options.rows ?? [lecture]);
    const eventMatch = url.match(/\/events\/([a-f0-9]+)\?/);
    if (eventMatch) {
      if (inserted.has(eventMatch[1])) return json(inserted.get(eventMatch[1]));
      return json({}, options.existing ?? 404);
    }
    if (init?.method === "POST") {
      const status = options.insertStatuses?.[insertIndex++] ?? 200;
      if (status >= 200 && status < 300) {
        const event = JSON.parse(String(init.body)) as CalendarEvent;
        inserted.set(event.id, event);
      }
      return json({}, status);
    }
    if (options.secondPageItems && new URL(url).searchParams.has("pageToken"))
      return json({ items: options.secondPageItems });
    return json({
      items: [...(options.items ?? []), ...inserted.values()],
      ...(options.pages || options.secondPageItems
        ? { nextPageToken: "more" }
        : {}),
    });
  };
  return { fetcher: fetcher as typeof fetch, calls, inserted };
}

describe("Calendar 시간 및 중복 비교", () => {
  it("연말 월 경계와 KST를 보존한다", () => {
    expect(monthRange("2026-12")).toEqual({
      timeMin: "2026-12-01T00:00:00+09:00",
      timeMax: "2027-01-01T00:00:00+09:00",
    });
    expect(() => monthRange("2026-13")).toThrow();
  });
  it("연락처와 메모를 전송하지 않는다", () => {
    const event = lectureEvent(lecture);
    expect(Object.keys(event).sort()).toEqual(["end", "start", "summary"]);
    expect(JSON.stringify(event)).not.toContain(lecture.managerPhone);
  });
  it("구형 duration을 지원하고 잘못된 날짜/시간은 거부한다", () => {
    expect(
      lectureEvent({
        ...lecture,
        startTime: "",
        endTime: "",
        duration: "10:00 ~ 11:00",
      }).start.dateTime
    ).toContain("10:00");
    for (const change of [
      { date: "2026-02-30" },
      { startTime: "25:00" },
      { endTime: "09:00" },
      { endTime: "10:00" },
    ])
      expect(() => lectureEvent({ ...lecture, ...change })).toThrow();
  });
  it("정확한 제목+시작+종료만 중복으로 보고 timezone 표현 차이를 허용한다", () => {
    const event = lectureEvent(lecture);
    expect(
      sameCalendarEvent(event, {
        id: "same",
        summary: event.summary,
        start: { dateTime: "2026-09-06T01:00:00Z" },
        end: { dateTime: "2026-09-06T02:00:00Z" },
      })
    ).toBe(true);
    expect(
      sameCalendarEvent(event, {
        id: "different-title",
        summary: "다른 일정",
        start: event.start,
        end: event.end,
      })
    ).toBe(false);
    expect(
      sameCalendarEvent(event, {
        id: "cancelled",
        status: "cancelled",
        summary: event.summary,
        start: event.start,
        end: event.end,
      })
    ).toBe(false);
  });
  it("overlaps는 다른 용도를 위해 기존 동작을 유지한다", () => {
    const event = lectureEvent(lecture);
    expect(
      overlaps(event, {
        id: "busy",
        start: { dateTime: "2026-09-06T10:30:00+09:00" },
        end: { dateTime: "2026-09-06T11:30:00+09:00" },
      })
    ).toBe(true);
  });
});

describe("Calendar 서버 경계", () => {
  it.each([
    [{ authStatus: 401 }, "session"],
    [{ tokenStatus: 400 }, "reconnect"],
    [{ sub: "another-user" }, "account"],
    [{ aud: "another-client" }, "account"],
    [{ scope: "openid" }, "permission"],
  ] as const)(
    "잘못된 인증/권한은 Calendar 호출 전에 차단한다: %j",
    async (options, code) => {
      const mock = upstream(options);
      await expect(
        calendarAction(body, "Bearer session", env, mock.fetcher)
      ).rejects.toMatchObject({ code });
      expect(mock.calls.some(call => call.url.includes("/calendar/v3/"))).toBe(
        false
      );
    }
  );
  it("익명 요청은 외부 호출을 하지 않는다", async () => {
    const mock = upstream();
    await expect(
      calendarAction(body, "", env, mock.fetcher)
    ).rejects.toMatchObject({ code: "session" });
    expect(mock.calls).toHaveLength(0);
  });
  it("월 조회는 primary에 기간과 최소 필드를 지정한다", async () => {
    const mock = upstream();
    expect(
      await calendarAction(
        { ...body, action: "list", month: "2026-09" },
        "Bearer session",
        env,
        mock.fetcher
      )
    ).toEqual({ events: [] });
    const url = new URL(mock.calls.at(-1)!.url);
    expect(url.pathname).toContain("/calendars/primary/events");
    expect(url.searchParams.get("timeMin")).toBe("2026-09-01T00:00:00+09:00");
    expect(url.searchParams.get("fields")).not.toContain("description");
  });
});

describe("단건 등록 중복 원칙", () => {
  it.each([200, 410])(
    "기존 deterministic id 상태 %i는 재삽입하지 않는다",
    async existing => {
      const mock = upstream({ existing });
      expect(
        await calendarAction(body, "Bearer session", env, mock.fetcher)
      ).toMatchObject({ result: "duplicate" });
      expect(mock.calls.some(call => call.init?.method === "POST")).toBe(false);
    }
  );
  it("동일 제목+시작+종료 일정은 중복 제외한다", async () => {
    const event = lectureEvent(lecture);
    const mock = upstream({ items: [{ id: "same", ...event }] });
    expect(
      await calendarAction(body, "Bearer session", env, mock.fetcher)
    ).toMatchObject({ result: "duplicate" });
    expect(mock.calls.some(call => call.init?.method === "POST")).toBe(false);
  });
  it("같은 시간대의 다른 제목 일정은 등록한다", async () => {
    const event = lectureEvent(lecture);
    const mock = upstream({
      items: [{ id: "busy", ...event, summary: "다른 Google 일정" }],
    });
    expect(
      await calendarAction(body, "Bearer session", env, mock.fetcher)
    ).toMatchObject({ result: "created" });
    expect(mock.calls.filter(call => call.init?.method === "POST")).toHaveLength(1);
  });
  it("일부 시간만 겹치는 별도 일정도 등록한다", async () => {
    const mock = upstream({
      items: [
        {
          id: "partial",
          summary: "다른 Google 일정",
          start: { dateTime: "2026-09-06T10:30:00+09:00" },
          end: { dateTime: "2026-09-06T11:30:00+09:00" },
        },
      ],
    });
    expect(
      await calendarAction(body, "Bearer session", env, mock.fetcher)
    ).toMatchObject({ result: "created" });
  });
  it("동시 삽입 409는 중복 결과로 반환한다", async () => {
    const mock = upstream({ insertStatuses: [409] });
    expect(
      await calendarAction(body, "Bearer session", env, mock.fetcher)
    ).toMatchObject({ result: "duplicate" });
  });
});

describe("월 전체 등록", () => {
  it("빈 월은 0/0/0으로 반환한다", async () => {
    const mock = upstream({ rows: [] });
    expect(
      await calendarAction(monthBody, "Bearer session", env, mock.fetcher)
    ).toEqual({
      createdCount: 0,
      duplicateCount: 0,
      failedCount: 0,
      items: [],
    });
  });
  it("1건을 정상 생성한다", async () => {
    const mock = upstream();
    expect(
      await calendarAction(monthBody, "Bearer session", env, mock.fetcher)
    ).toMatchObject({ createdCount: 1, duplicateCount: 0, failedCount: 0 });
  });
  it("여러 강의를 모두 생성한다", async () => {
    const mock = upstream({
      rows: [
        lecture,
        { ...lecture, id: "lecture-2", date: "2026-09-07", title: "두번째" },
        { ...lecture, id: "lecture-3", date: "2026-09-08", title: "세번째" },
      ],
    });
    expect(
      await calendarAction(monthBody, "Bearer session", env, mock.fetcher)
    ).toMatchObject({ createdCount: 3, duplicateCount: 0, failedCount: 0 });
  });
  it("deterministic id가 있으면 중복 제외한다", async () => {
    const mock = upstream({ existing: 200 });
    expect(
      await calendarAction(monthBody, "Bearer session", env, mock.fetcher)
    ).toMatchObject({ createdCount: 0, duplicateCount: 1, failedCount: 0 });
  });
  it("동일 제목+시작+종료 Google 일정은 중복 제외한다", async () => {
    const mock = upstream({
      items: [{ id: "same", ...lectureEvent(lecture) }],
    });
    expect(
      await calendarAction(monthBody, "Bearer session", env, mock.fetcher)
    ).toMatchObject({ createdCount: 0, duplicateCount: 1, failedCount: 0 });
  });
  it("시간만 겹치는 다른 일정은 생성한다", async () => {
    const mock = upstream({
      items: [
        {
          id: "busy",
          summary: "다른 일정",
          start: { dateTime: "2026-09-06T10:15:00+09:00" },
          end: { dateTime: "2026-09-06T10:45:00+09:00" },
        },
      ],
    });
    expect(
      await calendarAction(monthBody, "Bearer session", env, mock.fetcher)
    ).toMatchObject({ createdCount: 1, duplicateCount: 0, failedCount: 0 });
  });
  it("잘못된 강의는 실패 집계하고 나머지는 계속 등록한다", async () => {
    const mock = upstream({
      rows: [
        { ...lecture, id: "invalid", startTime: "25:00" },
        { ...lecture, id: "valid", title: "정상 강의" },
      ],
    });
    const result = await calendarAction(
      monthBody,
      "Bearer session",
      env,
      mock.fetcher
    );
    expect(result).toMatchObject({
      createdCount: 1,
      duplicateCount: 0,
      failedCount: 1,
    });
    expect(mock.inserted.size).toBe(1);
  });
  it("일부 Google 등록 실패에도 성공 항목을 되돌리지 않고 계속 처리한다", async () => {
    const mock = upstream({
      rows: [
        { ...lecture, id: "one", title: "하나" },
        { ...lecture, id: "two", title: "둘", date: "2026-09-07" },
        { ...lecture, id: "three", title: "셋", date: "2026-09-08" },
      ],
      insertStatuses: [200, 500, 200],
    });
    expect(
      await calendarAction(monthBody, "Bearer session", env, mock.fetcher)
    ).toMatchObject({ createdCount: 2, duplicateCount: 0, failedCount: 1 });
    expect(mock.inserted.size).toBe(2);
  });
  it("같은 batch 안의 동일 일정 두 개는 하나만 생성한다", async () => {
    const mock = upstream({
      rows: [lecture, { ...lecture, id: "lecture-copy" }],
    });
    expect(
      await calendarAction(monthBody, "Bearer session", env, mock.fetcher)
    ).toMatchObject({ createdCount: 1, duplicateCount: 1, failedCount: 0 });
    expect(mock.inserted.size).toBe(1);
  });
  it("동일 월 재실행은 신규 중복을 만들지 않는다", async () => {
    const mock = upstream();
    expect(
      await calendarAction(monthBody, "Bearer session", env, mock.fetcher)
    ).toMatchObject({ createdCount: 1, duplicateCount: 0 });
    expect(
      await calendarAction(monthBody, "Bearer session", env, mock.fetcher)
    ).toMatchObject({ createdCount: 0, duplicateCount: 1 });
    expect(mock.inserted.size).toBe(1);
  });
  it.each([
    ["2026-08", "gte.2026-08-01", "lt.2026-09-01"],
    ["2026-10", "gte.2026-10-01", "lt.2026-11-01"],
  ])("이동한 월 %s의 강의 범위만 서버에서 조회한다", async (month, gte, lt) => {
    const mock = upstream({ rows: [] });
    await calendarAction(
      { ...monthBody, month },
      "Bearer session",
      env,
      mock.fetcher
    );
    const lectureCall = mock.calls.find(call => call.url.includes("/rest/v1/lectures?"));
    const url = new URL(lectureCall!.url);
    expect(url.searchParams.getAll("date")).toEqual([gte, lt]);
    expect(url.searchParams.get("user_id")).toBe("eq.owner");
    expect(url.searchParams.get("deleted_at")).toBe("is.null");
  });
});
