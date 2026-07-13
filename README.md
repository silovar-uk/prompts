# Prompt Launcher

スマホのホーム画面から、いま必要なプロンプトをすぐ呼び出すためのPWAです。

このリポジトリでは、正式プロンプトを「1ファイル＝1件」のJSONとして管理し、ビルド時にZodで検証して `public/catalog.json` へ結合します。設計上の正本は [`PLAN.md`](./PLAN.md) です。

## 現在の到達点

Phase A2のうち、検索・利用・個人化・ローカル追加まで実装済みです。

- Vite + React 18 + TypeScript strict
- Tailwind CSS
- PWA / Service Worker
- 日本語自然文検索、目的・入力物チップ
- 入力フォーム、モディファイアー合成、コピー
- お気に入り、履歴、前回設定、最近の検索
- ChatGPT / Claudeへの引き継ぎ
- スマホ用3ステップのプロンプト追加ウィザード
- 端末内プロンプトの検索・利用・削除
- 端末内プロンプトから正式登録用JSONとGitHub新規ファイル画面を生成
- 個人データのエクスポート・インポート
- 1件1JSONの正式プロンプト・モディファイアー管理
- ZodスキーマとJSON Schema生成
- ID、参照、入力数、テンプレート変数のCI検証
- 日本語検索評価ハーネス
- Vitest / Playwright（390px・430px）
- GitHub ActionsによるCIとGitHub Pages公開

## 開発

```bash
npm install --no-audit --no-fund
npm run dev
```

主なコマンド：

```bash
npm run validate:data  # JSON検証とcatalog生成
npm run test:search    # 検索評価
npm run test           # ユニットテスト
npm run build          # 本番ビルド
npm run test:e2e       # モバイルE2E
npm run new:prompt     # プロンプト雛形を対話生成
```

## プロンプトを追加する

### スマホから試す

1. アプリの「設定」を開く
2. 「自分用プロンプトを追加」を押す
3. 名前、用途、AIへの指示、入力材料を3ステップで入力する
4. 「保存して使う」を押す

この段階では端末内だけに保存され、通常のプロンプトと同じように検索・お気に入り・履歴で使えます。貼り付ける本文は保存されません。

### 正式カタログへ登録する

端末内プロンプトの管理画面から、次のどちらかを使います。

- `JSON`：正式登録用のJSONをクリップボードへコピー
- `GitHub ↗`：ファイル名とJSONを入れたGitHubの新規ファイル作成画面を開く

正式登録時はCIでスキーマ、参照先、入力数、検索文数を検証します。問題なく公開できたら、端末内版は削除できます。

### PCから直接追加する

1. `npm run new:prompt` で雛形を作る、または `data/prompts/` にJSONを追加する
2. ファイル名と `id` を一致させる（例：`writing-004.json`）
3. `searchPhrases` を5〜10件入れる
4. 必須入力は2件以内、任意入力は4件以内にする
5. `npm run validate:data` を実行する

モディファイアーは `data/modifiers/` に追加します。スキーマの参照用ファイルは `data/schema/` に自動生成されます。

## データの安全性

貼り付けた本文や業務データは自動保存しません。端末内に保存するのは、お気に入り、利用履歴、選択式の前回設定、自作プロンプトなどです。これらは設定画面からJSONとしてバックアップできます。

## 公開URL

GitHub Pages: `https://silovar-uk.github.io/prompts/`
