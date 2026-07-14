import { FormEvent, useMemo, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/AuthContext";
import { supabaseConfig } from "@/lib/supabase";

const REQUIRED_MESSAGE = "이메일과 비밀번호를 입력해 주세요.";
const MISSING_CONFIG_MESSAGE = "Supabase 연결 설정이 필요합니다.";
const TOO_MANY_REQUESTS_MESSAGE = "로그인 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
const INVALID_CREDENTIALS_MESSAGE = "이메일 또는 비밀번호를 확인해 주세요.";
const GENERIC_LOGIN_MESSAGE = "로그인 중 오류가 발생했습니다.";

function getLoginMessage(error: string | null): string | null {
  if (!error) return null;

  const normalized = error.toLowerCase();

  if (normalized.includes("supabase") || normalized.includes("environment") || normalized.includes("env")) {
    return MISSING_CONFIG_MESSAGE;
  }

  if (normalized.includes("too many") || normalized.includes("rate limit") || normalized.includes("over_email_send_rate_limit")) {
    return TOO_MANY_REQUESTS_MESSAGE;
  }

  if (
    normalized.includes("invalid") ||
    normalized.includes("credentials") ||
    normalized.includes("email") ||
    normalized.includes("password") ||
    normalized.includes("login")
  ) {
    return INVALID_CREDENTIALS_MESSAGE;
  }

  return GENERIC_LOGIN_MESSAGE;
}

export default function LoginPage() {
  const { authError, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const configMissing = !supabaseConfig.ready;
  const visibleError = useMemo(() => {
    if (configMissing) return MISSING_CONFIG_MESSAGE;
    return formError ?? getLoginMessage(authError);
  }, [authError, configMissing, formError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setFormError(REQUIRED_MESSAGE);
      return;
    }

    if (configMissing) {
      setFormError(MISSING_CONFIG_MESSAGE);
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const result = await signIn(trimmedEmail, password);
      if (result.error) {
        setFormError(getLoginMessage(result.error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md rounded-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-2xl">강의 아카이브</CardTitle>
            <CardDescription>등록된 계정으로 로그인해 주세요.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="login-email">이메일</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setFormError(null);
                }}
                disabled={submitting || configMissing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">비밀번호</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFormError(null);
                }}
                disabled={submitting || configMissing}
              />
            </div>

            {visibleError && (
              <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {visibleError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting || configMissing}>
              {submitting ? (
                <>
                  <Spinner className="h-4 w-4" />
                  로그인 중
                </>
              ) : (
                "로그인"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
