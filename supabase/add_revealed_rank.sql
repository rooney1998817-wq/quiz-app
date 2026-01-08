-- roomsテーブルにrevealed_rankカラムを追加
-- SupabaseのSQL Editorで実行してください

-- revealed_rankカラムを追加（0: 未発表, 3: 3位発表, 2: 2位発表, 1: 1位発表）
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS revealed_rank INTEGER DEFAULT 0;

