'use client';

import { useState, useEffect } from 'react';
import { supabase, type Room, type Question } from '@/lib/supabase/client';
import { useRealtimeRoom } from '@/hooks/useRealtimeRoom';
import { useRealtimePlayers } from '@/hooks/useRealtimePlayers';

export default function AdminPage() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const { room, loading: roomLoading } = useRealtimeRoom(roomId);
  const { players, loading: playersLoading } = useRealtimePlayers(roomId);
  
  // 問題管理用のstate
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [formData, setFormData] = useState({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'A' as 'A' | 'B' | 'C' | 'D',
  });

  // ルームの作成または取得
  useEffect(() => {
    const initializeRoom = async () => {
      // 既存のルームを取得、なければ作成
      const { data: existingRooms } = await supabase
        .from('rooms')
        .select('id')
        .limit(1)
        .single();

      if (existingRooms) {
        setRoomId(existingRooms.id);
      } else {
        const { data: newRoom, error } = await supabase
          .from('rooms')
          .insert([{ status: 'waiting' }])
          .select()
          .single();

        if (error) {
          console.error('ルーム作成エラー:', error);
          return;
        }
        setRoomId(newRoom.id);
      }
    };

    initializeRoom();
  }, []);

  // 問題の取得
  useEffect(() => {
    const fetchQuestions = async () => {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) {
        console.error('問題取得エラー:', error);
        return;
      }
      setQuestions(data || []);
    };

    fetchQuestions();
  }, []);

  // 問題を出題
  const startQuestion = async () => {
    if (!roomId || questions.length === 0) return;

    const question = questions[currentQuestionIndex];
    if (!question) return;

    const { error } = await supabase
      .from('rooms')
      .update({
        status: 'active',
        current_question_id: question.id,
      })
      .eq('id', roomId);

    if (error) {
      console.error('問題出題エラー:', error);
    }
  };

  // 正解を発表
  const revealAnswer = async () => {
    if (!roomId) return;

    // 正解発表状態に変更
    const { error } = await supabase
      .from('rooms')
      .update({
        status: 'revealed',
      })
      .eq('id', roomId);

    if (error) {
      console.error('正解発表エラー:', error);
      return;
    }
  };

  // 次の問題へ進む
  const nextQuestion = async () => {
    if (!roomId) return;

    if (currentQuestionIndex < questions.length - 1) {
      // 次の問題へ
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      const nextQuestion = questions[currentQuestionIndex + 1];
      
      const { error } = await supabase
        .from('rooms')
        .update({
          status: 'active',
          current_question_id: nextQuestion.id,
        })
        .eq('id', roomId);

      if (error) {
        console.error('次の問題へ進むエラー:', error);
        alert('次の問題への遷移に失敗しました');
      }
    } else {
      // 全問題終了
      const { error } = await supabase
        .from('rooms')
        .update({ 
          status: 'finished',
          revealed_rank: 0, // 順位発表をリセット
        })
        .eq('id', roomId);

      if (error) {
        console.error('ゲーム終了エラー:', error);
        alert('ゲーム終了処理に失敗しました');
      }
    }
  };

  // ゲームをリセット（プレイヤー、回答、状態を初期化）
  const handleReset = async () => {
    if (!roomId) return;

    if (!confirm('ゲームをリセットしますか？\n\n以下のデータが削除・初期化されます：\n- すべてのプレイヤー（参加者）\n- すべての回答データ\n- ゲームの状態\n- 順位発表の状態\n\n※参加者は再度参加する必要があります')) {
      return;
    }

    try {
      // 1. プレイヤーを削除（CASCADEで回答データも自動削除される）
      const { error: playersError } = await supabase
        .from('players')
        .delete()
        .eq('room_id', roomId);

      if (playersError) {
        console.error('プレイヤー削除エラー:', playersError);
        alert('プレイヤーの削除に失敗しました');
        return;
      }

      // 2. ルームの状態をリセット
      const { error: roomError } = await supabase
        .from('rooms')
        .update({
          status: 'waiting',
          current_question_id: null,
          revealed_rank: 0,
        })
        .eq('id', roomId);

      if (roomError) {
        console.error('ルームリセットエラー:', roomError);
        alert('ルーム状態のリセットに失敗しました');
        return;
      }

      // 3. 現在の問題インデックスを0にリセット
      setCurrentQuestionIndex(0);

      alert('ゲームをリセットしました\n\nすべてのプレイヤーが削除されました。\n参加者は再度参加する必要があります。');
    } catch (err) {
      console.error('予期しないエラー:', err);
      alert('リセット処理中にエラーが発生しました');
    }
  };

  // 順位を発表（3位→2位→1位の順）
  const revealRank = async () => {
    if (!roomId || room?.status !== 'finished') return;

    const currentRevealedRank = room?.revealed_rank || 0;
    let nextRank = 0;

    // 3位→2位→1位の順で発表
    if (currentRevealedRank === 0) {
      nextRank = 3; // 3位を発表
    } else if (currentRevealedRank === 3) {
      nextRank = 2; // 2位を発表
    } else if (currentRevealedRank === 2) {
      nextRank = 1; // 1位を発表
    } else {
      // 既に1位まで発表済み
      return;
    }

    const { error } = await supabase
      .from('rooms')
      .update({ revealed_rank: nextRank })
      .eq('id', roomId);

    if (error) {
      console.error('順位発表エラー:', error);
      alert('順位の発表に失敗しました');
    }
  };

  // 問題を作成
  const handleCreateQuestion = async () => {
    if (!formData.question_text || !formData.option_a || !formData.option_b || !formData.option_c || !formData.option_d) {
      alert('すべての項目を入力してください');
      return;
    }

    // order_indexを決定（既存の問題数 + 1）
    const maxOrder = questions.length > 0 
      ? Math.max(...questions.map(q => q.order_index || 0))
      : 0;

    const { error } = await supabase
      .from('questions')
      .insert([{
        ...formData,
        order_index: maxOrder + 1,
      }]);

    if (error) {
      console.error('問題作成エラー:', error);
      alert('問題の作成に失敗しました');
      return;
    }

    // フォームをリセット
    setFormData({
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'A',
    });
    setShowQuestionForm(false);
    
    // 問題一覧を再取得
    const { data } = await supabase
      .from('questions')
      .select('*')
      .order('order_index', { ascending: true });
    setQuestions(data || []);
  };

  // 問題を更新
  const handleUpdateQuestion = async () => {
    if (!editingQuestion) return;

    if (!formData.question_text || !formData.option_a || !formData.option_b || !formData.option_c || !formData.option_d) {
      alert('すべての項目を入力してください');
      return;
    }

    const { error } = await supabase
      .from('questions')
      .update(formData)
      .eq('id', editingQuestion.id);

    if (error) {
      console.error('問題更新エラー:', error);
      alert('問題の更新に失敗しました');
      return;
    }

    // フォームをリセット
    setFormData({
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'A',
    });
    setEditingQuestion(null);
    setShowQuestionForm(false);
    
    // 問題一覧を再取得
    const { data } = await supabase
      .from('questions')
      .select('*')
      .order('order_index', { ascending: true });
    setQuestions(data || []);
  };

  // 問題を削除
  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('この問題を削除しますか？')) {
      return;
    }

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionId);

    if (error) {
      console.error('問題削除エラー:', error);
      alert('問題の削除に失敗しました');
      return;
    }

    // 問題一覧を再取得
    const { data } = await supabase
      .from('questions')
      .select('*')
      .order('order_index', { ascending: true });
    setQuestions(data || []);
    
    // 現在の問題インデックスを調整
    if (currentQuestionIndex >= questions.length - 1) {
      setCurrentQuestionIndex(Math.max(0, questions.length - 2));
    }
  };

  // 問題を編集
  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setFormData({
      question_text: question.question_text,
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      correct_answer: question.correct_answer,
    });
    setShowQuestionForm(true);
  };

  // フォームをキャンセル
  const handleCancelForm = () => {
    setFormData({
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'A',
    });
    setEditingQuestion(null);
    setShowQuestionForm(false);
  };

  const currentQuestion = questions[currentQuestionIndex];
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const canRevealRank = room?.status === 'finished' && (room?.revealed_rank || 0) !== 1;

  if (roomLoading || !roomId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-4xl font-bold">司会者画面</h1>

        {/* 問題管理セクション */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">問題管理</h2>
            <button
              onClick={() => {
                setShowQuestionForm(!showQuestionForm);
                if (showQuestionForm) {
                  handleCancelForm();
                }
              }}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              {showQuestionForm ? 'キャンセル' : '+ 問題を追加'}
            </button>
          </div>

          {/* 問題追加/編集フォーム */}
          {showQuestionForm && (
            <div className="mb-6 rounded-lg bg-gray-50 p-4 border border-gray-200">
              <h3 className="mb-4 text-xl font-semibold">
                {editingQuestion ? '問題を編集' : '新しい問題を追加'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm font-semibold">問題文</label>
                  <textarea
                    value={formData.question_text}
                    onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                    className="w-full rounded border border-gray-300 p-2"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 text-sm font-semibold">選択肢A</label>
                    <input
                      type="text"
                      value={formData.option_a}
                      onChange={(e) => setFormData({ ...formData, option_a: e.target.value })}
                      className="w-full rounded border border-gray-300 p-2"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-semibold">選択肢B</label>
                    <input
                      type="text"
                      value={formData.option_b}
                      onChange={(e) => setFormData({ ...formData, option_b: e.target.value })}
                      className="w-full rounded border border-gray-300 p-2"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-semibold">選択肢C</label>
                    <input
                      type="text"
                      value={formData.option_c}
                      onChange={(e) => setFormData({ ...formData, option_c: e.target.value })}
                      className="w-full rounded border border-gray-300 p-2"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-semibold">選択肢D</label>
                    <input
                      type="text"
                      value={formData.option_d}
                      onChange={(e) => setFormData({ ...formData, option_d: e.target.value })}
                      className="w-full rounded border border-gray-300 p-2"
                    />
                  </div>
                </div>
                <div>
                  <label className="block mb-2 text-sm font-semibold">正解</label>
                  <select
                    value={formData.correct_answer}
                    onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value as 'A' | 'B' | 'C' | 'D' })}
                    className="rounded border border-gray-300 p-2"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={editingQuestion ? handleUpdateQuestion : handleCreateQuestion}
                    className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                  >
                    {editingQuestion ? '更新' : '追加'}
                  </button>
                  <button
                    onClick={handleCancelForm}
                    className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 問題一覧 */}
          <div className="space-y-2">
            {questions.length === 0 ? (
              <p className="text-gray-600">問題が登録されていません</p>
            ) : (
              questions.map((question, index) => (
                <div
                  key={question.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-4 border border-gray-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-600">問題 {index + 1}</span>
                      {currentQuestionIndex === index && room?.status === 'active' && (
                        <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">出題中</span>
                      )}
                    </div>
                    <p className="mb-2 font-semibold">{question.question_text}</p>
                    <div className="text-sm text-gray-600">
                      <span>A: {question.option_a}</span> | <span>B: {question.option_b}</span> |{' '}
                      <span>C: {question.option_c}</span> | <span>D: {question.option_d}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-green-600">
                      正解: {question.correct_answer}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEditQuestion(question)}
                      className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(question.id)}
                      className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-semibold">ルーム情報</h2>
          <p className="mb-2">
            <span className="font-semibold">ルームID:</span> {roomId}
          </p>
          <p className="mb-2">
            <span className="font-semibold">ステータス:</span>{' '}
            <span
              className={`rounded px-2 py-1 ${
                room?.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : room?.status === 'revealed'
                    ? 'bg-blue-100 text-blue-800'
                    : room?.status === 'finished'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {room?.status === 'active'
                ? '出題中'
                : room?.status === 'revealed'
                  ? '正解発表中'
                  : room?.status === 'finished'
                    ? '終了'
                    : '待機中'}
            </span>
          </p>
        </div>

        {currentQuestion && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-2xl font-semibold">現在の問題</h2>
            <p className="mb-4 text-lg">{currentQuestion.question_text}</p>
            <div className="space-y-2">
              <div className="rounded bg-gray-50 p-3">
                <span className="font-semibold">A:</span> {currentQuestion.option_a}
              </div>
              <div className="rounded bg-gray-50 p-3">
                <span className="font-semibold">B:</span> {currentQuestion.option_b}
              </div>
              <div className="rounded bg-gray-50 p-3">
                <span className="font-semibold">C:</span> {currentQuestion.option_c}
              </div>
              <div className="rounded bg-gray-50 p-3">
                <span className="font-semibold">D:</span> {currentQuestion.option_d}
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              正解: <span className="font-semibold">{currentQuestion.correct_answer}</span>
            </p>
            <p className="mt-2 text-sm text-gray-600">
              問題 {currentQuestionIndex + 1} / {questions.length}
            </p>
          </div>
        )}

        <div className="flex gap-4 flex-wrap">
          <button
            onClick={startQuestion}
            disabled={room?.status === 'active' || room?.status === 'revealed' || !currentQuestion}
            className="rounded bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            問題を出題
          </button>
          <button
            onClick={revealAnswer}
            disabled={room?.status !== 'active'}
            className="rounded bg-green-600 px-6 py-3 text-white hover:bg-green-700 disabled:bg-gray-400"
          >
            正解を発表
          </button>
          {room?.status === 'revealed' && (
            <button
              onClick={nextQuestion}
              className="rounded bg-orange-600 px-6 py-3 text-white hover:bg-orange-700"
            >
              {currentQuestionIndex < questions.length - 1 ? '次の問題へ' : 'ゲーム終了'}
            </button>
          )}
          {room?.status === 'finished' && (
            <button
              onClick={revealRank}
              disabled={!canRevealRank}
              className="rounded bg-purple-600 px-6 py-3 text-white hover:bg-purple-700 disabled:bg-gray-400"
            >
              {room?.revealed_rank === 0
                ? '3位を発表'
                : room?.revealed_rank === 3
                  ? '2位を発表'
                  : room?.revealed_rank === 2
                    ? '1位を発表'
                    : '順位発表済み'}
            </button>
          )}
          <button
            onClick={handleReset}
            className="rounded bg-red-600 px-6 py-3 text-white hover:bg-red-700"
          >
            ゲームをリセット
          </button>
        </div>

        {/* スコア一覧 */}
        <div className="mt-8 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-semibold">参加者スコア</h2>
          {playersLoading ? (
            <p className="text-gray-600">読み込み中...</p>
          ) : players.length === 0 ? (
            <p className="text-gray-600">参加者がいません</p>
          ) : (
            <div className="space-y-2">
              {players.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    index === 0 && players[0].score > 0
                      ? 'bg-yellow-50 border-2 border-yellow-300'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg ${
                        index === 0 && players[0].score > 0
                          ? 'bg-yellow-400 text-yellow-900'
                          : 'bg-gray-300 text-gray-700'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-800">{player.name}</p>
                      {index === 0 && players[0].score > 0 && (
                        <p className="text-sm text-yellow-700 font-semibold">🏆 1位</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-800">{player.score}点</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-semibold">共有リンク</h2>
          <div className="space-y-2">
            <div>
              <p className="mb-1 text-sm font-semibold">参加者用:</p>
              <code className="block rounded bg-gray-100 p-2 text-sm">
                {typeof window !== 'undefined' && `${window.location.origin}/join?room=${roomId}`}
              </code>
            </div>
            <div>
              <p className="mb-1 text-sm font-semibold">プロジェクター用:</p>
              <code className="block rounded bg-gray-100 p-2 text-sm">
                {typeof window !== 'undefined' && `${window.location.origin}/screen?room=${roomId}`}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

