import { LectureForm } from "@/components/LectureForm";
import { Button } from "@/components/ui/button";
import { useLectures } from "@/hooks/useLectures";
import type { Lecture, LectureFormData } from "@/types/lecture";
import { ArrowLeft, CalendarDays, Eye, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams, useSearch } from "wouter";

export default function LectureFormPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const search = useSearch();
  const queryDate = new URLSearchParams(search).get("date") || "";
  const { addLecture, updateLecture, getLectureById } = useLectures();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastCreatedLecture, setLastCreatedLecture] = useState<Lecture | null>(null);
  const [formKey, setFormKey] = useState(0);
  const isEdit = Boolean(params.id);
  const lecture = isEdit && params.id ? getLectureById(params.id) : undefined;

  const handleSubmit = async (data: LectureFormData, recurringList?: LectureFormData[]) => {
    setIsSubmitting(true);
    setLastCreatedLecture(null);

    try {
      if (isEdit && params.id) {
        await updateLecture(params.id, data);
        toast.success("강의 정보를 수정했습니다.");
        return;
      }

      let firstCreated: Lecture | null = null;
      const createItems = recurringList && recurringList.length > 0 ? recurringList : [data];

      for (let index = 0; index < createItems.length; index += 1) {
        const created = await addLecture({
          ...createItems[index],
          workflowStage: "before",
        });
        if (index === 0) firstCreated = created;
      }

      setLastCreatedLecture(firstCreated);
      toast.success(
        createItems.length > 1
          ? `${createItems.length}개의 반복 강의가 등록되었습니다.`
          : "강의가 등록되었습니다."
      );
    } catch (err) {
      console.error("Failed to submit lecture form", err);
      toast.error("강의 저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForNextLecture = () => {
    setLastCreatedLecture(null);
    setFormKey((key) => key + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
    <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-6">
      <button
        onClick={() => navigate(isEdit && params.id ? `/lectures/${params.id}` : "/lectures")}
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {isEdit ? "상세보기로 돌아가기" : "강의 목록으로 돌아가기"}
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{isEdit ? "강의 수정" : "강의 등록"}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          기본 정보, 일정/장소, 담당자, 준비 메모를 등록합니다.
        </p>
      </div>

      {!isEdit && lastCreatedLecture && (
        <section className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <p className="font-semibold">강의가 등록되었습니다.</p>
          <p className="mt-1 text-green-800">자동으로 업무관리나 강의목록으로 이동하지 않습니다. 다음 작업을 선택해 주세요.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={resetForNextLecture}>
              <Plus className="mr-1.5 h-4 w-4" />
              새 강의 계속 등록
            </Button>
            <Button type="button" size="sm" onClick={() => navigate(`/lectures/${lastCreatedLecture.id}`)}>
              <Eye className="mr-1.5 h-4 w-4" />
              방금 등록한 강의 보기
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/calendar?date=${lastCreatedLecture.date}&status=before`)}
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
        onCancel={() => navigate(isEdit && params.id ? `/lectures/${params.id}` : "/lectures")}
        isSubmitting={isSubmitting}
        submitLabel={isEdit ? "정보 저장" : "강의 등록"}
      />
    </div>
  );
}
