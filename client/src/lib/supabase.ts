import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfig = {
  urlSet: Boolean(supabaseUrl),
  anonKeySet: Boolean(supabaseAnonKey),
  ready: Boolean(supabaseUrl && supabaseAnonKey),
};

function createMissingSupabaseClient(): SupabaseClient {
  const error = new Error("Supabase 환경변수가 설정되지 않았습니다");
  return {
    from() {
      throw error;
    },
  } as unknown as SupabaseClient;
}

export const supabase = supabaseConfig.ready
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : createMissingSupabaseClient();
