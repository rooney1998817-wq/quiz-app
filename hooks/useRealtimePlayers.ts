'use client';

import { useEffect, useState } from 'react';
import { supabase, type Player } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimePlayers(roomId: string | null) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    let channel: RealtimeChannel | null = null;

    // 初期データの取得
    const fetchPlayers = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', roomId)
          .order('score', { ascending: false });

        if (fetchError) throw fetchError;
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/160c7f9d-6932-43c6-a470-5603bd743c30',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'hooks/useRealtimePlayers.ts:30',message:'プレイヤーリスト取得',data:{roomId:roomId,playersCount:data?.length,players:data?.map(p=>({id:p.id,name:p.name,score:p.score}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        setPlayers(data || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();

    // Realtime購読の設定
    channel = supabase
      .channel(`players:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          // 変更があったら再取得
          fetchPlayers();
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [roomId]);

  return { players, loading, error };
}

