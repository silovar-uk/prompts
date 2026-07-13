# Prompt Launcher

スマホのホーム画面から、いま必要なプロンプトをすぐ呼び出すためのPWAです。

このリポジトリでは、プロンプトを「1ファイル＝1件」のJSONとして管理し、ビルド時にZodで検証して `public/catalog.json` へ結合します。設計上の正本は [`PLAN.md`](./PLAN.md) です。

## 現在の到達点

Phase 0（基盤整備）まで実装済みです。

- Vite + React 18 + TypeScript strict
- Tailwind CSS
- PWA / Service Worker
- 1件1JSONのプロンプト・モディファイアー管理
- ZodスキーマとJSON Schema生成
- ID、参照、入力数、テンプレート変数のCI検証
- 日本語検索評価の最小ハーネス
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

1. `npm run new:prompt` で雛形を作る、または `data/prompts/` にJSONを追加する
2. ファイル名と `id` を一致させる（例：`writing-004.json`）
3. `searchPhrases` を5〜10件入れる
4. 必須入力は2件以内、任意入力は4件以内にする
5. `npm run validate:data` を実行する

モディファイアーは `data/modifiers/` に追加します。スキーマの参照用ファイルは `data/schema/` に自動生成されます。

## データの安全性

将来の利用画面でも、貼り付けた本文や業務データは自動保存しません。お気に入りや利用履歴など、個人化に必要な情報だけを端末内へ保存する設計です。

## 公開URL

GitHub Pages: `https://silovar-uk.github.io/prompts/`
