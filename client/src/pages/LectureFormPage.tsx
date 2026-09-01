import { LectureForm } from "@/components/LectureForm";
import { Button } from "@/components/ui/button";
import { useLectures } from "@/hooks/useLectures";
import type { Lecture, LectureFormData } from "@/types/lecture";
import { ArrowLeft, CalendarDays, Eye, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams, useSearch } from "wouter";

export default function LectureFormPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const search = useSearch();
  const queryDate = new URLSearchParams(search).get("date") || "";
  const { addLecture, addRecurringLectures, updateLecture, getLectureById, loading } = useLectures();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [lastCreatedLecture, setLastCreatedLecture] = useState<Lecture | null>(null);
  const [lastCreatedCount, setLastCreatedCount] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const isEdit = Boolean(params.id);
  const lecture = isEdit && params.id ? getLectureById(params.id) : undefined;

  const lectureDrawerPath = (id: string, action: "detail" | "edit" = "detail") =>
    `/lectures?selectedLectureId=${encodeURIComponent(id)}${action === "edit" ? "&action=edit" : ""}`;

  const handleSubmit = async (data: LectureFormData, recurringList?: LectureFormData[]) => {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setLastCreatedLecture(null);
    setLastCreatedCount(0);

    try {
      if (isEdit && params.id) {
        await updateLecture(params.id, data);
        toast.success("강의 정보를 수정했습니다.");
        navigate(lectureDrawerPath(params.id), { replace: true });
        return;
      }

      const createItems = recurringList && recurringList.length > 0 ? recurringList : [data];

      const createdLectures = createItems.length > 1
        ? await addRecurringLectures(createItems)
        : [
            await addLecture({
              ...createItems[0],
              workflowStage: "before",
            }),
          ];
      const firstCreated = createdLectures[0] ?? null;

      setLastCreatedLecture(firstCreated);
      setLastCreatedCount(createdLectures.length);
      if (queryDate) navigate("/lectures/new", { replace: true });
      setFormKey((key) => key + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Failed to submit lecture form", err);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const resetForNextLecture = () => {
    setLastCreatedLecture(null);
    setLastCreatedCount(0);
    if (queryDate) navigate("/lectures/new", { replace: true });
    setFormKey((key) => key + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 초기 로드 중에는 lectures가 비어 있어 조회가 실패한다.
  // 아직 모르는 것과 실제로 없는 것을 구분한다.
  if (isEdit && loading && !lecture) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <p className="text-muted-foreground">강의를 불러오는 중입니다…</p>
      </div>
    );
  }

  if (isEdit && !lecture) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <p className="text-muted-foreground">강의를 찾을 수 없습니다.</p>
        <Button variant="link" onClick={() => navigate("/lectures")} className="mt-4">
          강의 목록으로 돌아가기
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-4 sm:px-6 sm:py-5">
      <button
        onClick={() => navigate(isEdit && params.id ? lectureDrawerPath(params.id) : "/lectures")}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {isEdit ? "상세 패널로 돌아가기" : "강의 목록으로 돌아가기"}
      </button>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">{isEdit ? "강의 수정" : "강의 등록"}</h1>
      </div>

      {!isEdit && lastCreatedLecture && (
        <section className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <p className="font-semibold">{lastCreatedCount > 1 ? `${lastCreatedCount}개의 반복 강의가 등록되었습니다.` : "강의가 등록되었습니다."}</p>
          <p className="mt-1 text-green-800">
            계속 새 강의를 입력하거나, 방금 등록한 강의를 확인할 수 있습니다.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={resetForNextLecture}>
              <Plus className="mr-1.5 h-4 w-4" />
              새 강의 계속 등록
            </Button>
            <Button type="button" size="sm" onClick={() => navigate(lectureDrawerPath(lastCreatedLecture.id))}>
              <Eye className="mr-1.5 h-4 w-4" />
              방금 등록한 강의 보기
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/calendar?date=${lastCreatedLecture.date}&status=before&selectedLectureId=${lastCreatedLecture.id}`)}
            >
              <CalendarDays className="mr-1.5 h-4 w-4" />
              캘린더에서 보기
            </Button>
          </div>
        </section>
      )}

      <LectureForm
        key={formKey}
        initialData={lecture}
        defaultDate={queryDate}
        onSubmit={handleSubmit}
        onCancel={() => navigate(isEdit && params.id ? lectureDrawerPath(params.id) : "/lectures")}
        isSubmitting={isSubmitting}
        submitLabel={isEdit ? "정보 저장" : "강의 등록"}
      />
    </div>
  );
}
