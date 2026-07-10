import { describe, expect, it } from "vitest";
import type { Lecture } from "@/types/lecture";
import { buildUnifiedLectureMemo } from "@/utils/lectureMemo";
import { generateBlogDraft, generateReport } from "@/utils/templates";
import { parseLectureTextToForm, type ParsedLectureFields } from "./lecture-parser";

function mergeParsed(existing: ParsedLectureFields, parsed: ParsedLectureFields) {
  return { ...existing, ...parsed };
}

function countOccurrences(value: string, needle: string) {
  return value.split(needle).length - 1;
}

function createLecture(overrides: Partial<Lecture> = {}): Lecture {
  return {
    id: "lecture-test",
    organization: "테스트 기관",
    title: "AI 활용 교육",
    topic: "AI 활용",
    target: "대학생",
    date: "2026-07-10",
    duration: "09:00 ~ 12:00",
    startTime: "09:00",
    endTime: "12:00",
    participants: 20,
    location: "전남대 진리관",
    locationName: "전남대 진리관",
    roadAddress: "",
    jibunAddress: "",
    locationX: "",
    locationY: "",
    placeMemo: "",
    preparationItems: "",
    requestMemo: "",
    content: "",
    reflection: "",
    managerName: "김민수",
    managerPhone: "010-1234-5678",
    fee: 0,
    paymentStatus: "unpaid",
    paidAmount: 0,
    workflowStage: "before",
    actualParticipants: null,
    paymentDate: "",
    reportSubmitted: false,
    reportSubmittedAt: "",
    satisfactionMemo: "",
    improvementMemo: "",
    blogWritten: false,
    blogUrl: "",
    afterMemo: "",
    participantReaction: "",
    instructorMemo: "",
    memorableQuestion: "",
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: null,
    travelDistanceKm: null,
    travelDurationMin: null,
    travelUpdatedAt: null,
    ...overrides,
  };
}

describe("parseLectureTextToForm", () => {
  it("extracts title, target, participants, time, location, and memo from a complete sentence", () => {
    const parsed = parseLectureTextToForm(
      "광주 전남대 진리관에서 대학생 20명 대상으로 AI활용(HINT) 교육을 2차 주제로 진행함. 오전 9시부터 오후 18시이고 준비물은 노트북과 HDMI 어댑터임."
    );

    expect(parsed.date).toBeUndefined();
    expect(parsed.title).toBe("AI 활용(HINT) 교육 2차");
    expect(parsed.target).toBe("대학생");
    expect(parsed.startTime).toBe("09:00");
    expect(parsed.endTime).toBe("18:00");
    expect(parsed.locationName).toBe("광주 전남대 진리관");
    expect(parsed.participants).toBe(20);
    expect(parsed.managerName).toBeUndefined();
    expect(parsed.managerPhone).toBeUndefined();
    expect(parsed.instructorMemo).toBe("노트북과 HDMI 어댑터");
    expect(parsed.organization).toBeUndefined();
    expect(parsed.fee).toBeUndefined();
  });

  it("extracts manager name and phone only when clearly stated", () => {
    const parsed = parseLectureTextToForm("담당자는 김민수이고 연락처는 01012345678입니다.");

    expect(parsed.managerName).toBe("김민수");
    expect(parsed.managerPhone).toBe("010-1234-5678");
  });

  it("combines preparation and request text into one memo", () => {
    const parsed = parseLectureTextToForm("준비물은 노트북과 HDMI 어댑터이고 요청사항은 교육 시작 30분 전 도착 요청입니다.");

    expect(parsed.instructorMemo).toBe("노트북과 HDMI 어댑터\n교육 시작 30분 전 도착 요청");
    expect(parsed.preparationItems).toBeUndefined();
    expect(parsed.requestMemo).toBeUndefined();
  });

  it("does not invent a date when no date is present", () => {
    const parsed = parseLectureTextToForm("대학생 20명 대상으로 AI 활용 교육을 진행합니다.");

    expect(parsed.date).toBeUndefined();
  });

  it("leaves participants empty when no headcount is present", () => {
    const parsed = parseLectureTextToForm("장소는 전남대 진리관이고 대학생 대상으로 AI 활용 교육을 진행합니다.");

    expect(parsed.participants).toBeUndefined();
  });

  it("returns only fields that can be extracted", () => {
    const parsed = parseLectureTextToForm("장소는 전남대 진리관입니다.");

    expect(parsed).toEqual({ locationName: "전남대 진리관", location: "전남대 진리관" });
  });

  it("preserves existing user input when only some fields are parsed and merged", () => {
    const existing = { title: "기존 강의명", date: "2026-07-10", managerName: "기존 담당자" };
    const parsed = parseLectureTextToForm("오전 10시부터 오후 1시까지 진행합니다.");

    expect(mergeParsed(existing, parsed)).toEqual({
      title: "기존 강의명",
      date: "2026-07-10",
      managerName: "기존 담당자",
      startTime: "10:00",
      endTime: "13:00",
      duration: "10:00 ~ 13:00",
    });
  });
});

describe("buildUnifiedLectureMemo", () => {
  it("keeps new data with only instructorMemo unchanged", () => {
    expect(buildUnifiedLectureMemo({ instructorMemo: "일반 메모 원문" })).toBe("일반 메모 원문");
  });

  it("combines legacy preparation and request data once", () => {
    const combined = buildUnifiedLectureMemo({
      preparationItems: "노트북 준비",
      requestMemo: "30분 전 도착",
      instructorMemo: "실습 시간 확보",
    });

    expect(combined).toBe("준비물: 노트북 준비\n요청사항: 30분 전 도착\n내부 메모: 실습 시간 확보");
  });

  it("returns the same value when a combined memo is passed again", () => {
    const combined = "준비물: 노트북 준비\n요청사항: 30분 전 도착\n내부 메모: 실습 시간 확보";

    expect(buildUnifiedLectureMemo({ preparationItems: "노트북 준비", requestMemo: "30분 전 도착", instructorMemo: combined })).toBe(combined);
  });

  it("does not lose separate requestMemo when instructorMemo contains a general preparation label", () => {
    expect(buildUnifiedLectureMemo({ requestMemo: "30분 전 도착", instructorMemo: "준비물: 현장 상황에 따라 확인" })).toBe(
      "요청사항: 30분 전 도착\n내부 메모: 준비물: 현장 상황에 따라 확인"
    );
  });
});

describe("template memo and topic compatibility", () => {
  it("falls back to lecture title when topic is empty", () => {
    const lecture = createLecture({ topic: "", title: "생성형 AI 실습" });
    const report = generateReport(lecture);
    const blog = generateBlogDraft(lecture);

    const hashtagLine = blog.split("# 해시태그")[1];
    expect(report).toContain("| 교육주제 | 생성형 AI 실습 |");
    expect(hashtagLine).toContain("#생성형AI실습");
    expect(hashtagLine).not.toContain("# ");
  });

  it("does not use unified pre-lecture memo as after-lecture observation", () => {
    const lecture = createLecture({
      instructorMemo: "준비물: 노트북\n요청사항: 30분 전 도착",
      afterMemo: "참여자들이 실습 결과를 적극적으로 공유함",
      reflection: "다음에는 실습 시간을 더 확보",
    });
    const report = generateReport(lecture);
    const blog = generateBlogDraft(lecture);

    expect(report).not.toContain("준비물: 노트북");
    expect(report).not.toContain("요청사항: 30분 전 도착");
    expect(blog).not.toContain("준비물: 노트북");
    expect(blog).not.toContain("요청사항: 30분 전 도착");
    expect(report).toContain("다음에는 실습 시간을 더 확보");
    expect(report).not.toContain("참여자들이 실습 결과를 적극적으로 공유함");
    expect(blog).toContain("참여자들이 실습 결과를 적극적으로 공유함");
  });
});

describe("final unified memo migration and after-note usage", () => {
  it("keeps legacy memo content after migration clears legacy fields", () => {
    const unified = buildUnifiedLectureMemo({
      preparationItems: "Laptop",
      requestMemo: "Arrive early",
      instructorMemo: "Practice block",
    });
    const reopened = buildUnifiedLectureMemo({ preparationItems: "", requestMemo: "", instructorMemo: unified });

    expect(reopened).toBe(unified);
    expect(reopened).toContain("Laptop");
    expect(reopened).toContain("Arrive early");
    expect(reopened).toContain("Practice block");
  });

  it("does not resurrect a deleted preparation line after legacy fields are cleared", () => {
    const editedMemo = "Arrive early\nPractice block";
    const reopened = buildUnifiedLectureMemo({ preparationItems: "", requestMemo: "", instructorMemo: editedMemo });

    expect(reopened).toBe(editedMemo);
    expect(reopened).not.toContain("Laptop");
  });

  it("uses reflection once in report summary and blog closing when only reflection exists", () => {
    const lecture = createLecture({ reflection: "Reflection only note", afterMemo: "", instructorMemo: "???: Laptop" });
    const report = generateReport(lecture);
    const blog = generateBlogDraft(lecture);

    expect(countOccurrences(report, "Reflection only note")).toBe(1);
    expect(countOccurrences(blog, "Reflection only note")).toBe(1);
  });

  it("uses afterMemo once in report summary and blog memorable section when only afterMemo exists", () => {
    const lecture = createLecture({ reflection: "", afterMemo: "After memo only note", instructorMemo: "????: Arrive early" });
    const report = generateReport(lecture);
    const blog = generateBlogDraft(lecture);

    expect(countOccurrences(report, "After memo only note")).toBe(1);
    expect(countOccurrences(blog, "After memo only note")).toBe(1);
  });

  it("keeps instructorMemo preparation and request text out of report and blog", () => {
    const lecture = createLecture({
      instructorMemo: "???: Laptop\n????: Arrive early",
      participantReaction: "Reaction note",
      memorableQuestion: "Question note",
      afterMemo: "After note",
      reflection: "Reflection note",
    });
    const report = generateReport(lecture);
    const blog = generateBlogDraft(lecture);

    expect(report).not.toContain("???: Laptop");
    expect(report).not.toContain("????: Arrive early");
    expect(blog).not.toContain("???: Laptop");
    expect(blog).not.toContain("????: Arrive early");
  });
});
