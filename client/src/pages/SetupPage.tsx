import { Button } from "@/components/ui/button";
import { supabase, supabaseConfig } from "@/lib/supabase";
import { useSupabase } from "@/contexts/SupabaseContext";
import { CheckCircle2, Clipboard, ExternalLink, Loader2, XCircle, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type SetupStatus = "normal" | "missing" | "error";

interface NaverHealthResponse {
  configured: boolean;
  error?: string;
}

const REQUIRED_ENV_NAMES = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "NAVER_CLIENT_ID",
  "NAVER_CLIENT_SECRET",
];

export default function SetupPage() {
  const { profile, loading, error } = useSupabase();
  const [supabaseStatus, setSupabaseStatus] = useState<SetupStatus>(
    supabaseConfig.ready ? "missing" : "missing"
  );
  const [supabaseMessage, setSupabaseMessage] = useState("확인 중입니다.");
  const [naverStatus, setNaverStatus] = useState<SetupStatus>("missing");
  const [naverMessage, setNaverMessage] = useState("확인 중입니다.");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkSetup() {
      setChecking(true);
      await Promise.all([checkSupabase(mounted), checkNaver(mounted)]);
      if (mounted) setChecking(false);
    }

    void checkSetup();

    return () => {
      mounted = false;
    };
  }, []);

  const profileStatus = useMemo((): SetupStatus => {
    if (loading) return "missing";
    if (error) return "error";
    if (!profile) return "missing";
    return profile.name || profile.phone || profile.email ? "normal" : "missing";
  }, [error, loading, profile]);

  const addressStatus = useMemo((): SetupStatus => {
    if (loading) return "missing";
    if (error) return "error";
    return profile?.homeAddress?.trim() ? "normal" : "missing";
  }, [error, loading, profile?.homeAddress]);

  async function checkSupabase(mounted: boolean) {
    if (!supabaseConfig.urlSet || !supabaseConfig.anonKeySet) {
      if (!mounted) return;
      setSupabaseStatus("missing");
      setSupabaseMessage("VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY가 설정되지 않았습니다.");
      return;
    }

    try {
      const { error: queryError } = await supabase.from("lectures").select("id").limit(1);
      if (!mounted) return;
      if (queryError) {
        setSupabaseStatus("error");
        setSupabaseMessage(queryError.message);
        return;
      }
      setSupabaseStatus("normal");
      setSupabaseMessage("Supabase 연결이 정상입니다.");
    } catch (supabaseError) {
      if (!mounted) return;
      setSupabaseStatus("error");
      setSupabaseMessage(supabaseError instanceof Error ? supabaseError.message : "Supabase 연결 확인에 실패했습니다.");
    }
  }

  async function checkNaver(mounted: boolean) {
    try {
      const response = await fetch("/api/naver-directions?health=1");
      const body = (await response.json().catch(() => ({}))) as NaverHealthResponse;
      if (!mounted) return;

      if (!response.ok) {
        setNaverStatus("error");
        setNaverMessage(body.error || "네이버 API 설정 확인에 실패했습니다.");
        return;
      }

      if (!body.configured) {
        setNaverStatus("missing");
        setNaverMessage("NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 서버 환경변수에 없습니다.");
        return;
      }

      setNaverStatus("normal");
      setNaverMessage("네이버 API 서버 환경변수가 설정되어 있습니다.");
    } catch (naverError) {
      if (!mounted) return;
      setNaverStatus("error");
      setNaverMessage(naverError instanceof Error ? naverError.message : "네이버 API 설정 확인에 실패했습니다.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">설정 점검</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            배포 후 필요한 환경변수와 기본 프로필 설정을 한곳에서 확인합니다.
          </p>
        </div>
        <Button variant="outline" onClick={() => copyText(REQUIRED_ENV_NAMES.join("\n"), "환경변수 이름을 복사했습니다.")}>
          <Clipboard className="mr-1.5 h-4 w-4" />
          필수 환경변수 복사
        </Button>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Vercel Environment Variables</h2>
          <a
            href="https://vercel.com/docs/projects/environment-variables"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Vercel 문서
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {REQUIRED_ENV_NAMES.map((name) => (
            <button
              key={name}
              onClick={() => copyText(name, `${name}을 복사했습니다.`)}
              className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-left font-mono text-xs hover:border-primary/40"
            >
              <span>{name}</span>
              <Clipboard className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Supabase 두 값은 프론트엔드에서 사용하는 공개 클라이언트 설정입니다. 네이버 두 값은 서버 API 라우트에서만 읽으며,
          앱 화면에 입력하거나 Supabase에 저장하지 않습니다.
        </p>
      </div>

      <div className="grid gap-3">
        <SetupRow
          title="Supabase 연결"
          status={supabaseStatus}
          message={supabaseMessage}
          action="Vercel Project Settings > Environment Variables에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 입력하세요."
        />
        <SetupRow
          title="네이버 API 환경변수"
          status={naverStatus}
          message={naverMessage}
          action="Vercel Project Settings > Environment Variables에 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET을 입력하세요."
        />
        <SetupRow
          title="강사 프로필"
          status={profileStatus}
          message={
            loading
              ? "프로필을 불러오는 중입니다."
              : error
                ? error
                : profileStatus === "normal"
                  ? "강사 프로필 기본 정보가 입력되어 있습니다."
                  : "강사 이름, 전화번호 또는 이메일이 아직 입력되지 않았습니다."
          }
          action="왼쪽 메뉴의 강사 프로필 페이지에서 이름, 연락처, 이메일을 입력하세요."
        />
        <SetupRow
          title="집 주소"
          status={addressStatus}
          message={
            loading
              ? "프로필을 불러오는 중입니다."
              : error
                ? error
                : addressStatus === "normal"
                  ? "출발지로 사용할 집 주소가 입력되어 있습니다."
                  : "길찾기 출발지로 사용할 집 주소가 없습니다."
          }
          action="강사 프로필 페이지에서 출발 주소를 입력하세요. 거리/시간 계산의 출발지로 사용됩니다."
        />
      </div>

      {checking && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          설정 상태를 확인하는 중입니다.
        </div>
      )}
    </div>
  );
}

function SetupRow({
  title,
  status,
  message,
  action,
}: {
  title: string;
  status: SetupStatus;
  message: string;
  action: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusIcon status={status} />
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          {status !== "normal" && <p className="mt-2 text-xs leading-relaxed text-foreground/80">{action}</p>}
        </div>
        <StatusBadge status={status} />
      </div>
    </section>
  );
}

function StatusIcon({ status }: { status: SetupStatus }) {
  if (status === "normal") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-red-600" />;
  return <AlertTriangle className="h-4 w-4 text-amber-600" />;
}

function StatusBadge({ status }: { status: SetupStatus }) {
  const config = {
    normal: "정상",
    missing: "미설정",
    error: "오류",
  } satisfies Record<SetupStatus, string>;

  const className = {
    normal: "border-green-200 bg-green-50 text-green-700",
    missing: "border-amber-200 bg-amber-50 text-amber-700",
    error: "border-red-200 bg-red-50 text-red-700",
  } satisfies Record<SetupStatus, string>;

  return (
    <span className={`inline-flex shrink-0 items-center rounded-md border px-2 py-1 text-xs font-semibold ${className[status]}`}>
      {config[status]}
    </span>
  );
}

async function copyText(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error("복사에 실패했습니다.");
  }
}
