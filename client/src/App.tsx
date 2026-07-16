/**
 * 강의 아카이브 V2 - 앱 루트 컴포넌트
 *
 * V2 추가 라우트:
 * - /calendar   : 강의 캘린더
 * - /todos      : 할일 관리
 * - /workflow   : 강의 워크플로우 (강의전/강의후/홍보)
 *
 * 레이아웃 구조:
 * - 데스크탑(lg+): 좌측 고정 사이드바 + 우측 스크롤 가능한 메인 영역
 * - 모바일: 상단 fixed 헤더 + 하단 탭 네비게이션 + 메인 콘텐츠
 */

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation, useSearch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { Sidebar } from "./components/Sidebar";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SupabaseProvider } from "./contexts/SupabaseContext";

import BlogPage from "./pages/BlogPage";
import CalendarPage from "./pages/CalendarPage";
import Dashboard from "./pages/Dashboard";
import LectureDetail from "./pages/LectureDetail";
import LectureFormPage from "./pages/LectureFormPage";
import LectureList from "./pages/LectureList";
import ReportPage from "./pages/ReportPage";
import SearchPage from "./pages/SearchPage";
import SetupPage from "./pages/SetupPage";
import TodoPage from "./pages/TodoPage";
import LectureManagePage from "./pages/LectureManagePage";
import InstructorProfilePage from "./pages/InstructorProfilePage";
import LoginPage from "./pages/LoginPage";

function WorkflowRedirect() {
  const [, navigate] = useLocation();
  const search = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const stage = params.get("stage");
    const target =
      stage === "before" || stage === "after" || stage === "promoted"
        ? `/calendar?status=${stage}`
        : "/calendar";
    navigate(target, { replace: true });
  }, [navigate, search]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10 text-center">
      <p className="text-sm text-muted-foreground">워크플로우 화면은 캘린더 운영 화면으로 통합되었습니다.</p>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* 메인 */}
      <Route path="/" component={Dashboard} />

      {/* V2 신규 */}
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/todos" component={TodoPage} />
      <Route path="/workflow" component={WorkflowRedirect} />
      <Route path="/profile" component={InstructorProfilePage} />
      <Route path="/setup" component={SetupPage} />

      {/* 강의 관리 */}
      <Route path="/lectures" component={LectureList} />
      <Route path="/lectures/new" component={LectureFormPage} />
      <Route path="/lectures/:id/edit" component={LectureFormPage} />
      <Route path="/lectures/:id/report" component={ReportPage} />
      <Route path="/lectures/:id/blog" component={BlogPage} />
      <Route path="/lectures/:id/manage" component={LectureManagePage} />
      <Route path="/lectures/:id" component={LectureDetail} />

      {/* 검색 */}
      <Route path="/search" component={SearchPage} />

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthLoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <p className="text-sm text-muted-foreground">로그인 상태를 확인하고 있습니다.</p>
    </main>
  );
}

function AuthGate() {
  const { loading, session } = useAuth();

  if (loading) return <AuthLoadingScreen />;
  if (!session) return <LoginPage />;

  return (
    <SupabaseProvider>
      <AuthenticatedApp />
    </SupabaseProvider>
  );
}

function AuthenticatedApp() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem("sidebarOpen");
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem("sidebarOpen", String(sidebarOpen));
  }, [sidebarOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-background max-w-full overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <main className="
        flex-1 min-w-0
        overflow-y-auto
        pt-14 pb-16
        lg:pt-0 lg:pb-0
        max-w-full overflow-x-hidden relative
      ">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="hidden lg:flex fixed left-4 top-4 z-40 h-8 w-8 items-center justify-center rounded-lg border border-border bg-card shadow-md hover:bg-muted text-muted-foreground transition-all duration-200"
            title="메뉴 열기"
          >
            <ChevronRight className="h-4.5 w-4.5" />
          </button>
        )}
        <Router />
      </main>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
