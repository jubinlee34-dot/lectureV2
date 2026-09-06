import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { GoogleCalendarPanel } from "../../client/src/components/GoogleCalendarPanel";
import { CALENDAR_SCOPE, lectureEvent } from "../../shared/googleCalendar";
import "../../client/src/index.css";

let mode = "success";
let inserted = false;
let consentCount = 0;
const lecture = {
  id: "fixture-lecture",
  title: "Calendar 테스트 강의",
  organization: "테스트 기관",
  date: "2026-09-08",
  startTime: "10:00",
  endTime: "11:00",
};
const existing = {
  id: "existing",
  summary: "기존 Google 일정",
  start: { dateTime: "2026-09-05T14:00:00+09:00" },
  end: { dateTime: "2026-09-05T15:00:00+09:00" },
};
(window as any).google = {
  accounts: {
    oauth2: {
      initTokenClient: (options: any) => ({
        requestAccessToken: () => {
          consentCount++;
          window.setTimeout(() => {
            if (mode === "denied") options.callback({ error: "access_denied" });
            else
              options.callback({
                access_token: "fixture-google-token",
                expires_in: mode === "expires" ? 31 : 3600,
                scope: `openid ${CALENDAR_SCOPE}`,
              });
          }, 50);
        },
      }),
    },
  },
};
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  if (input !== "/api/google-calendar") return originalFetch(input, init);
  const request = JSON.parse(String(init?.body));
  if (mode === "server-expired")
    return new Response(
      JSON.stringify({
        code: "reconnect",
        error: "Google Calendar를 다시 연결하세요.",
      }),
      { status: 401 }
    );
  if (request.action === "list")
    return new Response(
      JSON.stringify({
        events:
          request.month === "2026-09"
            ? [
                existing,
                ...(inserted
                  ? [{ id: "registered", ...lectureEvent(lecture) }]
                  : []),
              ]
            : [],
      })
    );
  const result = inserted ? "duplicate" : "created";
  inserted = true;
  return new Response(
    JSON.stringify({
      result,
      message:
        result === "created"
          ? "Google 주 캘린더에 등록했습니다."
          : "이미 등록된 강의입니다.",
    })
  );
};
function Fixture() {
  const [loggedIn, setLoggedIn] = useState(true);
  const [month, setMonth] = useState("2026-09");
  const [scenario, setScenario] = useState("success");
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-xl">
        모의 Google Calendar UI 검증 (실제 Google/DB 호출 없음)
      </h1>
      <div className="mb-4 flex flex-wrap gap-4">
        <label>
          응답 시나리오{" "}
          <select
            value={scenario}
            onChange={event => {
              mode = event.target.value;
              setScenario(mode);
            }}
          >
            <option value="success">연결 성공</option>
            <option value="denied">권한 거부</option>
            <option value="expires">1초 후 만료</option>
            <option value="server-expired">서버 만료 응답</option>
          </select>
        </label>
        <button
          onClick={() => setMonth(month === "2026-09" ? "2026-10" : "2026-09")}
        >
          월 변경
        </button>
        <button onClick={() => setLoggedIn(value => !value)}>
          {loggedIn ? "테스트 로그아웃" : "테스트 재로그인"}
        </button>
        <button onClick={() => alert(`동의 요청 횟수: ${consentCount}`)}>
          동의 횟수 확인
        </button>
      </div>
      {loggedIn ? (
        <GoogleCalendarPanel
          month={month}
          lectures={[lecture as any]}
          onMoveMonth={delta =>
            setMonth(value => {
              const [y, m] = value.split("-").map(Number);
              const date = new Date(Date.UTC(y, m - 1 + delta, 1));
              return date.toISOString().slice(0, 7);
            })
          }
        />
      ) : (
        <p>테스트 로그아웃 상태</p>
      )}
    </main>
  );
}
const root = createRoot(document.getElementById("root")!);
root.render(<Fixture />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
