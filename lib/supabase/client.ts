import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase環境変数が設定されていません。.env.localファイルに以下を設定してください:');
  console.warn('NEXT_PUBLIC_SUPABASE_URL=your_supabase_url');
  console.warn('NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// 型定義
export type Room = {
  id: string;
  status: 'waiting' | 'active' | 'revealed' | 'finished';
  current_question_id: string | null;
  revealed_rank: number | null;
  created_at: string;
  updated_at: string;
};

export type Player = {
  id: string;
  name: string;
  score: number;
  room_id: string;
  created_at: string;
  updated_at: string;
};

export type Question = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  order_index: number;
  created_at: string;
};

export type Answer = {
  id: string;
  player_id: string;
  question_id: string;
  selected_answer: 'A' | 'B' | 'C' | 'D';
  is_correct: boolean;
  answered_at: string;
  created_at: string;
};

