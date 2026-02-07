'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase, type Question } from '@/lib/supabase/client';
import { useRealtimeRoom } from '@/hooks/useRealtimeRoom';
import { useRealtimePlayers } from '@/hooks/useRealtimePlayers';

const SESSION_KEY_ROOM = 'quiz_room_id';
const SESSION_KEY_PLAYER = 'quiz_player_id';

function JoinContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room');
  const { room, loading: roomLoading } = useRealtimeRoom(roomId);
  const { players, loading: playersLoading } = useRealtimePlayers(roomId);
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // セッション復元（リロード時）：同じルームの参加者なら復元
  useEffect(() => {
    if (!roomId || sessionChecked) return;

    const storedRoomId = typeof window !== 'undefined' ? sessionStorage.getItem(SESSION_KEY_ROOM) : null;
    const storedPlayerId = typeof window !== 'undefined' ? sessionStorage.getItem(SESSION_KEY_PLAYER) : null;

    if (storedRoomId === roomId && storedPlayerId) {
      const verifyAndRestore = async () => {
        const { data, error } = await supabase
          .from('players')
          .select('id, room_id')
          .eq('id', storedPlayerId)
          .single();

        if (!error && data && data.room_id === roomId) {
          setPlayerId(data.id);
        } else {
          sessionStorage.removeItem(SESSION_KEY_ROOM);
          sessionStorage.removeItem(SESSION_KEY_PLAYER);
        }
        setSessionChecked(true);
      };
      verifyAndRestore();
    } else {
      if (storedRoomId !== roomId && (storedRoomId || storedPlayerId)) {
        sessionStorage.removeItem(SESSION_KEY_ROOM);
        sessionStorage.removeItem(SESSION_KEY_PLAYER);
      }
      setSessionChecked(true);
    }
  }, [roomId, sessionChecked]);

  // 現在の問題を取得（Realtimeで自動更新）
  useEffect(() => {
    const fetchQuestion = async () => {
      if (!room?.current_question_id) {
        setCurrentQuestion(null);
        setHasAnswered(false);
        setSelectedAnswer(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('questions')
          .select('*')
          .eq('id', room.current_question_id)
          .single();

        if (error) {
          console.error('問題取得エラー:', error);
          setCurrentQuestion(null);
          return;
        }

        if (data) {
          setCurrentQuestion(data);
          // 新しい問題に切り替わったので、回答状態をリセット
          setHasAnswered(false);
          setSelectedAnswer(null);
        }
      } catch (err) {
        console.error('予期しないエラー:', err);
        setCurrentQuestion(null);
      }
    };

    fetchQuestion();
  }, [room?.current_question_id]);

  // 既に回答済みかチェック（Realtimeで自動更新）
  useEffect(() => {
    const checkAnswered = async () => {
      if (!playerId || !room?.current_question_id) {
        setHasAnswered(false);
        setSelectedAnswer(null);
        setIsCorrect(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('answers')
          .select('id, selected_answer, is_correct')
          .eq('player_id', playerId)
          .eq('question_id', room.current_question_id)
          .maybeSingle();

        if (error) {
          console.error('回答確認エラー:', error);
          return;
        }

        if (data) {
          setHasAnswered(true);
          setSelectedAnswer(data.selected_answer);
          setIsCorrect(data.is_correct);
        } else {
          // 回答がない場合はリセット
          setHasAnswered(false);
          setSelectedAnswer(null);
          setIsCorrect(null);
        }
      } catch (err) {
        console.error('予期しないエラー:', err);
      }
    };

    checkAnswered();
  }, [playerId, room?.current_question_id]);

  // 正解発表状態の判定
  const isRevealed = room?.status === 'revealed';

  // 参加処理（同名が既にいればそのデータを引き継ぎ、いなければ新規作成）
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !roomId) return;

    const name = playerName.trim();

    // 同じルームに同じ名前の参加者がいないか確認
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id')
      .eq('room_id', roomId)
      .eq('name', name)
      .maybeSingle();

    if (existingPlayer) {
      // 既存の参加者として引き継ぎ
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(SESSION_KEY_ROOM, roomId);
        sessionStorage.setItem(SESSION_KEY_PLAYER, existingPlayer.id);
      }
      setPlayerId(existingPlayer.id);
      return;
    }

    // 新規参加
    const { data, error } = await supabase
      .from('players')
      .insert([{ name, room_id: roomId }])
      .select()
      .single();

    if (error) {
      console.error('参加エラー:', error);
      alert('参加に失敗しました');
      return;
    }

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY_ROOM, roomId);
      sessionStorage.setItem(SESSION_KEY_PLAYER, data.id);
    }
    setPlayerId(data.id);
  };

  // 回答送信
  const handleAnswer = async (answer: 'A' | 'B' | 'C' | 'D') => {
    if (!playerId || !currentQuestion || isRevealed) return;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/160c7f9d-6932-43c6-a470-5603bd743c30',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/join/page.tsx:124',message:'回答送信開始',data:{playerId:playerId,questionId:currentQuestion.id,selectedAnswer:answer},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    const isCorrect = answer === currentQuestion.correct_answer;

    // 既存の回答をチェック
    const { data: existingAnswer } = await supabase
      .from('answers')
      .select('id, is_correct')
      .eq('player_id', playerId)
      .eq('question_id', currentQuestion.id)
      .maybeSingle();

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/160c7f9d-6932-43c6-a470-5603bd743c30',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/join/page.tsx:135',message:'既存回答確認',data:{hasExistingAnswer:!!existingAnswer,existingIsCorrect:existingAnswer?.is_correct,newIsCorrect:isCorrect},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // 既存の回答がある場合は更新、ない場合は挿入
    if (existingAnswer) {
      const { error } = await supabase
        .from('answers')
        .update({
          selected_answer: answer,
          is_correct: isCorrect,
          answered_at: new Date().toISOString(),
        })
        .eq('id', existingAnswer.id);

      if (error) {
        console.error('回答更新エラー:', error);
        alert('回答の更新に失敗しました');
        return;
      }

      // スコアの更新（前回の回答と今回の回答を比較）
      const { data: player } = await supabase
        .from('players')
        .select('score, name')
        .eq('id', playerId)
        .single();

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/160c7f9d-6932-43c6-a470-5603bd743c30',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/join/page.tsx:155',message:'スコア取得',data:{playerId:playerId,playerName:player?.name,currentScore:player?.score},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      if (player) {
        let scoreChange = 0;
        // 前回が正解で今回が不正解の場合：スコアを-1
        if (existingAnswer.is_correct && !isCorrect) {
          scoreChange = -1;
        }
        // 前回が不正解で今回が正解の場合：スコアを+1
        else if (!existingAnswer.is_correct && isCorrect) {
          scoreChange = 1;
        }

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/160c7f9d-6932-43c6-a470-5603bd743c30',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/join/page.tsx:172',message:'スコア更新前',data:{playerId:playerId,playerName:player.name,currentScore:player.score,scoreChange:scoreChange,newScore:player.score+scoreChange},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion

        if (scoreChange !== 0) {
          const { data: updatedPlayer, error: updateError } = await supabase
            .from('players')
            .update({ score: player.score + scoreChange })
            .eq('id', playerId)
            .select('score, name')
            .single();

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/160c7f9d-6932-43c6-a470-5603bd743c30',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/join/page.tsx:177',message:'スコア更新後',data:{playerId:playerId,playerName:updatedPlayer?.name,updatedScore:updatedPlayer?.score,updateError:updateError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
        }
      }
    } else {
      // 新しい回答を挿入
      const { error } = await supabase.from('answers').insert([
        {
          player_id: playerId,
          question_id: currentQuestion.id,
          selected_answer: answer,
          is_correct: isCorrect,
          answered_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error('回答送信エラー:', error);
        alert('回答の送信に失敗しました');
        return;
      }

      // 正解の場合、スコアを更新
      if (isCorrect) {
        const { data: player } = await supabase
          .from('players')
          .select('score, name')
          .eq('id', playerId)
          .single();

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/160c7f9d-6932-43c6-a470-5603bd743c30',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/join/page.tsx:199',message:'新規回答スコア取得',data:{playerId:playerId,playerName:player?.name,currentScore:player?.score},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion

        if (player) {
          const { data: updatedPlayer, error: updateError } = await supabase
            .from('players')
            .update({ score: player.score + 1 })
            .eq('id', playerId)
            .select('score, name')
            .single();

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/160c7f9d-6932-43c6-a470-5603bd743c30',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/join/page.tsx:207',message:'新規回答スコア更新後',data:{playerId:playerId,playerName:updatedPlayer?.name,updatedScore:updatedPlayer?.score,updateError:updateError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
        }
      }
    }

    setSelectedAnswer(answer);
    setHasAnswered(true);
    setIsCorrect(isCorrect);
  };

  if (roomLoading || !roomId || !sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#faf8f3' }}>
        <div className="text-2xl text-[#d4af37]">読み込み中...</div>
      </div>
    );
  }

  // 参加前の画面
  if (!playerId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4" style={{ backgroundColor: '#faf8f3' }}>
        <div className="w-full max-w-md rounded-lg bg-white p-10 shadow-lg border-2 border-[#f4e4bc] fade-in">
          <h1 className="mb-8 text-center text-4xl font-bold text-[#d4af37]">クイズに参加</h1>
          <form onSubmit={handleJoin} className="space-y-6">
            <div>
              <label htmlFor="name" className="mb-3 block text-lg font-semibold text-[#b8941f]">
                お名前
              </label>
              <input
                id="name"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full rounded-lg border-2 border-[#d4af37] px-5 py-4 text-lg focus:border-[#b8941f] focus:outline-none focus:ring-2 focus:ring-[#f4e4bc] transition-all"
                placeholder="名前を入力してください"
                required
              />
            </div>
            <button
              type="submit"
              className="button-gold w-full rounded-lg px-6 py-5 text-white text-xl font-semibold"
            >
              参加する
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ロビー待機画面
  if (room?.status === 'waiting' || room?.status === null) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#faf8f3' }}>
        <div className="text-center fade-in">
          <h1 className="mb-6 text-5xl font-bold text-[#d4af37]">ロビー</h1>
          <p className="text-2xl text-[#666666]">ゲーム開始をお待ちください...</p>
        </div>
      </div>
    );
  }

  // ゲーム終了画面（順位表示）
  if (room?.status === 'finished') {
    return (
      <div className="min-h-screen p-4" style={{ backgroundColor: '#faf8f3' }}>
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-8 fade-in">
            <h1 className="mb-4 text-5xl font-bold text-[#d4af37]">クイズ終了</h1>
            <p className="text-2xl text-[#666666]">お疲れ様でした！</p>
          </div>

          {playersLoading ? (
            <div className="text-center text-xl text-[#666666]">順位を読み込み中...</div>
          ) : players.length === 0 ? (
            <div className="text-center text-xl text-[#666666]">参加者がいません</div>
          ) : (() => {
            const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
            const revealedRank = room?.revealed_rank || 0;
            
            // 順位を計算（点数の重複をまとめ、上から1番目の点数=1位、2番目=2位、3番目=3位）
            const distinctScores: number[] = [];
            for (const p of sortedPlayers) {
              if (distinctScores[distinctScores.length - 1] !== p.score) distinctScores.push(p.score);
            }
            const scoreToRank: Record<number, number> = {};
            distinctScores.forEach((score, i) => { scoreToRank[score] = i + 1; });
            const playersWithRank = sortedPlayers.map((p) => ({ ...p, rank: scoreToRank[p.score] ?? 0 }));
            
            // 発表された順位を累積表示（3位→2位→1位の順で追加）
            // revealedRankが3の場合は3位のみ、2の場合は3位と2位、1の場合は3位、2位、1位を表示
            const ranksToShow: number[] = [];
            if (revealedRank === 3) {
              ranksToShow.push(3); // 3位のみ
            } else if (revealedRank === 2) {
              ranksToShow.push(3, 2); // 3位と2位
            } else if (revealedRank === 1) {
              ranksToShow.push(3, 2, 1); // 3位、2位、1位
            }
            
            // 発表された順位のプレイヤーを表示（同点の場合は同じ順位のプレイヤーも含む）
            const playersToShow = playersWithRank.filter((player) => ranksToShow.includes(player.rank));

            if (revealedRank === 0) {
              return (
                <div className="text-center fade-in">
                  <p className="text-2xl text-[#666666]">順位発表をお待ちください...</p>
                </div>
              );
            }

            return (
              <div className="space-y-4 fade-in">
                <h2 className="text-3xl font-bold text-[#d4af37] text-center mb-6">
                  {revealedRank === 3 ? '3位発表！' : revealedRank === 2 ? '2位発表！' : '1位発表！'}
                </h2>
                {playersToShow.map((player) => {
                  const isTop3 = player.rank <= 3;
                  const rankColors = [
                    { bg: 'bg-gradient-to-r from-yellow-400 to-yellow-600', border: 'border-yellow-500', text: 'text-yellow-900', medal: '🥇' },
                    { bg: 'bg-gradient-to-r from-gray-300 to-gray-500', border: 'border-gray-400', text: 'text-gray-900', medal: '🥈' },
                    { bg: 'bg-gradient-to-r from-orange-400 to-orange-600', border: 'border-orange-500', text: 'text-orange-900', medal: '🥉' },
                  ];
                  const rankStyle = isTop3 && player.rank <= 3 ? rankColors[player.rank - 1] : { bg: 'bg-white', border: 'border-[#f4e4bc]', text: 'text-[#2c2c2c]', medal: '' };
                  
                  // 最新に発表された順位のみパルスアニメーションを適用
                  const isNewlyRevealed = player.rank === revealedRank;

                  return (
                    <div
                      key={player.id}
                      className={`rounded-lg p-6 shadow-lg border-4 ${rankStyle.border} ${rankStyle.bg} ${
                        isNewlyRevealed ? 'scale-105 transform rank-pulse' : ''
                      } transition-all`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`text-4xl font-bold ${rankStyle.text}`}>
                            {isTop3 && player.rank <= 3 ? rankStyle.medal : `${player.rank}位`}
                          </div>
                          <div>
                            <p className={`text-2xl font-bold ${rankStyle.text}`}>{player.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-3xl font-bold ${rankStyle.text}`}>{player.score}点</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // ゲーム中の画面
  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: '#faf8f3' }}>
      <div className="mx-auto max-w-4xl">
        {currentQuestion ? (
          <div className="space-y-6 fade-in">
            <div className="rounded-lg bg-white p-8 shadow-lg border-2 border-[#f4e4bc]">
              <h2 className="text-3xl font-bold text-[#2c2c2c] leading-relaxed">{currentQuestion.question_text}</h2>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <button
                onClick={() => handleAnswer('A')}
                disabled={isRevealed}
                className={`rounded-lg p-8 text-left transition-all min-h-[150px] ${
                  isRevealed
                    ? currentQuestion.correct_answer === 'A'
                      ? 'bg-green-500 text-white shadow-lg scale-105 border-4 border-green-600'
                      : selectedAnswer === 'A'
                        ? 'bg-red-500 text-white shadow-lg scale-105 border-4 border-red-600'
                        : 'bg-gray-200 text-gray-500'
                    : selectedAnswer === 'A'
                      ? 'bg-[#d4af37] text-white shadow-lg scale-105'
                      : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                }`}
              >
                <div className="mb-3 text-3xl font-bold">A</div>
                <div className="text-xl">{currentQuestion.option_a}</div>
                {isRevealed && currentQuestion.correct_answer === 'A' && (
                  <div className="mt-2 text-lg font-bold">✓ 正解</div>
                )}
                {isRevealed && selectedAnswer === 'A' && currentQuestion.correct_answer !== 'A' && (
                  <div className="mt-2 text-lg font-bold">✗ 不正解</div>
                )}
              </button>

              <button
                onClick={() => handleAnswer('B')}
                disabled={isRevealed}
                className={`rounded-lg p-8 text-left transition-all min-h-[150px] ${
                  isRevealed
                    ? currentQuestion.correct_answer === 'B'
                      ? 'bg-green-500 text-white shadow-lg scale-105 border-4 border-green-600'
                      : selectedAnswer === 'B'
                        ? 'bg-red-500 text-white shadow-lg scale-105 border-4 border-red-600'
                        : 'bg-gray-200 text-gray-500'
                    : selectedAnswer === 'B'
                      ? 'bg-[#d4af37] text-white shadow-lg scale-105'
                      : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                }`}
              >
                <div className="mb-3 text-3xl font-bold">B</div>
                <div className="text-xl">{currentQuestion.option_b}</div>
                {isRevealed && currentQuestion.correct_answer === 'B' && (
                  <div className="mt-2 text-lg font-bold">✓ 正解</div>
                )}
                {isRevealed && selectedAnswer === 'B' && currentQuestion.correct_answer !== 'B' && (
                  <div className="mt-2 text-lg font-bold">✗ 不正解</div>
                )}
              </button>

              <button
                onClick={() => handleAnswer('C')}
                disabled={isRevealed}
                className={`rounded-lg p-8 text-left transition-all min-h-[150px] ${
                  isRevealed
                    ? currentQuestion.correct_answer === 'C'
                      ? 'bg-green-500 text-white shadow-lg scale-105 border-4 border-green-600'
                      : selectedAnswer === 'C'
                        ? 'bg-red-500 text-white shadow-lg scale-105 border-4 border-red-600'
                        : 'bg-gray-200 text-gray-500'
                    : selectedAnswer === 'C'
                      ? 'bg-[#d4af37] text-white shadow-lg scale-105'
                      : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                }`}
              >
                <div className="mb-3 text-3xl font-bold">C</div>
                <div className="text-xl">{currentQuestion.option_c}</div>
                {isRevealed && currentQuestion.correct_answer === 'C' && (
                  <div className="mt-2 text-lg font-bold">✓ 正解</div>
                )}
                {isRevealed && selectedAnswer === 'C' && currentQuestion.correct_answer !== 'C' && (
                  <div className="mt-2 text-lg font-bold">✗ 不正解</div>
                )}
              </button>

              <button
                onClick={() => handleAnswer('D')}
                disabled={isRevealed}
                className={`rounded-lg p-8 text-left transition-all min-h-[150px] ${
                  isRevealed
                    ? currentQuestion.correct_answer === 'D'
                      ? 'bg-green-500 text-white shadow-lg scale-105 border-4 border-green-600'
                      : selectedAnswer === 'D'
                        ? 'bg-red-500 text-white shadow-lg scale-105 border-4 border-red-600'
                        : 'bg-gray-200 text-gray-500'
                    : selectedAnswer === 'D'
                      ? 'bg-[#d4af37] text-white shadow-lg scale-105'
                      : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                }`}
              >
                <div className="mb-3 text-3xl font-bold">D</div>
                <div className="text-xl">{currentQuestion.option_d}</div>
                {isRevealed && currentQuestion.correct_answer === 'D' && (
                  <div className="mt-2 text-lg font-bold">✓ 正解</div>
                )}
                {isRevealed && selectedAnswer === 'D' && currentQuestion.correct_answer !== 'D' && (
                  <div className="mt-2 text-lg font-bold">✗ 不正解</div>
                )}
              </button>
            </div>

            {hasAnswered && !isRevealed && selectedAnswer && (
              <div className="rounded-lg bg-[#f4e4bc] p-6 text-center border-2 border-[#d4af37]">
                <p className="text-2xl font-semibold text-[#b8941f]">現在の回答: {selectedAnswer}</p>
                <p className="text-lg text-[#b8941f] mt-2">選択肢は何度でも変更できます</p>
              </div>
            )}

            {isRevealed && (
              <div className={`rounded-lg p-8 text-center border-4 ${
                isCorrect
                  ? 'bg-green-100 border-green-500'
                  : 'bg-red-100 border-red-500'
              }`}>
                <p className={`text-4xl font-bold mb-2 ${
                  isCorrect ? 'text-green-700' : 'text-red-700'
                }`}>
                  {isCorrect ? '✓ 正解です！' : '✗ 不正解です'}
                </p>
                <p className="text-2xl text-[#2c2c2c] mt-4">
                  正解は <span className="font-bold text-[#d4af37]">{currentQuestion.correct_answer}</span> でした
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-white p-8 text-center shadow-lg border-2 border-[#f4e4bc]">
            <p className="text-xl text-[#666666]">問題を読み込み中...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#faf8f3' }}>
        <div className="text-2xl text-[#d4af37]">読み込み中...</div>
      </div>
    }>
      <JoinContent />
    </Suspense>
  );
}

