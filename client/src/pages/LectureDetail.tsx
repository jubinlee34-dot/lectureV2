import { useEffect } from "react";
import { useLocation, useParams } from "wouter";

export default function LectureDetail() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    const target = id ? `/lectures?selectedLectureId=${encodeURIComponent(id)}` : "/lectures";
    navigate(target, { replace: true });
  }, [id, navigate]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10 text-center">
      <p className="text-sm text-muted-foreground">강의 상세는 강의목록의 상세 패널로 연결됩니다.</p>
    </div>
  );
}
