import { describe, expect, it } from "vitest";
import { parseLectureTextToForm, type ParsedLectureFields } from "./lecture-parser";
import { buildUnifiedLectureMemo } from "@/utils/lectureMemo";

function mergeParsed(existing: ParsedLectureFields, parsed: ParsedLectureFields) {
  return { ...existing, ...parsed };
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

  it("combines legacy preparation, request, and instructor memo once for editing", () => {
    const combined = buildUnifiedLectureMemo({
      preparationItems: "노트북 준비",
      requestMemo: "30분 전 도착",
      instructorMemo: "실습 시간 확보",
    });

    expect(combined).toBe("준비물: 노트북 준비\n요청사항: 30분 전 도착\n내부 메모: 실습 시간 확보");
    expect(buildUnifiedLectureMemo({ preparationItems: "노트북 준비", requestMemo: "30분 전 도착", instructorMemo: combined })).toBe(combined);
  });
});
