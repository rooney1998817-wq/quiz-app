# 結婚式二次会用クイズアプリ

Next.js、TypeScript、Tailwind CSS、Supabaseを使用したリアルタイムクイズアプリケーションです。

## 機能

- **司会者画面 (`/admin`)**: 問題の出題、正解発表の管理
- **プロジェクター画面 (`/screen`)**: 現在の問題と回答者数をリアルタイム表示
- **参加者画面 (`/join`)**: ゲストが参加して4択ボタンで回答

## 技術スタック

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Realtime通信)

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Supabaseのセットアップ

1. [Supabase](https://supabase.com)でプロジェクトを作成
2. SQL Editorで `supabase/schema.sql` の内容を実行してテーブルを作成
3. `.env.local.example` を `.env.local` にコピー
4. Supabaseダッシュボードから以下を取得して `.env.local` に設定:
   - `NEXT_PUBLIC_SUPABASE_URL`: プロジェクトのURL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 匿名キー

### 3. 開発サーバーの起動

```bash
npm run dev
```

アプリケーションは [http://localhost:3000](http://localhost:3000) で起動します。

## 使用方法

### 1. 司会者画面にアクセス

`/admin` にアクセスすると、自動的にルームが作成されます。画面に表示されるルームIDとURLをメモしてください。

### 2. 参加者にURLを共有

司会者画面に表示される「参加者用」のURLをゲストに共有します。

### 3. プロジェクター画面を開く

司会者画面に表示される「プロジェクター用」のURLをプロジェクターで開きます。

### 4. 問題の出題

1. 司会者画面で「問題を出題」ボタンをクリック
2. 参加者とプロジェクター画面が自動的に更新されます
3. 参加者は4択ボタンで回答できます
4. プロジェクター画面には回答者数がリアルタイムで表示されます
5. 「正解を発表」ボタンで次の問題へ進みます

## データベース構造

- `rooms`: ゲームセッション管理（status: waiting, active, finished）
- `players`: 参加者（name, score, room_id）
- `questions`: 問題文、選択肢、正解
- `answers`: プレイヤーの回答ログ（早押し判定用のtimestamp含む）

## 注意事項

- 問題データは手動で `questions` テーブルに追加する必要があります
- 早押し判定は `answers` テーブルの `answered_at` カラムを使用します
- Realtime通信を使用しているため、SupabaseのRealtime機能が有効になっていることを確認してください
