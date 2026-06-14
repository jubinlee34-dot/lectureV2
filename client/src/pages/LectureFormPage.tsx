import { LectureForm } from "@/components/LectureForm";
import { useLectures } from "@/hooks/useLectures";
import type { LectureFormData } from "@/types/lecture";
import { ArrowLeft } from "lucide-react";
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
  const isEdit = Boolean(params.id);
  const lecture = isEdit && params.id ? getLectureById(params.id) : undefined;

  const handleSubmit = async (data: LectureFormData, recurringList?: LectureFormData[]) => {
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 150));
    try {
      if (isEdit && params.id) {
        await updateLecture(params.id, data);
        toast.success("강의를 수정했습니다.");
        navigate(`/lectures/${params.id}`);
      } else {
        if (recurringList && recurringList.length > 0) {
          let firstCreatedId = "";
          for (let i = 0; i < recurringList.length; i++) {
            const created = await addLecture(recurringList[i]);
            if (i === 0) firstCreatedId = created.id;
          }
          toast.success(`${recurringList.length}개의 반복 강의를 등록했습니다.`);
          if (firstCreatedId) {
            navigate(`/lectures/${firstCreatedId}/manage`);
          } else {
            navigate("/lectures");
          }
        } else {
          const created = await addLecture(data);
          toast.success("강의를 등록했습니다.");
          navigate(`/lectures/${created.id}/manage`);
        }
      }
    } catch (err) {
      console.error("Failed to submit lecture form", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEdit && !lecture) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <p className="text-muted-foreground">강의를 찾을 수 없습니다.</p>
        <button onClick={() => navigate("/lectures")} className="mt-4 text-sm text-primary hover:underline">
          강의 목록으로 돌아가기
        </button>
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
          강의 기본 정보와 담당자, 강의 전후 관리에 필요한 내용을 입력합니다.
        </p>
      </div>
      <LectureForm
        initialData={lecture}
        defaultDate={queryDate}
        onSubmit={handleSubmit}
        onCancel={() => navigate(isEdit && params.id ? `/lectures/${params.id}` : "/lectures")}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
