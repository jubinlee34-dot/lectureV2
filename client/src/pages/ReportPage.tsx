import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLectures } from "@/hooks/useLectures";
import { generateReport } from "@/utils/templates";
import { ArrowLeft, Check, Copy, FileText, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

export default function ReportPage() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  const { getLectureById } = useLectures();
  const lecture = getLectureById(id);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const returnTo = useMemo(() => sanitizeReturnTo(new URLSearchParams(window.location.search).get("returnTo")), []);

  useEffect(() => {
    if (lecture) setText(generateReport(lecture));
  }, [lecture]);

  const goBack = () => {
    if (returnTo) {
      navigate(returnTo);
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    navigate("/calendar");
  };

  if (!lecture) return <Missing onBack={goBack} />;

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("보고서를 클립보드에 복사했습니다.");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
      <button onClick={goBack} className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        돌아가기
      </button>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <FileText className="h-6 w-6 text-primary" />
          결과보고서
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{lecture.title} 보고서 초안입니다.</p>
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[500px] font-mono text-sm leading-relaxed" />
      <div className="mt-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setText(generateReport(lecture))}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          재생성
        </Button>
        <Button size="sm" onClick={copy}>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          전체 복사
        </Button>
      </div>
    </div>
  );
}

function sanitizeReturnTo(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function Missing({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto max-w-3xl p-6 text-center">
      <p className="text-muted-foreground">강의를 찾을 수 없습니다.</p>
      <button onClick={onBack} className="mt-4 text-sm text-primary hover:underline">
        돌아가기
      </button>
    </div>
  );
}
