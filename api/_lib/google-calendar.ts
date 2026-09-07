import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  CALENDAR_SCOPE,
  lectureEvent,
  monthRange,
  sameCalendarEvent,
  type CalendarEvent,
  type CalendarLecture,
} from "../../shared/googleCalendar.js";

type Env = Record<string, string | undefined>;
class CalendarError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}
type Fetcher = typeof fetch;
type RegistrationItem = {
  lectureId: string;
  result: "created" | "duplicate" | "failed";
  message: string;
};
const fields = "id,summary,status,transparency,start,end";
const fail = (status: number, code: string, message: string): never => {
  throw new CalendarError(status, code, message);
};
const eventId = (base: string, userId: string, lectureId: string) =>
  createHash("sha256")
    .update(JSON.stringify(["lectureV2-calendar-v1", base, userId, lectureId]))
    .digest("hex");

// Only exact, fixed diagnostic codes may cross the upstream trust boundary.
// Never return/log Google's message, metadata, identifiers, or request URL.
async function googleForbiddenDiagnostic(response: Response) {
  const reasons = [
    "accessNotConfigured",
    "forbidden",
    "forbiddenForNonOrganizer",
    "insufficientPermissions",
    "domainPolicy",
    "dailyLimitExceeded",
    "userRateLimitExceeded",
    "rateLimitExceeded",
    "quotaExceeded",
    "SERVICE_DISABLED",
    "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
    "RATE_LIMIT_EXCEEDED",
    "QUOTA_EXCEEDED",
  ];
  const statuses = ["PERMISSION_DENIED", "RESOURCE_EXHAUSTED"];
  const record = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON and unreadable bodies must preserve the original 403 category.
  }
  const error = record(record(payload).error);
  const legacy = Array.isArray(error.errors) ? error.errors : [];
  const details = Array.isArray(error.details) ? error.details : [];
  const candidates = [
    ...legacy.map(item => record(item).reason),
    ...details
      .filter(
        item =>
          record(item)["@type"] === "type.googleapis.com/google.rpc.ErrorInfo"
      )
      .map(item => record(item).reason),
  ];
  const reason =
    reasons.find(allowed => candidates.includes(allowed)) ?? "unknown";
  const status =
    statuses.find(allowed => error.status === allowed) ?? "unknown";
  return `reason=${reason}; status=${status}`;
}

export async function calendarAction(
  body: Record<string, unknown>,
  bearer: string,
  env: Env,
  fetcher: Fetcher = fetch
) {
  const {
    VITE_SUPABASE_URL: base,
    VITE_SUPABASE_ANON_KEY: key,
    VITE_GOOGLE_CLIENT_ID: clientId,
  } = env;
  if (!base || !key || !clientId)
    fail(503, "configuration", "Google Calendar 설정이 필요합니다.");
  if (!/^Bearer \S+$/.test(bearer)) fail(401, "session", "다시 로그인하세요.");
  if (
    typeof body.googleAccessToken !== "string" ||
    body.googleAccessToken.length > 4096
  )
    fail(401, "reconnect", "Google Calendar를 다시 연결하세요.");
  const token = body.googleAccessToken as string;
  const request = (url: string, init: RequestInit = {}) =>
    fetcher(url, {
      ...init,
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
  const authHeaders = { apikey: key!, Authorization: bearer };
  const auth = await request(`${base}/auth/v1/user`, { headers: authHeaders });
  if (!auth.ok) fail(401, "session", "다시 로그인하세요.");
  const user = await auth.json();
  const identities = (user.identities ?? []).filter(
    (identity: { provider: string }) => identity.provider === "google"
  );
  const expectedSub =
    identities.length === 1 && identities[0].identity_data?.sub;
  if (!expectedSub)
    fail(403, "account", "Google로 로그인한 계정에서 연결하세요.");
  // Validate the token's client and subject, not an email or a client-supplied account ID.
  // Never include this URL or the upstream response body in logs/errors.
  const infoResponse = await request(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`
  );
  if (!infoResponse.ok)
    fail(
      401,
      "reconnect",
      "Google Calendar 권한이 만료되었거나 취소되었습니다. 다시 연결하세요."
    );
  const info = await infoResponse.json();
  if (info.aud !== clientId || info.sub !== expectedSub)
    fail(403, "account", "로그인한 Google 계정과 같은 계정으로 연결하세요.");
  if (!String(info.scope).split(" ").includes(CALENDAR_SCOPE))
    fail(403, "permission", "일정 조회·등록 권한을 허용한 뒤 다시 연결하세요.");
  const google = async (path: string, init: RequestInit = {}) => {
    const response = await request(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events${path}`,
      {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (response.status === 401)
      fail(401, "reconnect", "Google Calendar를 다시 연결하세요.");
    if (response.status === 403)
      fail(
        403,
        "permission",
        `Google 권한 또는 조직 정책·사용 한도를 확인한 뒤 다시 시도하세요. (${await googleForbiddenDiagnostic(response)})`
      );
    if (response.status === 429 || response.status >= 500)
      fail(
        503,
        "retry",
        "Google Calendar가 일시적으로 응답하지 않습니다. 잠시 후 다시 확인하세요."
      );
    return response;
  };
  const list = async (range: { timeMin: string; timeMax: string }) => {
    const events: CalendarEvent[] = [];
    let pageToken = "";
    for (let page = 0; page < 20; page++) {
      const query = new URLSearchParams({
        ...range,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "250",
        timeZone: "Asia/Seoul",
        fields: `items(${fields}),nextPageToken`,
        ...(pageToken ? { pageToken } : {}),
      });
      const response = await google(`?${query}`);
      if (!response.ok)
        fail(502, "upstream", "Google 일정을 조회하지 못했습니다.");
      const data = await response.json();
      events.push(...(data.items ?? []));
      pageToken = data.nextPageToken;
      if (!pageToken) return events;
    }
    return fail(
      422,
      "incomplete",
      "일정이 너무 많아 전체 조회를 마치지 못했습니다. 등록하지 않았습니다."
    );
  };
  const fetchLectures = async (query: URLSearchParams) => {
    const lectureResponse = await request(`${base}/rest/v1/lectures?${query}`, {
      headers: authHeaders,
    });
    if (!lectureResponse.ok)
      fail(502, "lecture", "강의 정보를 확인하지 못했습니다.");
    return (await lectureResponse.json()) as CalendarLecture[];
  };
  const registerLecture = async (
    row: CalendarLecture,
    knownEvents: CalendarEvent[],
    partialFailure: boolean
  ): Promise<RegistrationItem> => {
    let event;
    try {
      event = lectureEvent(row);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "강의 시간을 확인하세요.";
      if (!partialFailure) fail(400, "input", message);
      return { lectureId: row.id, result: "failed", message };
    }
    const id = eventId(base!, user.id, row.id);
    try {
      const existing = await google(`/${id}?fields=${encodeURIComponent(fields)}`);
      if (existing.ok || existing.status === 410)
        return {
          lectureId: row.id,
          result: "duplicate",
          message: "이미 등록된 강의입니다. Google에서 확인하세요.",
        };
      if (existing.status !== 404)
        return {
          lectureId: row.id,
          result: "failed",
          message: "기존 등록 여부를 확인하지 못했습니다.",
        };
      if (knownEvents.some(other => sameCalendarEvent(event, other)))
        return {
          lectureId: row.id,
          result: "duplicate",
          message: "동일한 제목과 시간이 있는 일정은 중복 제외했습니다.",
        };
      const inserted = await google("?sendUpdates=none", {
        method: "POST",
        body: JSON.stringify({
          ...event,
          id,
          visibility: "private",
          reminders: { useDefault: false },
          extendedProperties: { private: { lectureV2Key: id } },
        }),
      });
      if (inserted.status === 409)
        return {
          lectureId: row.id,
          result: "duplicate",
          message: "이미 등록된 강의입니다. 다시 조회해 확인하세요.",
        };
      if (!inserted.ok)
        return {
          lectureId: row.id,
          result: "failed",
          message: "등록 결과를 확인하지 못했습니다.",
        };
      knownEvents.push({ id, ...event });
      return {
        lectureId: row.id,
        result: "created",
        message: "Google 주 캘린더에 등록했습니다.",
      };
    } catch (error) {
      if (
        !partialFailure ||
        (error instanceof CalendarError &&
          ["session", "reconnect", "account", "permission"].includes(error.code))
      )
        throw error;
      return {
        lectureId: row.id,
        result: "failed",
        message:
          error instanceof Error
            ? error.message
            : "Google Calendar 등록에 실패했습니다.",
      };
    }
  };

  if (body.action === "list") {
    let range;
    try {
      range = monthRange(String(body.month));
    } catch {
      return fail(400, "input", "조회할 월을 확인하세요.");
    }
    return { events: await list(range) };
  }

  if (body.action === "createMonth") {
    let range;
    let month;
    try {
      month = String(body.month);
      range = monthRange(month);
    } catch {
      return fail(400, "input", "등록할 월을 확인하세요.");
    }
    const nextDate = range.timeMax.slice(0, 10);
    const query = new URLSearchParams({
      select: "id,title,organization,date,duration,startTime,endTime",
      user_id: `eq.${user.id}`,
      deleted_at: "is.null",
      date: `gte.${month}-01`,
      order: "date.asc,startTime.asc",
    });
    query.append("date", `lt.${nextDate}`);
    const rows = await fetchLectures(query);
    if (rows.length > 1000)
      fail(422, "input", "한 달 강의가 너무 많아 일괄 등록할 수 없습니다.");
    if (!rows.length)
      return {
        createdCount: 0,
        duplicateCount: 0,
        failedCount: 0,
        items: [] as RegistrationItem[],
      };
    const knownEvents = await list(range);
    const items: RegistrationItem[] = [];
    for (const row of rows)
      items.push(await registerLecture(row, knownEvents, true));
    return {
      createdCount: items.filter(item => item.result === "created").length,
      duplicateCount: items.filter(item => item.result === "duplicate").length,
      failedCount: items.filter(item => item.result === "failed").length,
      items,
    };
  }

  if (
    body.action !== "create" ||
    typeof body.lectureId !== "string" ||
    body.lectureId.length > 200
  )
    fail(400, "input", "요청을 확인하세요.");
  const query = new URLSearchParams({
    select: "id,title,organization,date,duration,startTime,endTime",
    id: `eq.${body.lectureId}`,
    user_id: `eq.${user.id}`,
    deleted_at: "is.null",
  });
  const rows = await fetchLectures(query);
  if (rows.length !== 1)
    fail(404, "lecture", "등록 가능한 강의를 찾을 수 없습니다.");
  let event;
  try {
    event = lectureEvent(rows[0]);
  } catch (error) {
    return fail(
      400,
      "input",
      error instanceof Error ? error.message : "강의 시간을 확인하세요."
    );
  }
  const knownEvents = await list({
    timeMin: event.start.dateTime,
    timeMax: event.end.dateTime,
  });
  const result = await registerLecture(rows[0], knownEvents, false);
  return { result: result.result, message: result.message };
}

export async function googleCalendarHandler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
  env: Env = process.env
) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const respond = (status: number, data: unknown) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    respond(405, { code: "method", error: "POST 요청만 지원합니다." });
    return;
  }
  const origin = req.headers.origin;
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      const forwardedHost = req.headers["x-forwarded-host"];
      const forwardedHosts = (
        Array.isArray(forwardedHost) ? forwardedHost : [forwardedHost]
      )
        .flatMap(value => value?.split(",") ?? [])
        .map(value => value.trim())
        .filter(Boolean);
      const allowedHosts = [req.headers.host, ...forwardedHosts].filter(
        (value): value is string => Boolean(value)
      );
      if (!allowedHosts.includes(originHost)) throw new Error();
    } catch {
      respond(403, { code: "origin", error: "허용되지 않은 요청입니다." });
      return;
    }
  }
  if (!req.headers["content-type"]?.startsWith("application/json")) {
    respond(415, { code: "input", error: "JSON 요청이 필요합니다." });
    return;
  }
  try {
    let body = req.body;
    if (body === undefined) {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk.toString();
        if (Buffer.byteLength(raw) > 16384)
          fail(413, "input", "요청이 너무 큽니다.");
      }
      try {
        body = JSON.parse(raw);
      } catch {
        fail(400, "input", "요청 형식이 올바르지 않습니다.");
      }
    }
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      JSON.stringify(body).length > 16384
    )
      fail(400, "input", "요청 형식이 올바르지 않습니다.");
    respond(
      200,
      await calendarAction(
        body as Record<string, unknown>,
        req.headers.authorization ?? "",
        env
      )
    );
  } catch (error) {
    if (error instanceof CalendarError)
      respond(error.status, { code: error.code, error: error.message });
    else
      respond(502, {
        code: "retry",
        error:
          "연결 또는 등록 결과를 확인하지 못했습니다. 다시 조회한 뒤 재시도하세요.",
      });
  }
}
