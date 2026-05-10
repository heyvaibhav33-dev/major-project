import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!url || !key) {
  throw new Error(
    "Supabase env missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in frontend/.env.local"
  );
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export type InterviewHistoryRow = {
  id: string;
  user_id: string;
  target_role: string | null;
  experience_level: string | null;
  candidate_summary: string | null;
  overall_score: number | null;
  transcript: string;
  analysis_markdown: string;
  resume_text: string | null;
  created_at: string;
};
