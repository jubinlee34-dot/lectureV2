import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://nlscziutkejrdzjgfzlj.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sc2N6aXV0a2VqcmR6amdmemxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0Mzc2MDksImV4cCI6MjA5NzAxMzYwOX0.AvhVV7yzHqf2ffCWvs861dMxhpWQAcFlWptLehSqG08";

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn("Supabase 환경 변수가 설정되지 않았습니다. 하드코딩 폴백 값을 사용합니다.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
