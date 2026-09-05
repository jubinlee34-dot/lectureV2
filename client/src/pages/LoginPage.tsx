import { useMemo, useState } from "react";
import type { FormEvent } from "react";
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
const GOOGLE_LOGIN_MESSAGE = "Google 로그인 중 오류가 발생했습니다.";

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
  const { authError, signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
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

  async function handleGoogleSignIn() {
    if (configMissing) {
      setFormError(MISSING_CONFIG_MESSAGE);
      return;
    }

    setGoogleSubmitting(true);
    setFormError(null);

    try {
      const result = await signInWithGoogle();
      if (result.error) {
        setFormError(GOOGLE_LOGIN_MESSAGE);
      }
    } finally {
      setGoogleSubmitting(false);
    }
  }

  const loginPending = submitting || googleSubmitting;

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
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={loginPending || configMissing}
          >
            {googleSubmitting ? <Spinner className="h-4 w-4" /> : <GoogleIcon />}
            {googleSubmitting ? "Google로 이동 중" : "Google로 로그인"}
          </Button>

          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">또는 이메일로 로그인</span>
            <div className="h-px flex-1 bg-border" />
          </div>

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
                disabled={loginPending || configMissing}
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
                disabled={loginPending || configMissing}
              />
            </div>

            {visibleError && (
              <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {visibleError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loginPending || configMissing}>
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

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
      />
      <path
        fill="currentColor"
        d="M12 22c2.7 0 4.98-.9 6.64-2.36l-3.24-2.54c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="currentColor"
        d="M6.39 13.93a6.01 6.01 0 0 1 0-3.86V7.45H3.04a10 10 0 0 0 0 9.1l3.35-2.62Z"
      />
      <path
        fill="currentColor"
        d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"
      />
    </svg>
  );
}
