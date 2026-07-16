import { cn } from "@/lib/utils";
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  PenLine,
  Search,
  Settings,
  User,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";

const navItems = [
  { path: "/", label: "대시보드", icon: LayoutDashboard, group: "main" },
  { path: "/calendar", label: "캘린더", icon: CalendarDays, group: "main" },
  { path: "/lectures", label: "강의목록", icon: BookOpen, group: "main" },
  { path: "/todos", label: "할 일", icon: CheckSquare, group: "main" },
  { path: "/lectures/new", label: "강의 등록", icon: PenLine, group: "sub" },
  { path: "/search", label: "검색", icon: Search, group: "sub" },
  { path: "/profile", label: "강사 프로필", icon: User, group: "sub" },
  { path: "/setup", label: "설정 점검", icon: Settings, group: "sub" },
];

const tabItems = navItems.filter((item) => item.group === "main");

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
  const [signingOut, setSigningOut] = useState(false);
  const signingOutRef = useRef(false);
  const { user, signOut } = useAuth();
  const userEmail = user?.email?.trim() || "로그인 사용자";

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    if (path === "/lectures") return location === "/lectures" || location.startsWith("/lectures/");
    return location.startsWith(path);
  };

  const handleSignOut = async () => {
    if (signingOutRef.current) return;

    signingOutRef.current = true;
    setSigningOut(true);
    try {
      const result = await signOut();
      if (result.error) {
        toast.error("로그아웃에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      toast.error("로그아웃에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      signingOutRef.current = false;
      setSigningOut(false);
    }
  };
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
              <p className="mt-0.5 text-[10px] leading-none text-muted-foreground">운영과 기록 관리</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen?.(false)}
            className="hidden cursor-pointer rounded-lg border-none p-1.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground lg:flex"
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
      <div className="shrink-0 border-t border-border px-3 py-3">
        <div className="mb-2 min-w-0 px-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">계정</p>
          <p className="mt-1 truncate text-xs text-foreground" title={userEmail}>{userEmail}</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {signingOut ? "로그아웃 중" : "로그아웃"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden h-screen w-60 shrink-0 border-r border-border bg-sidebar",
          isOpen ? "lg:flex" : "lg:hidden",
          className
        )}
      >
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
