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

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { Sidebar } from "./components/Sidebar";
import { ThemeProvider } from "./contexts/ThemeContext";

import BlogPage from "./pages/BlogPage";
import CalendarPage from "./pages/CalendarPage";
import Dashboard from "./pages/Dashboard";
import LectureDetail from "./pages/LectureDetail";
import LectureFormPage from "./pages/LectureFormPage";
import LectureList from "./pages/LectureList";
import ReportPage from "./pages/ReportPage";
import SearchPage from "./pages/SearchPage";
import TodoPage from "./pages/TodoPage";
import WorkflowPage from "./pages/WorkflowPage";
import LectureManagePage from "./pages/LectureManagePage";

function Router() {
  return (
    <Switch>
      {/* 메인 */}
      <Route path="/" component={Dashboard} />

      {/* V2 신규 */}
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/todos" component={TodoPage} />
      <Route path="/workflow" component={WorkflowPage} />

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

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" richColors />

          {/*
           * 전체 레이아웃
           * - 데스크탑: flex row (사이드바 + 메인)
           * - 모바일: flex col (헤더 + 메인 + 하단탭)
           *   Sidebar 컴포넌트가 모바일 헤더와 하단탭을 모두 렌더링
           */}
          <div className="flex h-screen overflow-hidden bg-background">
            {/* 데스크탑 사이드바 + 모바일 헤더/하단탭 */}
            <Sidebar />

            {/* 메인 콘텐츠 — 모바일: 상단 헤더(56px) + 하단탭(64px) 제외한 높이 */}
            <main className="
              flex-1 min-w-0
              overflow-y-auto
              pt-14 pb-16
              lg:pt-0 lg:pb-0
            ">
              <Router />
            </main>
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
