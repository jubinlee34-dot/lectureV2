export type PaymentStatus = "unpaid" | "paid" | "partial";
export type WorkflowStage = "before" | "after" | "promoted";

export interface Lecture {
  id: string;
  user_id?: string;
  organization: string;
  title: string;
  topic: string;
  target: string;
  date: string;
  duration: string;
  startTime?: string | null;
  endTime?: string | null;
  participants: number;
  location: string;
  locationName?: string | null;
  roadAddress?: string | null;
  jibunAddress?: string | null;
  locationX?: string | null;
  locationY?: string | null;
  placeMemo?: string | null;
  preparationItems?: string | null;
  requestMemo?: string | null;
  content: string;
  reflection: string;
  managerName: string;
  managerPhone: string;
  fee: number;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  workflowStage: WorkflowStage;
  actualParticipants?: number | null;
  paymentDate?: string | null;
  reportSubmitted?: boolean | null;
  reportSubmittedAt?: string | null;
  satisfactionMemo?: string | null;
  improvementMemo?: string | null;
  blogWritten?: boolean | null;
  blogUrl?: string | null;
  afterMemo?: string | null;
  participantReaction: string;
  instructorMemo: string;
  memorableQuestion: string;
  createdAt: string;
  updatedAt?: string | null;
  travelDistanceKm?: number | null;
  travelDurationMin?: number | null;
  travelUpdatedAt?: string | null;
}

export type LectureFormData = Omit<Lecture, "id" | "createdAt" | "user_id">;
export type SortOption = "date-desc" | "date-asc" | "title" | "organization";

export type TodoPriority = "high" | "medium" | "low";

export interface Todo {
  id: string;
  user_id?: string;
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
  user_id?: string;
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
  user_id?: string;
  lectureId: string;
  type: SmsType;
  recipient: string;
  content: string;
  sentAt: string;
}
export type ContactLogChannel = "sms" | "phone" | "kakao" | "email" | "onsite" | "other";

export type ContactLogTopic =
  | "general"
  | "topic_change"
  | "time_change"
  | "location_change"
  | "audience_change"
  | "preparation_change"
  | "request_change";

export interface LectureContactLog {
  id: string;
  user_id?: string;
  lectureId: string;
  channel: ContactLogChannel;
  topic: ContactLogTopic;
  title?: string;
  content: string;
  contactName?: string;
  contactValue?: string;
  important: boolean;
  occurredAt: string;
  createdAt: string;
  updatedAt?: string | null;
}
