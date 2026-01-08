'use client';

import { useEffect, useState } from 'react';
import { supabase, type Answer } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimeAnswers(questionId: string | null) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [answerCount, setAnswerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!questionId) {
      setLoading(false);
      return;
    }

    let channel: RealtimeChannel | null = null;

    // 初期データの取得
    const fetchAnswers = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('answers')
          .select('*')
          .eq('question_id', questionId)
          .order('answered_at', { ascending: true });

        if (fetchError) throw fetchError;
        setAnswers(data || []);
        setAnswerCount(data?.length || 0);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchAnswers();

    // Realtime購読の設定
    channel = supabase
      .channel(`answers:${questionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'answers',
          filter: `question_id=eq.${questionId}`,
        },
        (payload) => {
          setAnswers((prev) => [...prev, payload.new as Answer]);
          setAnswerCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [questionId]);

  return { answers, answerCount, loading, error };
}

