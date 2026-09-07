import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import type { Lecture } from "@/types/lecture";
import { CALENDAR_SCOPE, type CalendarEvent } from "@shared/googleCalendar";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
}
interface GoogleOAuth {
  initTokenClient(options: {
    client_id: string;
    scope: string;
    login_hint: string;
    include_granted_scopes: boolean;
    callback: (response: TokenResponse) => void;
    error_callback: () => void;
  }): { requestAccessToken(options: { prompt: string }): void };
}
const oauth = () =>
  (window as Window & { google?: { accounts?: { oauth2?: GoogleOAuth } } })
    .google?.accounts?.oauth2;
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const displayTime = (event: CalendarEvent) => {
  if (event.start.date) return `${event.start.date} · 종일`;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(event.start.dateTime!));
};

export function GoogleCalendarPanel({
  month,
  lectures,
  onMoveMonth,
}: {
  month: string;
  lectures: Lecture[];
  onMoveMonth?: (delta: number) => void;
}) {
  const { session, user } = useAuth();
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadedMonth, setLoadedMonth] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const token = useRef<{ value: string; expiresAt: number } | null>(null);
  const epoch = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const identities =
    user?.identities?.filter(identity => identity.provider === "google") ?? [];
  const sub =
    identities.length === 1
      ? (identities[0].identity_data?.sub as string | undefined)
      : undefined;
  const monthLectures = lectures
    .filter(lecture => lecture.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));

  function clearConnection(text = "") {
    epoch.current++;
    controller.current?.abort();
    token.current = null;
    setConnected(false);
    setEvents([]);
    setLoadedMonth("");
    setBusy(false);
    setMessage(text);
  }

  useEffect(() => {
    mounted.current = true;
    clearConnection();
    return () => {
      mounted.current = false;
      epoch.current++;
      controller.current?.abort();
      token.current = null;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!clientId) return;
    if (oauth()) {
      setReady(true);
      return;
    }
    let script = document.querySelector<HTMLScriptElement>(
      'script[data-lecture-calendar="gis"]'
    );
    if (!script) {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.dataset.lectureCalendar = "gis";
      document.head.appendChild(script);
    }
    const loaded = () => setReady(!!oauth());
    const failed = () =>
      setMessage(
        "Google 연결 화면을 불러오지 못했습니다. 네트워크를 확인하고 새로고침하세요."
      );
    script.addEventListener("load", loaded);
    script.addEventListener("error", failed);
    return () => {
      script.removeEventListener("load", loaded);
      script.removeEventListener("error", failed);
    };
  }, []);

  useEffect(() => {
    if (!connected || !token.current) return;
    const timer = window.setTimeout(
      () => clearConnection("Google 권한이 만료되었습니다. 다시 연결하세요."),
      Math.max(0, token.current.expiresAt - Date.now())
    );
    return () => window.clearTimeout(timer);
  }, [connected]);

  async function api(
    action: string,
    extra: Record<string, string>,
    signal: AbortSignal
  ) {
    if (!token.current || token.current.expiresAt <= Date.now()) {
      clearConnection("Google Calendar를 다시 연결하세요.");
      throw new Error("Google Calendar를 다시 연결하세요.");
    }
    const response = await fetch("/api/google-calendar", {
      method: "POST",
      signal,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionRef.current?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        action,
        ...extra,
        googleAccessToken: token.current.value,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (["session", "reconnect", "account", "permission"].includes(data.code))
        clearConnection(data.error);
      throw new Error(data.error || "Google Calendar 요청에 실패했습니다.");
    }
    return data;
  }

  useEffect(() => {
    setEvents([]);
    setLoadedMonth("");
    if (!connected) return;
    controller.current?.abort();
    const requestEpoch = ++epoch.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    api("list", { month }, abort.signal)
      .then(data => {
        if (mounted.current && epoch.current === requestEpoch) {
          setEvents(data.events);
          setLoadedMonth(month);
          setMessage("");
        }
      })
      .catch(error => {
        if (
          mounted.current &&
          epoch.current === requestEpoch &&
          !abort.signal.aborted
        )
          setMessage(error.message);
      })
      .finally(() => {
        if (mounted.current && epoch.current === requestEpoch) setBusy(false);
      });
    return () => abort.abort();
  }, [month, connected, reload]);

  function connect() {
    if (!sub || !clientId || !oauth()) return;
    clearConnection();
    setBusy(true);
    const requestEpoch = epoch.current;
    try {
      const client = oauth()!.initTokenClient({
        client_id: clientId,
        scope: `openid ${CALENDAR_SCOPE}`,
        login_hint: sub,
        include_granted_scopes: false,
        callback: response => {
          if (!mounted.current || epoch.current !== requestEpoch) return;
          if (
            response.error ||
            !response.access_token ||
            !response.scope?.split(" ").includes(CALENDAR_SCOPE)
          ) {
            clearConnection(
              "일정 조회·등록 권한이 허용되지 않았습니다. 연결을 다시 선택해 허용하세요."
            );
            return;
          }
          token.current = {
            value: response.access_token,
            expiresAt:
              Date.now() + Math.max(0, (response.expires_in ?? 0) - 30) * 1000,
          };
          setConnected(true);
          setBusy(false);
        },
        error_callback: () => {
          if (mounted.current && epoch.current === requestEpoch)
            clearConnection(
              "연결 창이 닫혔거나 차단되었습니다. 다시 연결하세요."
            );
        },
      });
      client.requestAccessToken({ prompt: "" });
    } catch {
      clearConnection("Google 연결 화면을 열지 못했습니다. 다시 연결하세요.");
    }
  }

  async function registerMonth() {
    if (busy || !monthLectures.length) return;
    setBusy(true);
    setMessage("");
    const requestEpoch = ++epoch.current;
    const abort = new AbortController();
    controller.current = abort;
    try {
      const result = await api("createMonth", { month }, abort.signal);
      if (mounted.current && requestEpoch === epoch.current) {
        setMessage(
          `등록 ${result.createdCount}건 / 중복 제외 ${result.duplicateCount}건 / 실패 ${result.failedCount}건`
        );
        const data = await api("list", { month }, abort.signal);
        if (mounted.current && requestEpoch === epoch.current) {
          setEvents(data.events);
          setLoadedMonth(month);
        }
      }
    } catch (error) {
      if (
        mounted.current &&
        requestEpoch === epoch.current &&
        !abort.signal.aborted
      )
        setMessage((error as Error).message);
    } finally {
      if (mounted.current && requestEpoch === epoch.current) setBusy(false);
    }
  }

  return (
    <section
      className="mb-5 rounded-xl border border-border bg-card p-4"
      aria-label="Google Calendar"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">
            Google Calendar · {month.replace("-", "년 ")}월
          </h2>
          <p className="text-sm text-muted-foreground">
            로그인한 Google 계정의 주 캘린더 · 한국 시간
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onMoveMonth && (
            <>
              <Button
                variant="outline"
                size="sm"
                aria-label="Google Calendar 이전 달"
                onClick={() => onMoveMonth(-1)}
              >
                이전 달
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label="Google Calendar 다음 달"
                onClick={() => onMoveMonth(1)}
              >
                다음 달
              </Button>
            </>
          )}
          {connected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setReload(value => value + 1)}
              >
                이 달 새로고침
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  clearConnection(
                    "이 화면의 연결을 해제했습니다. Google에 등록된 일정과 접근 동의는 유지됩니다."
                  )
                }
              >
                연결 사용 중지
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              disabled={busy || !ready || !sub || !clientId}
              onClick={connect}
            >
              {busy ? "연결 중…" : "Google Calendar 연결"}
            </Button>
          )}
        </div>
      </div>
      {!clientId && (
        <p className="mt-2 text-sm">
          Google Calendar Client ID 설정이 필요합니다.
        </p>
      )}
      {!sub && (
        <p className="mt-2 text-sm">
          Google로 로그인한 계정에서 사용할 수 있습니다.
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        연결을 선택할 때만 권한을 요청합니다. Google 동의 권한에는 소유 캘린더의
        일정 수정·삭제도 포함되지만, 이 기능은 주 캘린더 조회·등록만 합니다.
        새로고침하거나 권한이 만료되면 재연결이 필요합니다.
      </p>
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
      {connected && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              이 달 Google 일정{" "}
              {loadedMonth === month ? `(${events.length})` : ""}
            </h3>
            {busy && (
              <p className="text-sm" role="status">
                확인 중…
              </p>
            )}
            {!busy && loadedMonth === month && !events.length && (
              <p className="text-sm text-muted-foreground">
                이 달에 등록된 일정이 없습니다.
              </p>
            )}
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {events.map(event => (
                <li key={event.id} className="rounded border p-2">
                  <span className="text-muted-foreground">
                    {displayTime(event)}
                  </span>
                  <br />
                  {event.summary || "제목 없는 일정"}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              이 달 lectureV2 강의 ({monthLectures.length})
            </h3>
            {!monthLectures.length ? (
              <p className="text-sm text-muted-foreground">
                이 달에 등록할 강의가 없습니다.
              </p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                {monthLectures.map(lecture => (
                  <li key={lecture.id}>
                    {lecture.date} · {lecture.title}
                  </li>
                ))}
              </ul>
            )}
            <p className="my-2 text-xs text-muted-foreground">
              이 달 강의를 한 번에 처리합니다. 같은 강의 또는 제목·시작·종료
              시간이 모두 같은 Google 일정은 중복 제외하고, 시간만 겹치는 다른
              일정은 등록합니다. 제목·기관·시간만 전송하며 비공개·알림 없음으로
              등록합니다.
            </p>
            <Button
              size="sm"
              disabled={busy || !monthLectures.length}
              onClick={registerMonth}
            >
              {busy ? "처리 중…" : "이 달 강의 전체 등록"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
