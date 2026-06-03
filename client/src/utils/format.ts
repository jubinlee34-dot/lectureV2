export function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export function formatNumber(num: number): string {
  return num.toLocaleString("ko-KR");
}

export function truncate(text: string, maxLength: number): string {
  if (!text) return "";
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;
}

export function formatKRW(amount: number): string {
  return `${(amount || 0).toLocaleString("ko-KR")}원`;
}
