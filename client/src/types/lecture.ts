export type PaymentStatus = "unpaid" | "paid" | "partial";
export type WorkflowStage = "before" | "after" | "promoted";

export interface Lecture {
  id: string;
  organization: string;
  title: string;
  topic: string;
  target: string;
  date: string;
  duration: string;
  participants: number;
  location: string;
  content: string;
  reflection: string;
  managerName: string;
  managerPhone: string;
  fee: number;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  workflowStage: WorkflowStage;
  participantReaction: string;
  instructorMemo: string;
  memorableQuestion: string;
  createdAt: string;
}

export type LectureFormData = Omit<Lecture, "id" | "createdAt">;
export type SortOption = "date-desc" | "date-asc" | "title" | "organization";

export type TodoPriority = "high" | "medium" | "low";

export interface Todo {
  id: string;
  lectureId?: string;
  text: string;
  done: boolean;
  priority: TodoPriority;
  dueDate?: string;
  createdAt: string;
}

export type WorkTaskStage = "before" | "after";
export type WorkTaskCategory =
  | "material"
  | "contact"
  | "logistics"
  | "report"
  | "invoice"
  | "blog"
  | "other";

export interface WorkTask {
  id: string;
  lectureId: string;
  stage: WorkTaskStage;
  category: WorkTaskCategory;
  text: string;
  done: boolean;
  doneAt?: string;
  createdAt: string;
  starred?: boolean;
}

export type SmsType = "reminder" | "confirm" | "thankyou" | "custom";

export interface SmsHistory {
  id: string;
  lectureId: string;
  type: SmsType;
  recipient: string;
  content: string;
  sentAt: string;
}
