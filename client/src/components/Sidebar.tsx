import { cn } from "@/lib/utils";
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  LayoutDashboard,
  MoreHorizontal,
  PenLine,
  Search,
  Settings,
  User,
  Workflow,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

const navItems = [
  { path: "/", label: "대시보드", icon: LayoutDashboard, group: "main" },
  { path: "/calendar", label: "캘린더", icon: CalendarDays, group: "main" },
  { path: "/workflow", label: "워크플로우", icon: Workflow, group: "main" },
  { path: "/todos", label: "할 일", icon: CheckSquare, group: "main" },
  { path: "/lectures", label: "강의 목록", icon: BookOpen, group: "sub" },
  { path: "/search", label: "검색", icon: Search, group: "sub" },
  { path: "/lectures/new", label: "강의 등록", icon: PenLine, group: "sub" },
  { path: "/profile", label: "강사 프로필", icon: User, group: "sub" },
  { path: "/setup", label: "설정 점검", icon: Settings, group: "sub" },
];

const tabItems = navItems.slice(0, 4);

export function Sidebar({
  className,
  isOpen = true,
  setIsOpen,
}: {
  className?: string;
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}) {
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (path: string) => (path === "/" ? location === "/" : location.startsWith(path));

  const content = (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border px-5 py-6">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary">
              <BookOpen className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none text-foreground">강의 아카이브</p>
              <p className="mt-0.5 text-[10px] leading-none text-muted-foreground">강의 전후 기록 관리</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen?.(false)}
            className="hidden lg:flex rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground border-none outline-none cursor-pointer"
            title="메뉴 접기"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {["main", "sub"].map((group) => (
          <div key={group} className="mb-4 space-y-0.5">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group === "main" ? "주요 메뉴" : "강의 관리"}
            </p>
            {navItems
              .filter((item) => item.group === group)
              .map(({ path, label, icon: Icon }) => {
                const active = isActive(path);
                return (
                  <Link
                    key={path}
                    href={path}
                    onClick={() => setDrawerOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{label}</span>
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      <aside className={cn(
        "hidden h-screen w-60 shrink-0 border-r border-border bg-sidebar",
        isOpen ? "lg:flex" : "lg:hidden",
        className
      )}>
        {content}
      </aside>
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-sm lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
            <BookOpen className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-bold text-foreground">강의 아카이브</span>
        </div>
        <button
          onClick={() => setDrawerOpen((open) => !open)}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="메뉴 열기"
        >
          {drawerOpen ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}
        </button>
      </header>
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-stretch border-t border-border bg-background/95 backdrop-blur-sm lg:hidden">
        {tabItems.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            href={path}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium",
              isActive(path) ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div className="relative h-full w-72 max-w-[85vw] border-r border-border bg-sidebar shadow-xl">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
