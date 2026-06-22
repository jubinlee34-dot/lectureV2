import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { searchKakaoPlaces, type KakaoPlaceCandidate } from "../services/kakaoPlaceService";
import type { Lecture, LectureFormData } from "../types/lecture";

interface LectureFormProps {
  initialData?: Lecture;
  defaultDate?: string;
  onSubmit: (data: LectureFormData, recurringList?: LectureFormData[]) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const emptyForm: LectureFormData = {
  organization: "",
  title: "",
  topic: "",
  target: "",
  date: "",
  duration: "",
  startTime: "09:00",
  endTime: "11:00",
  participants: 0,
  location: "",
  locationName: "",
  roadAddress: "",
  jibunAddress: "",
  locationX: "",
  locationY: "",
  placeMemo: "",
  preparationItems: "",
  requestMemo: "",
  content: "",
  reflection: "",
  managerName: "",
  managerPhone: "",
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
  updatedAt: null,
};

export function LectureForm({ initialData, defaultDate, onSubmit, onCancel, isSubmitting = false }: LectureFormProps) {
  const [formData, setFormData] = useState<LectureFormData>(() => {
    if (!initialData) {
      return {
        ...emptyForm,
        date: defaultDate || "",
      };
    }

    const parsedTimes = parseDuration(initialData.duration);
    return {
      ...emptyForm,
      organization: initialData.organization,
      title: initialData.title,
      topic: initialData.topic,
      target: initialData.target,
      date: initialData.date,
      duration: initialData.duration,
      startTime: initialData.startTime || parsedTimes.startTime,
      endTime: initialData.endTime || parsedTimes.endTime,
      participants: initialData.participants,
      location: initialData.location,
      locationName: initialData.locationName || "",
      roadAddress: initialData.roadAddress || "",
      jibunAddress: initialData.jibunAddress || "",
      locationX: initialData.locationX || "",
      locationY: initialData.locationY || "",
      placeMemo: initialData.placeMemo || "",
      preparationItems: initialData.preparationItems || "",
      requestMemo: initialData.requestMemo || "",
      content: initialData.content,
      reflection: initialData.reflection,
      managerName: initialData.managerName,
      managerPhone: initialData.managerPhone,
      fee: initialData.fee,
      paymentStatus: initialData.paymentStatus,
      paidAmount: initialData.paidAmount,
      workflowStage: initialData.workflowStage,
      actualParticipants: initialData.actualParticipants ?? null,
      paymentDate: initialData.paymentDate || "",
      reportSubmitted: initialData.reportSubmitted ?? false,
      reportSubmittedAt: initialData.reportSubmittedAt || "",
      satisfactionMemo: initialData.satisfactionMemo || "",
      improvementMemo: initialData.improvementMemo || "",
      blogWritten: initialData.blogWritten ?? false,
      blogUrl: initialData.blogUrl || "",
      afterMemo: initialData.afterMemo || "",
      participantReaction: initialData.participantReaction,
      instructorMemo: initialData.instructorMemo,
      memorableQuestion: initialData.memorableQuestion,
      updatedAt: initialData.updatedAt || null,
    };
  });

  const [errors, setErrors] = useState<Partial<Record<keyof LectureFormData, string>>>({});
  const [placeResults, setPlaceResults] = useState<KakaoPlaceCandidate[]>([]);
  const [placeSearchLoading, setPlaceSearchLoading] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [additionalDates, setAdditionalDates] = useState<string[]>([]);
  const [newDateInput, setNewDateInput] = useState("");

  const setField = (field: keyof LectureFormData, value: string | number | boolean | null) => {
    setFormData((prev) => {
      if (field !== "location") return { ...prev, [field]: value };
      return {
        ...prev,
        location: String(value),
        roadAddress: "",
        jibunAddress: "",
        locationX: "",
        locationY: "",
      };
    });
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (field === "location") setPlaceResults([]);
  };

  const handleSearchPlace = async () => {
    const location = formData.location.trim();
    if (!location) {
      toast.error("검색할 교육장소, 기관명 또는 주소를 입력하세요.");
      return;
    }

    setPlaceSearchLoading(true);
    try {
      const results = await searchKakaoPlaces(location);
      setPlaceResults(results);
      if (results.length === 0) {
        toast.info("장소 검색 결과가 없습니다. 입력한 주소는 네이버 거리 계산 fallback에 사용됩니다.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "장소 검색에 실패했습니다.");
    } finally {
      setPlaceSearchLoading(false);
    }
  };

  const handleSelectPlace = (place: KakaoPlaceCandidate) => {
    const selectedAddress = place.roadAddress || place.jibunAddress || place.placeName;
    setFormData((prev) => ({
      ...prev,
      location: selectedAddress,
      locationName: place.placeName,
      roadAddress: place.roadAddress,
      jibunAddress: place.jibunAddress,
      locationX: place.x,
      locationY: place.y,
    }));
    setErrors((prev) => ({ ...prev, location: undefined }));
    setPlaceResults([]);
    toast.success("선택한 주소와 좌표를 저장했습니다.");
  };

  const handleAddDate = () => {
    if (!newDateInput) return;
    if (newDateInput === formData.date) {
      toast.error("기본 강의일과 동일한 날짜입니다.");
      return;
    }
    if (additionalDates.includes(newDateInput)) {
      toast.error("이미 추가된 날짜입니다.");
      return;
    }
    setAdditionalDates((prev) => [...prev, newDateInput].sort());
    setNewDateInput("");
  };

  const validate = (data: LectureFormData) => {
    const next: Partial<Record<keyof LectureFormData, string>> = {};
    if (!data.title.trim()) next.title = "강의명을 입력해주세요.";
    if (!data.organization.trim()) next.organization = "기관명을 입력해주세요.";
    if (!data.topic.trim()) next.topic = "교육 주제를 입력해주세요.";
    if (!data.target.trim()) next.target = "대상을 입력해주세요.";
    if (!data.managerName.trim()) next.managerName = "담당자명을 입력해주세요.";
    if (!data.managerPhone.trim()) next.managerPhone = "담당자 연락처를 입력해주세요.";
    if (!data.date) next.date = "강의일을 선택해주세요.";
    if (!data.startTime) next.startTime = "시작 시간을 입력해주세요.";
    if (!data.endTime) next.endTime = "종료 시간을 입력해주세요.";
    if (!data.locationName?.trim()) next.locationName = "장소명을 입력해주세요.";
    if (!data.location.trim()) next.location = "주소를 입력해주세요.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const duration = `${formData.startTime} ~ ${formData.endTime}`;
    const finalData: LectureFormData = {
      ...formData,
      duration,
      workflowStage: initialData?.workflowStage ?? "before",
      content: formData.requestMemo || formData.preparationItems || formData.content,
      updatedAt: new Date().toISOString(),
    };

    if (!validate(finalData)) return;

    if (!initialData && isRecurring && additionalDates.length > 0) {
      const allDates = [finalData.date, ...additionalDates].sort();
      const list = allDates.map((dateStr, index) => ({
        ...finalData,
        title: allDates.length > 1 ? `${finalData.title} (${index + 1}회차)` : finalData.title,
        date: dateStr,
      }));
      onSubmit(finalData, list);
      return;
    }

    onSubmit(finalData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Section title="기본정보">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="강의명" required error={errors.title}>
            <Input value={formData.title} onChange={(e) => setField("title", e.target.value)} placeholder="예: 디지털 리터러시 기초 과정" />
          </Field>
          <Field label="기관명" required error={errors.organization}>
            <Input value={formData.organization} onChange={(e) => setField("organization", e.target.value)} placeholder="예: 서울시 강남구 평생학습관" />
          </Field>
          <Field label="교육 주제" required error={errors.topic}>
            <Input value={formData.topic} onChange={(e) => setField("topic", e.target.value)} placeholder="예: 스마트폰 활용법" />
          </Field>
          <Field label="대상" required error={errors.target}>
            <Input value={formData.target} onChange={(e) => setField("target", e.target.value)} placeholder="예: 60대 이상 어르신" />
          </Field>
          <Field label="담당자명" required error={errors.managerName}>
            <Input value={formData.managerName} onChange={(e) => setField("managerName", e.target.value)} placeholder="예: 김지영" />
          </Field>
          <Field label="담당자 연락처" required error={errors.managerPhone}>
            <Input type="tel" value={formData.managerPhone} onChange={(e) => setField("managerPhone", e.target.value)} placeholder="예: 010-1234-5678" />
          </Field>
        </div>
      </Section>

      <Section title="일정/장소">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="강의일" required error={errors.date}>
            <Input type="date" value={formData.date} onChange={(e) => setField("date", e.target.value)} />
          </Field>
          <Field label="강의 시간" required error={errors.startTime || errors.endTime}>
            <div className="flex items-center gap-2">
              <Input type="time" value={formData.startTime || ""} onChange={(e) => setField("startTime", e.target.value)} />
              <span className="text-sm font-semibold text-muted-foreground">~</span>
              <Input type="time" value={formData.endTime || ""} onChange={(e) => setField("endTime", e.target.value)} />
            </div>
          </Field>
          <Field label="장소명" required error={errors.locationName}>
            <Input value={formData.locationName || ""} onChange={(e) => setField("locationName", e.target.value)} placeholder="예: 강남구 평생학습관 3층 강의실" />
          </Field>
          <Field
            label="주소"
            required
            error={errors.location}
            description="입력한 주소는 상세페이지의 네이버 길찾기 목적지로 사용됩니다."
          >
            <div className="flex gap-2">
              <Input
                value={formData.location}
                onChange={(e) => setField("location", e.target.value)}
                placeholder="예: 서울 강남구 테헤란로 123"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSearchPlace}
                disabled={placeSearchLoading}
                className="h-10 shrink-0 px-3 text-xs"
              >
                {placeSearchLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}
                장소 검색
              </Button>
            </div>
            {(formData.roadAddress || formData.jibunAddress) && (
              <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-foreground">
                <p className="font-semibold">선택된 주소: {formData.roadAddress || formData.jibunAddress}</p>
                {formData.locationName && <p className="mt-0.5 text-muted-foreground">장소명: {formData.locationName}</p>}
                {formData.locationX && formData.locationY && (
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    좌표: {formData.locationX}, {formData.locationY}
                  </p>
                )}
              </div>
            )}
            {placeResults.length > 0 && (
              <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-card">
                {placeResults.map((place) => {
                  const key = `${place.placeName}-${place.x}-${place.y}`;
                  return (
                    <div key={key} className="flex flex-col gap-2 border-b border-border p-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 text-sm">
                        <p className="font-semibold text-foreground">{place.placeName || "장소명 없음"}</p>
                        <p className="mt-1 text-xs text-foreground/80">도로명: {place.roadAddress || "없음"}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">지번: {place.jibunAddress || "없음"}</p>
                      </div>
                      <Button type="button" size="sm" variant="secondary" className="shrink-0" onClick={() => handleSelectPlace(place)}>
                        이 주소 사용
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Field>
          <Field label="장소 메모">
            <Textarea value={formData.placeMemo || ""} onChange={(e) => setField("placeMemo", e.target.value)} rows={2} placeholder="예: 주차는 지하 2층, 빔프로젝터 HDMI 확인" />
          </Field>
        </div>
      </Section>

      <Section title="강의 준비용 메모">
        <div className="space-y-4">
          <Field label="준비물">
            <Textarea value={formData.preparationItems || ""} onChange={(e) => setField("preparationItems", e.target.value)} rows={3} placeholder="예: 노트북, HDMI 젠더, 실습 자료 30부" />
          </Field>
          <Field label="요청사항">
            <Textarea value={formData.requestMemo || ""} onChange={(e) => setField("requestMemo", e.target.value)} rows={3} placeholder="기관 요청사항이나 강의 전 확인할 내용을 적어두세요." />
          </Field>
          <Field label="내부 메모">
            <Textarea value={formData.instructorMemo} onChange={(e) => setField("instructorMemo", e.target.value)} rows={3} placeholder="강사 개인 메모를 적어두세요." />
          </Field>
        </div>
      </Section>

      {!initialData && (
        <Section title="반복 설정">
          <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              이 일정을 반복해서 등록합니다
            </label>
            {isRecurring && (
              <div className="space-y-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="mb-1.5 block text-xs text-muted-foreground">추가할 강의일</Label>
                    <Input type="date" value={newDateInput} onChange={(e) => setNewDateInput(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <Button type="button" onClick={handleAddDate} variant="outline" size="sm" className="h-9 shrink-0">
                    추가
                  </Button>
                </div>
                {additionalDates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {additionalDates.map((date) => (
                      <span key={date} className="inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        {date}
                        <button type="button" onClick={() => setAdditionalDates((prev) => prev.filter((item) => item !== date))} className="rounded-full p-0.5 hover:bg-primary/20">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      <div className="flex justify-end gap-3 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>취소</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {initialData ? "기본정보 저장" : "강의 등록"}
        </Button>
      </div>
    </form>
  );
}

function parseDuration(duration: string | undefined) {
  if (duration?.includes("~")) {
    const [startTime, endTime] = duration.split("~").map((value) => value.trim());
    return { startTime: startTime || "09:00", endTime: endTime || "11:00" };
  }
  return { startTime: "09:00", endTime: "11:00" };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="border-b border-border pb-2 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  error,
  description,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 font-bold text-destructive">*</span>}
      </Label>
      {children}
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
