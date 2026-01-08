-- roomsテーブルのstatusに'revealed'を追加
-- SupabaseのSQL Editorで実行してください

-- 既存のCHECK制約を削除
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_status_check;

-- 新しいCHECK制約を追加（'revealed'を含む）
ALTER TABLE rooms ADD CONSTRAINT rooms_status_check 
  CHECK (status IN ('waiting', 'active', 'revealed', 'finished'));

