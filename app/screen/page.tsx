'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase, type Question } from '@/lib/supabase/client';
import { useRealtimeRoom } from '@/hooks/useRealtimeRoom';
import { useRealtimeAnswers } from '@/hooks/useRealtimeAnswers';
import { useRealtimePlayers } from '@/hooks/useRealtimePlayers';

function ScreenContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room');
  const { room, loading: roomLoading } = useRealtimeRoom(roomId);
  const { players, loading: playersLoading } = useRealtimePlayers(roomId);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const { answerCount } = useRealtimeAnswers(room?.current_question_id || null);

  // 現在の問題を取得（Realtimeで自動更新）
  useEffect(() => {
    const fetchQuestion = async () => {
      if (!room?.current_question_id) {
        setCurrentQuestion(null);
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
        }
      } catch (err) {
        console.error('予期しないエラー:', err);
        setCurrentQuestion(null);
      }
    };

    fetchQuestion();
  }, [room?.current_question_id]);

  if (roomLoading || !roomId) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#faf8f3' }}>
        <div className="text-4xl text-[#d4af37]">読み込み中...</div>
      </div>
    );
  }

  if (!roomId) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#faf8f3' }}>
        <div className="text-4xl text-[#d4af37]">ルームIDが指定されていません</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-[#2c2c2c]" style={{ backgroundColor: '#faf8f3' }}>
      {room?.status === 'active' && currentQuestion ? (
        <div className="flex h-screen flex-col items-center justify-center p-8 fade-in">
          <div className="mb-12 text-center">
            <h1 className="mb-6 text-6xl font-bold text-[#d4af37] leading-relaxed">{currentQuestion.question_text}</h1>
            <div className="mt-10 text-4xl">
              <span className="font-semibold text-[#b8941f]">回答者数:</span>{' '}
              <span className="text-[#d4af37] font-bold">{answerCount}人</span>
            </div>
          </div>

          <div className="grid w-full max-w-6xl grid-cols-2 gap-8">
            <div className="rounded-lg bg-white p-10 text-center shadow-lg border-4 border-[#d4af37] hover:scale-105 transition-transform">
              <div className="mb-6 text-5xl font-bold text-[#d4af37]">A</div>
              <div className="text-3xl text-[#2c2c2c]">{currentQuestion.option_a}</div>
            </div>
            <div className="rounded-lg bg-white p-10 text-center shadow-lg border-4 border-[#d4af37] hover:scale-105 transition-transform">
              <div className="mb-6 text-5xl font-bold text-[#d4af37]">B</div>
              <div className="text-3xl text-[#2c2c2c]">{currentQuestion.option_b}</div>
            </div>
            <div className="rounded-lg bg-white p-10 text-center shadow-lg border-4 border-[#d4af37] hover:scale-105 transition-transform">
              <div className="mb-6 text-5xl font-bold text-[#d4af37]">C</div>
              <div className="text-3xl text-[#2c2c2c]">{currentQuestion.option_c}</div>
            </div>
            <div className="rounded-lg bg-white p-10 text-center shadow-lg border-4 border-[#d4af37] hover:scale-105 transition-transform">
              <div className="mb-6 text-5xl font-bold text-[#d4af37]">D</div>
              <div className="text-3xl text-[#2c2c2c]">{currentQuestion.option_d}</div>
            </div>
          </div>
        </div>
      ) : room?.status === 'revealed' && currentQuestion ? (
        <div className="flex h-screen flex-col items-center justify-center p-8 fade-in">
          <div className="mb-12 text-center">
            <h1 className="mb-6 text-6xl font-bold text-[#d4af37] leading-relaxed">{currentQuestion.question_text}</h1>
            <div className="mt-10 mb-8">
              <div className="inline-block rounded-full bg-green-500 px-12 py-6 shadow-lg">
                <p className="text-5xl font-bold text-white">正解発表</p>
              </div>
            </div>
          </div>

          <div className="grid w-full max-w-6xl grid-cols-2 gap-8">
            <div className={`rounded-lg p-10 text-center shadow-lg border-4 transition-all ${
              currentQuestion.correct_answer === 'A'
                ? 'bg-green-100 border-green-500 scale-110'
                : 'bg-white border-[#d4af37]'
            }`}>
              <div className={`mb-6 text-5xl font-bold ${
                currentQuestion.correct_answer === 'A' ? 'text-green-600' : 'text-[#d4af37]'
              }`}>
                A
                {currentQuestion.correct_answer === 'A' && (
                  <span className="ml-4 text-4xl">✓</span>
                )}
              </div>
              <div className="text-3xl text-[#2c2c2c]">{currentQuestion.option_a}</div>
            </div>
            <div className={`rounded-lg p-10 text-center shadow-lg border-4 transition-all ${
              currentQuestion.correct_answer === 'B'
                ? 'bg-green-100 border-green-500 scale-110'
                : 'bg-white border-[#d4af37]'
            }`}>
              <div className={`mb-6 text-5xl font-bold ${
                currentQuestion.correct_answer === 'B' ? 'text-green-600' : 'text-[#d4af37]'
              }`}>
                B
                {currentQuestion.correct_answer === 'B' && (
                  <span className="ml-4 text-4xl">✓</span>
                )}
              </div>
              <div className="text-3xl text-[#2c2c2c]">{currentQuestion.option_b}</div>
            </div>
            <div className={`rounded-lg p-10 text-center shadow-lg border-4 transition-all ${
              currentQuestion.correct_answer === 'C'
                ? 'bg-green-100 border-green-500 scale-110'
                : 'bg-white border-[#d4af37]'
            }`}>
              <div className={`mb-6 text-5xl font-bold ${
                currentQuestion.correct_answer === 'C' ? 'text-green-600' : 'text-[#d4af37]'
              }`}>
                C
                {currentQuestion.correct_answer === 'C' && (
                  <span className="ml-4 text-4xl">✓</span>
                )}
              </div>
              <div className="text-3xl text-[#2c2c2c]">{currentQuestion.option_c}</div>
            </div>
            <div className={`rounded-lg p-10 text-center shadow-lg border-4 transition-all ${
              currentQuestion.correct_answer === 'D'
                ? 'bg-green-100 border-green-500 scale-110'
                : 'bg-white border-[#d4af37]'
            }`}>
              <div className={`mb-6 text-5xl font-bold ${
                currentQuestion.correct_answer === 'D' ? 'text-green-600' : 'text-[#d4af37]'
              }`}>
                D
                {currentQuestion.correct_answer === 'D' && (
                  <span className="ml-4 text-4xl">✓</span>
                )}
              </div>
              <div className="text-3xl text-[#2c2c2c]">{currentQuestion.option_d}</div>
            </div>
          </div>
          <div className="mt-12 text-center">
            <p className="text-3xl text-[#666666]">次の問題までお待ちください...</p>
          </div>
        </div>
      ) : room?.status === 'finished' ? (
        <div className="min-h-screen p-8 fade-in" style={{ backgroundColor: '#faf8f3' }}>
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <h1 className="mb-6 text-7xl font-bold text-[#d4af37]">クイズ終了</h1>
              <p className="text-4xl text-[#666666]">お疲れ様でした！</p>
            </div>

            {playersLoading ? (
              <div className="text-center text-4xl text-[#666666]">順位を読み込み中...</div>
            ) : players.length === 0 ? (
              <div className="text-center text-4xl text-[#666666]">参加者がいません</div>
            ) : (() => {
              const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
              const revealedRank = room?.revealed_rank || 0;
              
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
              
              const playersToShow = sortedPlayers.filter((_, index) => ranksToShow.includes(index + 1));

              if (revealedRank === 0) {
                return (
                  <div className="text-center fade-in">
                    <p className="text-4xl text-[#666666]">順位発表をお待ちください...</p>
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  <h2 className="text-5xl font-bold text-[#d4af37] text-center mb-8">
                    {revealedRank === 3 ? '3位発表！' : revealedRank === 2 ? '2位発表！' : '1位発表！'}
                  </h2>
                  <div className="grid grid-cols-1 gap-6 max-w-4xl mx-auto">
                    {playersToShow.map((player, arrayIndex) => {
                      const actualIndex = sortedPlayers.indexOf(player);
                      const isTop3 = actualIndex < 3;
                      const rankColors = [
                        { bg: 'bg-gradient-to-r from-yellow-400 to-yellow-600', border: 'border-yellow-500', text: 'text-yellow-900', medal: '🥇', size: 'text-6xl' },
                        { bg: 'bg-gradient-to-r from-gray-300 to-gray-500', border: 'border-gray-400', text: 'text-gray-900', medal: '🥈', size: 'text-5xl' },
                        { bg: 'bg-gradient-to-r from-orange-400 to-orange-600', border: 'border-orange-500', text: 'text-orange-900', medal: '🥉', size: 'text-5xl' },
                      ];
                      const rankStyle = isTop3 ? rankColors[actualIndex] : { bg: 'bg-white', border: 'border-[#f4e4bc]', text: 'text-[#2c2c2c]', medal: '', size: 'text-4xl' };
                      
                      // 最新に発表された順位のみパルスアニメーションを適用
                      const isNewlyRevealed = actualIndex + 1 === revealedRank;

                      return (
                        <div
                          key={player.id}
                          className={`rounded-lg p-8 shadow-2xl border-4 ${rankStyle.border} ${rankStyle.bg} ${
                            isNewlyRevealed ? 'scale-110 transform rank-pulse' : ''
                          } transition-all`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6">
                              <div className={`${rankStyle.size} font-bold ${rankStyle.text}`}>
                                {isTop3 ? rankStyle.medal : `${actualIndex + 1}位`}
                              </div>
                              <div>
                                <p className={`text-4xl font-bold ${rankStyle.text}`}>{player.name}</p>
                                {isTop3 && (
                                  <p className={`text-2xl ${rankStyle.text} opacity-80 mt-2`}>
                                    {actualIndex === 0 ? '🏆 優勝！' : actualIndex === 1 ? '🎖️ 準優勝！' : '🎗️ 3位！'}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-5xl font-bold ${rankStyle.text}`}>{player.score}点</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="flex h-screen items-center justify-center fade-in">
          <div className="text-center">
            <h1 className="mb-6 text-7xl font-bold text-[#d4af37]">待機中</h1>
            <p className="text-4xl text-[#666666]">問題が出題されるまでお待ちください</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScreenPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#faf8f3' }}>
        <div className="text-4xl text-[#d4af37]">読み込み中...</div>
      </div>
    }>
      <ScreenContent />
    </Suspense>
  );
}

