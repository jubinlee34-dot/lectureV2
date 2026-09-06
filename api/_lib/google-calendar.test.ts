import { describe, expect, it } from "vitest";
import { calendarAction } from "./google-calendar";
import {
  CALENDAR_SCOPE,
  lectureEvent,
  monthRange,
  overlaps,
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
    items?: unknown[];
    pages?: boolean;
    secondPageItems?: unknown[];
    insertStatus?: number;
  } = {}
) {
  const calls: { url: string; init?: RequestInit }[] = [];
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
    if (init?.method === "POST") return json({}, options.insertStatus ?? 200);
    if (/\/events\/[a-f0-9]+\?/.test(url))
      return json({}, options.existing ?? 404);
    if (options.secondPageItems && new URL(url).searchParams.has("pageToken"))
      return json({ items: options.secondPageItems });
    return json({
      items: options.items ?? [],
      ...(options.pages || options.secondPageItems
        ? { nextPageToken: "more" }
        : {}),
    });
  };
  return { fetcher: fetcher as typeof fetch, calls };
}

describe("Calendar 시간 및 최소 필드", () => {
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
  it("종일 겹침과 경계를 구분하고 취소/투명 일정은 제외한다", () => {
    const event = lectureEvent(lecture);
    const other = {
      id: "other",
      start: { date: lecture.date },
      end: { date: "2026-09-07" },
    };
    expect(overlaps(event, other)).toBe(true);
    expect(overlaps(event, { ...other, transparency: "transparent" })).toBe(
      false
    );
    expect(overlaps(event, { ...other, status: "cancelled" })).toBe(false);
    expect(
      overlaps(event, {
        id: "later",
        ...lectureEvent({ ...lecture, startTime: "11:00", endTime: "12:00" }),
      })
    ).toBe(false);
  });
});

describe("Calendar 서버 경계와 등록", () => {
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
  it("없는/타인/삭제 강의는 등록하지 않는다", async () => {
    const mock = upstream({ rows: [] });
    await expect(
      calendarAction(body, "Bearer session", env, mock.fetcher)
    ).rejects.toMatchObject({ code: "lecture" });
    const url = new URL(mock.calls.at(-1)!.url);
    expect(url.searchParams.get("user_id")).toBe("eq.owner");
    expect(url.searchParams.get("deleted_at")).toBe("is.null");
  });
  it.each([200, 410])(
    "기존 등록/삭제 이력 %i는 재삽입하지 않는다",
    async existing => {
      const mock = upstream({ existing });
      expect(
        await calendarAction(body, "Bearer session", env, mock.fetcher)
      ).toMatchObject({ result: "duplicate" });
      expect(mock.calls.some(call => call.init?.method === "POST")).toBe(false);
    }
  );
  it("시간 겹침이 있으면 등록하지 않는다", async () => {
    const mock = upstream({
      items: [{ id: "busy", ...lectureEvent(lecture) }],
    });
    expect(
      await calendarAction(body, "Bearer session", env, mock.fetcher)
    ).toMatchObject({ result: "conflict" });
    expect(mock.calls.some(call => call.init?.method === "POST")).toBe(false);
  });
  it("조회가 불완전하면 등록하지 않는다", async () => {
    const mock = upstream({ pages: true });
    await expect(
      calendarAction(body, "Bearer session", env, mock.fetcher)
    ).rejects.toMatchObject({ code: "incomplete" });
    expect(mock.calls.some(call => call.init?.method === "POST")).toBe(false);
  });
  it("두 번째 페이지의 겹침도 등록을 차단한다", async () => {
    const mock = upstream({
      secondPageItems: [{ id: "second-page", ...lectureEvent(lecture) }],
    });
    expect(
      await calendarAction(body, "Bearer session", env, mock.fetcher)
    ).toMatchObject({ result: "conflict" });
    expect(mock.calls.some(call => call.init?.method === "POST")).toBe(false);
  });
  it.each([
    [401, "reconnect"],
    [403, "permission"],
    [429, "retry"],
    [500, "retry"],
  ] as const)(
    "Google 오류 %i를 안전한 상태로 변환한다",
    async (existing, code) => {
      const mock = upstream({ existing });
      await expect(
        calendarAction(body, "Bearer session", env, mock.fetcher)
      ).rejects.toMatchObject({ code });
    }
  );
  it("등록 요청은 개인정보를 최소화하고 재시도 ID를 유지한다", async () => {
    const mock = upstream();
    await calendarAction(body, "Bearer session", env, mock.fetcher);
    await calendarAction(body, "Bearer session", env, mock.fetcher);
    const inserts = mock.calls
      .filter(call => call.init?.method === "POST")
      .map(call => JSON.parse(String(call.init!.body)));
    expect(inserts[0].id).toMatch(/^[a-f0-9]{64}$/);
    expect(inserts[0].id).toBe(inserts[1].id);
    expect(inserts[0].visibility).toBe("private");
    expect(JSON.stringify(inserts)).not.toContain("private notes");
    expect(JSON.stringify(inserts)).not.toContain("test-token");
  });
  it("동시 삽입 409는 중복 결과로 반환한다", async () => {
    const mock = upstream({ insertStatus: 409 });
    expect(
      await calendarAction(body, "Bearer session", env, mock.fetcher)
    ).toMatchObject({ result: "duplicate" });
  });
});
