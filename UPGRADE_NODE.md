# Node.jsアップグレード手順

## 現在の状況
- 現在のNode.jsバージョン: v18.8.0
- 必要なNode.jsバージョン: >=20.9.0
- Next.js 16.1.1はNode.js 20.9.0以上を要求しています

## アップグレード方法

### 方法1: Node.js公式サイトからインストール（推奨）

1. https://nodejs.org/ にアクセス
2. **LTS版（推奨版）**をダウンロード（現在は20.x系）
3. インストーラーを実行
4. インストール完了後、**新しいターミナルウィンドウ**を開く
5. バージョンを確認:
   ```bash
   node --version
   ```
   バージョンが `v20.x.x` 以上であることを確認
6. プロジェクトディレクトリに移動して開発サーバーを起動:
   ```bash
   cd C:\Users\tarut\quiz-app
   npm run dev
   ```

### 方法2: nvm-windowsを使用（複数のNode.jsバージョンを管理したい場合）

1. nvm-windowsをインストール:
   - https://github.com/coreybutler/nvm-windows/releases にアクセス
   - 最新の `nvm-setup.exe` をダウンロード
   - インストーラーを実行

2. **新しいターミナルウィンドウ**を開く

3. Node.js 20をインストール:
   ```bash
   nvm install 20
   nvm use 20
   ```

4. バージョンを確認:
   ```bash
   node --version
   ```

5. プロジェクトディレクトリに移動して開発サーバーを起動:
   ```bash
   cd C:\Users\tarut\quiz-app
   npm run dev
   ```

## 注意事項

- Node.jsをアップグレードした後は、**必ず新しいターミナルウィンドウ**を開いてください
- 既存のターミナルでは古いバージョンが表示される場合があります
- アップグレード後、`node_modules`を再インストールする必要はありません（通常は不要です）

