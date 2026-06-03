/**
 * 강의 아카이브 V2 - 가져오기 모달 컴포넌트
 *
 * CSV (구글 스프레드시트) 또는 ICS (구글 캘린더) 파일을 업로드하여
 * 강의 데이터를 앱으로 가져옵니다.
 *
 * 흐름: 파일 선택 → 파싱 미리보기 → 중복 처리 선택 → 가져오기 확정
 */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseCSVToLectures, parseICSToLectures } from "@/utils/exportUtils";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Loader2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Lecture, LectureFormData } from "../types/lecture";

type ImportType = "csv" | "ics";
type DuplicatePolicy = "skip" | "overwrite" | "add";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  /** 가져온 강의를 앱에 추가하는 콜백 */
  onImport: (lectures: LectureFormData[], policy: DuplicatePolicy) => void;
  /** 기존 강의 목록 (중복 감지용) */
  existingLectures: Lecture[];
  defaultType?: ImportType;
}

type Step = "select" | "preview" | "done";

export function ImportModal({ open, onClose, onImport, existingLectures, defaultType }: ImportModalProps) {
  const [step, setStep] = useState<Step>("select");
  const [importType, setImportType] = useState<ImportType>(defaultType ?? "csv");

  useEffect(() => {
    if (open) {
      setImportType(defaultType ?? "csv");
    }
  }, [open, defaultType]);
  const [parsed, setParsed] = useState<LectureFormData[]>([]);
  const [duplicates, setDuplicates] = useState<number>(0);
  const [policy, setPolicy] = useState<DuplicatePolicy>("skip");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("select");
    setParsed([]);
    setDuplicates(0);
    setError("");
    setLoading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  /** 파일 선택 시 파싱 */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const text = await file.text();
      let items: LectureFormData[];

      if (importType === "csv") {
        items = parseCSVToLectures(text) as LectureFormData[];
      } else {
        items = parseICSToLectures(text) as LectureFormData[];
      }

      // 중복 감지: 같은 날짜 + 교육명이 이미 존재하는 경우
      const dupCount = items.filter((item) =>
        existingLectures.some(
          (ex) => ex.date === item.date && ex.title === item.title
        )
      ).length;

      setParsed(items);
      setDuplicates(dupCount);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "파일을 읽는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  /** 가져오기 확정 */
  const handleConfirm = () => {
    onImport(parsed, policy);
    setStep("done");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            강의 데이터 가져오기
          </DialogTitle>
        </DialogHeader>

        {/* ── STEP 1: 파일 선택 ── */}
        {step === "select" && (
          <div className="space-y-4">
            {/* 형식 선택 탭 */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setImportType("csv")}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                  importType === "csv"
                    ? "border-green-500 bg-green-50"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <FileSpreadsheet className={`h-5 w-5 shrink-0 ${importType === "csv" ? "text-green-600" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium">CSV 파일</p>
                  <p className="text-xs text-muted-foreground">구글 스프레드시트</p>
                </div>
              </button>
              <button
                onClick={() => setImportType("ics")}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                  importType === "ics"
                    ? "border-blue-500 bg-blue-50"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <Calendar className={`h-5 w-5 shrink-0 ${importType === "ics" ? "text-blue-600" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium">ICS 파일</p>
                  <p className="text-xs text-muted-foreground">구글 캘린더</p>
                </div>
              </button>
            </div>

            {/* 안내 박스 */}
            <div className={`rounded-lg p-3 text-xs space-y-1 ${importType === "csv" ? "bg-green-50 text-green-800" : "bg-blue-50 text-blue-800"}`}>
              {importType === "csv" ? (
                <>
                  <p className="font-semibold">구글 스프레드시트 → CSV 내보내기 방법</p>
                  <p>1. 구글 스프레드시트 열기</p>
                  <p>2. 파일 → 다운로드 → <strong>쉼표로 구분된 값(.csv)</strong> 선택</p>
                  <p>3. 다운로드된 .csv 파일을 아래에 업로드</p>
                  <p className="mt-1 text-green-700">강의 아카이브에서 내보낸 CSV 파일도 지원합니다.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold">구글 캘린더 → ICS 내보내기 방법</p>
                  <p>1. 구글 캘린더 → 설정(톱니바퀴) → 설정</p>
                  <p>2. 좌측 메뉴 → 가져오기/내보내기</p>
                  <p>3. <strong>내보내기</strong> 클릭 → .ics 파일 다운로드</p>
                  <p>4. 다운로드된 .ics 파일을 아래에 업로드</p>
                </>
              )}
            </div>

            {/* 파일 업로드 영역 */}
            <label
              htmlFor="import-file"
              className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
            >
              {loading ? (
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              ) : (
                <FileUp className="h-8 w-8 text-muted-foreground" />
              )}
              <p className="text-sm font-medium text-foreground">
                {loading ? "파일 분석 중..." : "파일을 클릭하여 선택"}
              </p>
              <p className="text-xs text-muted-foreground">
                {importType === "csv" ? ".csv 파일" : ".ics 파일"}
              </p>
              <input
                id="import-file"
                ref={fileRef}
                type="file"
                accept={importType === "csv" ? ".csv,text/csv" : ".ics,text/calendar"}
                className="hidden"
                onChange={handleFileChange}
                disabled={loading}
              />
            </label>

            {/* 오류 메시지 */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: 미리보기 ── */}
        {step === "preview" && (
          <div className="space-y-4">
            {/* 파싱 결과 요약 */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {parsed.length}개의 강의를 발견했습니다.
                </p>
                {duplicates > 0 && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    {duplicates}개는 이미 등록된 강의와 날짜·교육명이 동일합니다.
                  </p>
                )}
              </div>
            </div>

            {/* 미리보기 목록 */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {parsed.slice(0, 20).map((l, i) => {
                const isDup = existingLectures.some(
                  (ex) => ex.date === l.date && ex.title === l.title
                );
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                      isDup ? "border-amber-200 bg-amber-50" : "border-border bg-card"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{l.title || "제목 없음"}</p>
                      <p className="text-muted-foreground">{l.organization} · {l.date}</p>
                    </div>
                    {isDup && (
                      <span className="shrink-0 ml-2 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                        중복
                      </span>
                    )}
                  </div>
                );
              })}
              {parsed.length > 20 && (
                <p className="text-xs text-center text-muted-foreground py-1">
                  +{parsed.length - 20}개 더...
                </p>
              )}
            </div>

            {/* 중복 처리 정책 */}
            {duplicates > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">중복 강의 처리 방법</p>
                <div className="space-y-1.5">
                  {(
                    [
                      { value: "skip", label: "건너뛰기", desc: "이미 있는 강의는 가져오지 않습니다." },
                      { value: "overwrite", label: "덮어쓰기", desc: "이미 있는 강의를 새 데이터로 교체합니다." },
                      { value: "add", label: "모두 추가", desc: "중복 여부와 관계없이 모두 추가합니다." },
                    ] as { value: DuplicatePolicy; label: string; desc: string }[]
                  ).map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        policy === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <input
                        type="radio"
                        name="policy"
                        value={opt.value}
                        checked={policy === opt.value}
                        onChange={() => setPolicy(opt.value)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-xs font-medium text-foreground">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 액션 버튼 */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1" onClick={reset}>
                <X className="h-4 w-4 mr-1" />
                다시 선택
              </Button>
              <Button size="sm" className="flex-1" onClick={handleConfirm}>
                <FileUp className="h-4 w-4 mr-1" />
                {parsed.length}개 가져오기
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: 완료 ── */}
        {step === "done" && (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <p className="text-base font-semibold text-foreground">가져오기 완료!</p>
            <p className="text-sm text-muted-foreground">
              {parsed.length}개의 강의가 성공적으로 추가되었습니다.
            </p>
            <Button onClick={handleClose} className="mt-2">
              확인
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
