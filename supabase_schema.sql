-- 1. lectures 테이블 생성
CREATE TABLE IF NOT EXISTS public.lectures (
    id TEXT PRIMARY KEY,
    organization TEXT,
    title TEXT,
    topic TEXT,
    target TEXT,
    date TEXT,
    duration TEXT,
    participants INTEGER,
    location TEXT,
    content TEXT,
    reflection TEXT,
    "managerName" TEXT,
    "managerPhone" TEXT,
    fee BIGINT,
    "paymentStatus" TEXT,
    "paidAmount" BIGINT,
    "workflowStage" TEXT,
    "participantReaction" TEXT,
    "instructorMemo" TEXT,
    "memorableQuestion" TEXT,
    "createdAt" TEXT
);

-- 2. todos 테이블 생성
CREATE TABLE IF NOT EXISTS public.todos (
    id TEXT PRIMARY KEY,
    "lectureId" TEXT REFERENCES public.lectures(id) ON DELETE CASCADE,
    text TEXT,
    done BOOLEAN DEFAULT FALSE,
    priority TEXT,
    "dueDate" TEXT,
    "createdAt" TEXT
);

-- 3. work_tasks 테이블 생성
CREATE TABLE IF NOT EXISTS public.work_tasks (
    id TEXT PRIMARY KEY,
    "lectureId" TEXT REFERENCES public.lectures(id) ON DELETE CASCADE,
    stage TEXT,
    category TEXT,
    text TEXT,
    done BOOLEAN DEFAULT FALSE,
    "doneAt" TEXT,
    "createdAt" TEXT,
    starred BOOLEAN DEFAULT FALSE
);

-- 4. sms_history 테이블 생성
CREATE TABLE IF NOT EXISTS public.sms_history (
    id TEXT PRIMARY KEY,
    "lectureId" TEXT REFERENCES public.lectures(id) ON DELETE CASCADE,
    type TEXT,
    recipient TEXT,
    content TEXT,
    "sentAt" TEXT
);

-- 5. instructor_profile 테이블 생성
CREATE TABLE IF NOT EXISTS public.instructor_profile (
    id TEXT PRIMARY KEY,
    name TEXT,
    "homeAddress" TEXT,
    phone TEXT,
    email TEXT,
    "naverMapClientId" TEXT,
    "naverMapClientSecret" TEXT,
    password TEXT,
    "customFields" JSONB
);

-- 6. RLS (Row Level Security) 비활성화 (클라이언트 단독 앱이므로 누구나 접근 가능하게 설정)
ALTER TABLE public.lectures DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.todos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_profile DISABLE ROW LEVEL SECURITY;
