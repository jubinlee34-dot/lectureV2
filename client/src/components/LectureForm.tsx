import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { searchKakaoPlaces, type KakaoPlaceCandidate } from "../services/kakaoPlaceService";
import type { Lecture, LectureFormData, PaymentStatus, WorkflowStage } from "../types/lecture";

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
  participants: 0,
  location: "",
  locationName: "",
  roadAddress: "",
  jibunAddress: "",
  locationX: "",
  locationY: "",
  content: "",
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

export function LectureForm({ initialData, defaultDate, onSubmit, onCancel, isSubmitting = false }: LectureFormProps) {
  const [formData, setFormData] = useState<LectureFormData>(
    initialData
      ? {
          organization: initialData.organization,
          title: initialData.title,
          topic: initialData.topic,
          target: initialData.target,
          date: initialData.date,
          duration: initialData.duration,
          participants: initialData.participants,
          location: initialData.location,
          locationName: initialData.locationName || "",
          roadAddress: initialData.roadAddress || "",
          jibunAddress: initialData.jibunAddress || "",
          locationX: initialData.locationX || "",
          locationY: initialData.locationY || "",
          content: initialData.content,
          reflection: initialData.reflection,
          managerName: initialData.managerName,
          managerPhone: initialData.managerPhone,
          fee: initialData.fee,
          paymentStatus: initialData.paymentStatus,
          paidAmount: initialData.paidAmount,
          workflowStage: initialData.workflowStage,
          participantReaction: initialData.participantReaction,
          instructorMemo: initialData.instructorMemo,
          memorableQuestion: initialData.memorableQuestion,
        }
      : {
          ...emptyForm,
          date: defaultDate || "",
        }
  );

  const [startTime, setStartTime] = useState(() => {
    if (initialData?.duration && initialData.duration.includes("~")) {
      return initialData.duration.split("~")[0].trim();
    }
    return "09:00";
  });
  const [endTime, setEndTime] = useState(() => {
    if (initialData?.duration && initialData.duration.includes("~")) {
      return initialData.duration.split("~")[1].trim();
    }
    return "11:00";
  });

  const [errors, setErrors] = useState<Partial<Record<keyof LectureFormData, string>>>({});
  const [placeResults, setPlaceResults] = useState<KakaoPlaceCandidate[]>([]);
  const [placeSearchLoading, setPlaceSearchLoading] = useState(false);

  const [isRecurring, setIsRecurring] = useState(false);
  const [additionalDates, setAdditionalDates] = useState<string[]>([]);
  const [newDateInput, setNewDateInput] = useState("");

  const handleAddDate = () => {
    if (!newDateInput) return;
    if (newDateInput === formData.date) {
      toast.error("기본 교육일자와 동일한 날짜입니다.");
      return;
    }
    if (additionalDates.includes(newDateInput)) {
      toast.error("이미 추가된 날짜입니다.");
      return;
    }
    setAdditionalDates((prev) => [...prev, newDateInput].sort());
    setNewDateInput("");
  };

  const handleRemoveDate = (dateToRemove: string) => {
    setAdditionalDates((prev) => prev.filter((d) => d !== dateToRemove));
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
        toast.info("카카오 장소 검색 결과가 없습니다. 입력한 주소는 네이버 거리 계산 fallback에 사용됩니다.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "카카오 장소 검색에 실패했습니다.");
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

  const setField = (field: keyof LectureFormData, value: string | number) => {
    setFormData((prev) => {
      if (field !== "location") return { ...prev, [field]: value };
      return {
        ...prev,
        location: String(value),
        locationName: "",
        roadAddress: "",
        jibunAddress: "",
        locationX: "",
        locationY: "",
      };
    });
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (field === "location") setPlaceResults([]);
  };

  const validate = (data: LectureFormData) => {
    const next: Partial<Record<keyof LectureFormData, string>> = {};
    if (!data.organization.trim()) next.organization = "기관명을 입력해주세요.";
    if (!data.title.trim()) next.title = "교육명을 입력해주세요.";
    if (!data.topic.trim()) next.topic = "교육주제를 입력해주세요.";
    if (!data.target.trim()) next.target = "교육대상을 입력해주세요.";
    if (!data.date) next.date = "교육일자를 선택해주세요.";
    if (!data.duration.trim() || data.duration === " ~ ") next.duration = "교육시간을 설정해주세요.";
    if (data.participants <= 0) next.participants = "참여인원을 입력해주세요.";
    if (!data.location.trim()) next.location = "교육장소를 입력해주세요.";
    if (!data.content.trim()) next.content = "교육내용을 입력해주세요.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const durationStr = `${startTime} ~ ${endTime}`;
    const finalData = { ...formData, duration: durationStr };
    if (validate(finalData)) {
      if (!initialData && isRecurring && additionalDates.length > 0) {
        const allDates = [finalData.date, ...additionalDates].sort();
        const list = allDates.map((dateStr, index) => ({
          ...finalData,
          title: allDates.length > 1 ? `${finalData.title} (${index + 1}회차)` : finalData.title,
          date: dateStr,
        }));
        onSubmit(finalData, list);
      } else {
        onSubmit(finalData);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Section title="기본 정보">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="기관명" required error={errors.organization}>
            <Input value={formData.organization} onChange={(e) => setField("organization", e.target.value)} placeholder="예: 서울시 강남구 평생학습관" />
          </Field>
          <Field label="교육명" required error={errors.title}>
            <Input value={formData.title} onChange={(e) => setField("title", e.target.value)} placeholder="예: 디지털 리터러시 기초 과정" />
          </Field>
          <Field label="교육주제" required error={errors.topic}>
            <Input value={formData.topic} onChange={(e) => setField("topic", e.target.value)} placeholder="예: 스마트폰 활용법" />
          </Field>
          <Field label="교육대상" required error={errors.target}>
            <Input value={formData.target} onChange={(e) => setField("target", e.target.value)} placeholder="예: 60대 이상 어르신" />
          </Field>
        </div>
      </Section>

      <Section title="담당자 정보" subtitle="문자 발송 기능에 사용됩니다.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="담당자 이름">
            <Input value={formData.managerName} onChange={(e) => setField("managerName", e.target.value)} placeholder="예: 김지영" />
          </Field>
          <Field label="담당자 연락처" description="문자 발송 시 자동으로 입력됩니다.">
            <Input type="tel" value={formData.managerPhone} onChange={(e) => setField("managerPhone", e.target.value)} placeholder="예: 010-1234-5678" />
          </Field>
        </div>
      </Section>

      <Section title="일정 및 장소">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="교육일자" required error={errors.date}>
            <Input type="date" value={formData.date} onChange={(e) => setField("date", e.target.value)} />
          </Field>
          <Field label="교육시간" required error={errors.duration}>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setErrors((prev) => ({ ...prev, duration: undefined }));
                }}
                className="w-full"
              />
              <span className="text-muted-foreground text-sm font-semibold">~</span>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  setErrors((prev) => ({ ...prev, duration: undefined }));
                }}
                className="w-full"
              />
            </div>
          </Field>
          <Field label="참여인원" required error={errors.participants}>
            <Input type="number" min={0} value={formData.participants || ""} onChange={(e) => setField("participants", Number(e.target.value) || 0)} placeholder="예: 25" />
          </Field>
          <Field
            label="교육장소"
            required
            error={errors.location}
            description="* 입력하신 교육장소는 상세페이지에서 출발지로부터의 네이버 길찾기 연동 시 목적지로 사용됩니다."
          >
            <div className="flex gap-2">
              <Input
                value={formData.location}
                onChange={(e) => setField("location", e.target.value)}
                placeholder="예: 전남 영광군 염산면 천년로 36 또는 건물명"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSearchPlace}
                disabled={placeSearchLoading}
                className="shrink-0 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all text-xs h-10 px-3"
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
        </div>
      </Section>

      {!initialData && (
        <Section title="반복 설정 (선택 사항)">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isRecurring"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="h-4.5 w-4.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <Label htmlFor="isRecurring" className="text-sm font-semibold text-foreground cursor-pointer">
                이 일정을 반복해서 등록합니다
              </Label>
            </div>
            {isRecurring && (
              <div className="space-y-3 bg-muted/20 p-4 rounded-lg border border-border">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-1.5 block">추가할 교육일자</Label>
                    <Input
                      type="date"
                      value={newDateInput}
                      onChange={(e) => setNewDateInput(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddDate}
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0"
                  >
                    추가
                  </Button>
                </div>
                {additionalDates.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-xs font-semibold text-muted-foreground">추가된 날짜 목록:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {additionalDates.map((d) => (
                        <span
                          key={d}
                          className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary border border-primary/20"
                        >
                          {d}
                          <button
                            type="button"
                            onClick={() => handleRemoveDate(d)}
                            className="rounded-full p-0.5 hover:bg-primary/20 cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      <Section title="강사료 및 입금">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="강사료 (원)">
            <Input type="number" min={0} step={10000} value={formData.fee || ""} onChange={(e) => setField("fee", Number(e.target.value) || 0)} placeholder="예: 300000" />
          </Field>
          <Field label="입금 상태">
            <select value={formData.paymentStatus} onChange={(e) => setField("paymentStatus", e.target.value as PaymentStatus)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="unpaid">미입금</option>
              <option value="partial">일부 입금</option>
              <option value="paid">입금 완료</option>
            </select>
          </Field>
          <Field label="입금 완료 금액 (원)">
            <Input type="number" min={0} step={10000} value={formData.paidAmount || ""} onChange={(e) => setField("paidAmount", Number(e.target.value) || 0)} placeholder="예: 300000" />
          </Field>
        </div>
      </Section>

      <Section title="진행 단계">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="현재 단계" description="현재 진행 상태를 선택하십시오.">
            <select value={formData.workflowStage} onChange={(e) => setField("workflowStage", e.target.value as WorkflowStage)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="before">강의 전</option>
              <option value="after">강의 후</option>
              <option value="promoted">홍보 완료</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="교육 내용">
        <div className="space-y-4">
          <Field label="교육내용" required error={errors.content} description="인터뷰에서 다른 주요 내용을 상세히 작성해주세요.">
            <Textarea value={formData.content} onChange={(e) => setField("content", e.target.value)} rows={5} placeholder="1부: ...&#10;2부: ..." />
          </Field>
          <Field label="강의소감">
            <Textarea value={formData.reflection} onChange={(e) => setField("reflection", e.target.value)} rows={3} placeholder="강의 전반에 대한 소감..." />
          </Field>
        </div>
      </Section>

      <Section title="문서 생성용 추가 정보" subtitle="결과보고서 블로그 초안 품질을 높이는 정보입니다. 선택 사항입니다.">
        <div className="space-y-4">
          <Field label="참여자 반응" description="현장에서 관찰한 참여자들의 반응, 행동, 분위기를 구체적으로 적어주세요.">
            <Textarea value={formData.participantReaction} onChange={(e) => setField("participantReaction", e.target.value)} rows={3} placeholder="예: 실습 주변에 스스로 화면을 넘기며 따라오셨습니다." />
          </Field>
          <Field label="강사 메모" description="강의 중 떠오른 아이디어, 개선점, 특이사항 등을 적어두세요.">
            <Textarea value={formData.instructorMemo} onChange={(e) => setField("instructorMemo", e.target.value)} rows={3} placeholder="예: 글씨 크기 설정을 먼저 알려드리니 이후 실습이 수월했습니다." />
          </Field>
          <Field label="기억에 남는 질문" description="참여자가 했던 인상적인 질문을 기록해주세요.">
            <Textarea value={formData.memorableQuestion} onChange={(e) => setField("memorableQuestion", e.target.value)} rows={2} placeholder="예: 이거 잘못 누르면 돈 나가는 거 아닌가요?" />
          </Field>
        </div>
      </Section>

      <div className="flex justify-end gap-3 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>취소</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {initialData ? "수정 저장" : "강의 등록"}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="border-b border-border pb-2 text-sm font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
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
      <Label className="text-sm font-medium text-foreground flex items-center">
        {label}
        {required && <span className="ml-0.5 text-destructive font-bold">*</span>}
      </Label>
      {children}
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
