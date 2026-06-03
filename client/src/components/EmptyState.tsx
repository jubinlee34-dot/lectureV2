import { Button } from "@/components/ui/button";
import { BookOpen, Search } from "lucide-react";

interface EmptyStateProps {
  type: "no-lectures" | "no-results";
  searchQuery?: string;
  onAddLecture?: () => void;
}

export function EmptyState({ type, searchQuery, onAddLecture }: EmptyStateProps) {
  const isSearch = type === "no-results";
  const Icon = isSearch ? Search : BookOpen;
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mb-1 text-base font-semibold text-foreground">
        {isSearch ? "검색 결과가 없습니다" : "등록된 강의가 없습니다"}
      </h3>
      <p className="mb-5 max-w-xs text-sm text-muted-foreground">
        {isSearch
          ? `"${searchQuery}"에 해당하는 강의를 찾지 못했습니다.`
          : "첫 강의를 등록하고 강의 전후 업무를 함께 관리해보세요."}
      </p>
      {!isSearch && onAddLecture && (
        <Button onClick={onAddLecture} size="sm">
          강의 등록하기
        </Button>
      )}
    </div>
  );
}
