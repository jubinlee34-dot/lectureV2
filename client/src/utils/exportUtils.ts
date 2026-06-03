import type { Lecture, LectureFormData, PaymentStatus, WorkflowStage } from "../types/lecture";

const escapeCSV = (value: string | number | undefined | null): string => {
  if (value === undefined || value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const paymentStatusLabel: Record<PaymentStatus, string> = {
  unpaid: "미입금",
  partial: "일부 입금",
  paid: "입금 완료",
};

const workflowStageLabel: Record<WorkflowStage, string> = {
  before: "강의 전",
  after: "강의 후",
  promoted: "홍보 완료",
};

export function generateCSV(lectures: Lecture[]): string {
  const headers = [
    "강의명",
    "기관명",
    "교육주제",
    "교육대상",
    "교육일자",
    "교육시간",
    "참여인원",
    "교육장소",
    "담당자",
    "담당자연락처",
    "강사료",
    "입금상태",
    "입금금액",
    "워크플로우",
    "교육내용",
    "강의소감",
  ];
  const rows = lectures.map((lecture) => [
    lecture.title,
    lecture.organization,
    lecture.topic,
    lecture.target,
    lecture.date,
    lecture.duration,
    lecture.participants,
    lecture.location,
    lecture.managerName,
    lecture.managerPhone,
    lecture.fee,
    paymentStatusLabel[lecture.paymentStatus],
    lecture.paidAmount,
    workflowStageLabel[lecture.workflowStage],
    lecture.content,
    lecture.reflection,
  ]);
  return "\uFEFF" + [headers, ...rows].map((row) => row.map(escapeCSV).join(",")).join("\n");
}

export function downloadCSV(lectures: Lecture[], filename = "강의목록.csv"): void {
  triggerDownload(new Blob([generateCSV(lectures)], { type: "text/csv;charset=utf-8" }), filename);
}

const escapeICS = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function generateICS(lectures: Lecture[]): string {
  const events = lectures.map((lecture) => {
    const date = lecture.date.replace(/-/g, "");
    return [
      "BEGIN:VEVENT",
      `UID:lecture-${lecture.id}@lecture-archive`,
      `DTSTART;VALUE=DATE:${date}`,
      `DTEND;VALUE=DATE:${date}`,
      `SUMMARY:${escapeICS(`[강의] ${lecture.title} - ${lecture.organization}`)}`,
      `DESCRIPTION:${escapeICS(`${lecture.topic}\n담당자: ${lecture.managerName} ${lecture.managerPhone}\n${lecture.content}`)}`,
      lecture.location ? `LOCATION:${escapeICS(lecture.location)}` : "",
      "END:VEVENT",
    ]
      .filter(Boolean)
      .join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lecture Archive//KO", ...events, "END:VCALENDAR"].join("\r\n");
}

export function downloadICS(lectures: Lecture[], filename = "강의일정.ics"): void {
  triggerDownload(new Blob([generateICS(lectures)], { type: "text/calendar;charset=utf-8" }), filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseCSVToLectures(csvText: string): LectureFormData[] {
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCSVRow(lines[0]);
  return lines.slice(1).map((line) => {
    const row = parseCSVRow(line);
    const get = (name: string) => row[headers.indexOf(name)] ?? "";
    return {
      organization: get("기관명") || "미입력",
      title: get("강의명") || "미입력",
      topic: get("교육주제"),
      target: get("교육대상"),
      date: get("교육일자") || new Date().toISOString().slice(0, 10),
      duration: get("교육시간"),
      participants: Number(get("참여인원")) || 0,
      location: get("교육장소"),
      content: get("교육내용"),
      reflection: get("강의소감"),
      managerName: get("담당자"),
      managerPhone: get("담당자연락처"),
      fee: Number(get("강사료")) || 0,
      paymentStatus: parsePaymentStatus(get("입금상태")),
      paidAmount: Number(get("입금금액")) || 0,
      workflowStage: parseWorkflowStage(get("워크플로우")),
      participantReaction: "",
      instructorMemo: "",
      memorableQuestion: "",
    };
  });
}

export function parseICSToLectures(icsText: string): LectureFormData[] {
  const events = icsText.split("BEGIN:VEVENT").slice(1);
  return events.map((event) => {
    const read = (field: string) => {
      const line = event.split(/\r?\n/).find((item) => item.startsWith(field));
      return line ? line.slice(line.indexOf(":") + 1).replace(/\\n/g, "\n") : "";
    };
    const rawDate = read("DTSTART").slice(0, 8);
    const date = rawDate.length === 8 ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : new Date().toISOString().slice(0, 10);
    const summary = read("SUMMARY").replace(/^\[강의\]\s*/, "");
    return {
      organization: summary.includes(" - ") ? summary.split(" - ").slice(1).join(" - ") : "미입력",
      title: summary.includes(" - ") ? summary.split(" - ")[0] : summary || "가져온 일정",
      topic: "",
      target: "",
      date,
      duration: "",
      participants: 0,
      location: read("LOCATION"),
      content: read("DESCRIPTION"),
      reflection: "",
      managerName: "",
      managerPhone: "",
      fee: 0,
      paymentStatus: "unpaid",
      paidAmount: 0,
      workflowStage: "before",
      participantReaction: "",
      instructorMemo: "",
      memorableQuestion: "",
    };
  });
}

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((item) => item.trim());
}

function parsePaymentStatus(value: string): PaymentStatus {
  if (value === "입금 완료" || value === "paid") return "paid";
  if (value === "일부 입금" || value === "partial") return "partial";
  return "unpaid";
}

function parseWorkflowStage(value: string): WorkflowStage {
  if (value === "강의 후" || value === "after") return "after";
  if (value === "홍보 완료" || value === "promoted") return "promoted";
  return "before";
}
