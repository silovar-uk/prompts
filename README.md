# Prompts

人が読んで用途を選び、同じページをAIへURLで渡して実行できる公開プロンプト・ライブラリです。

公開URL：`https://silovar-uk.github.io/prompts/`

設計上の正本は [`PLAN.md`](./PLAN.md) です。

## 基本の使い方

1. トップページで用途を検索する
2. 個別プロンプトページを開く
3. 人向けの説明を読み、用途が合うか確認する
4. 「AIへの指示をコピー」を押す
5. ChatGPT、Claude、Geminiなどへ貼る
6. 続けて対象資料と追加条件を送る

コピーされる指示には、Prompt ID、Version、固定URLが含まれます。

```text
次のURLを読み、ページに記載されたAI向け実行仕様に従ってください。

Prompt ID: image-013
Version: 1
URL: https://silovar-uk.github.io/prompts/p/image-013/v/1/
```

AIがURLを読めない場合は、個別ページの「プロンプト全文をコピー」を使います。

## 個別プロンプトの公開形式

プロンプト`image-013`の場合：

```text
/p/image-013/                 人が読みやすい最新版HTML
/p/image-013/prompt.md        AIが読みやすい最新版Markdown
/p/image-013/prompt.json      機械処理用の最新版JSON
/p/image-013/v/1/             Version 1の固定HTML
/p/image-013/v/1/prompt.md    Version 1の固定Markdown
/p/image-013/v/1/prompt.json  Version 1の固定JSON
```

全体インデックス：

```text
/prompts.md
/llms.txt
/catalog.json
/reference-catalog.json
/sitemap.xml
/robots.txt
```

## 個別ページの構成

### 人向けの説明

- このプロンプトでできること
- こんなときに使う
- 向いていないこと
- 用意するもの
- 返ってくるもの
- 入力例
- 出力イメージ

### AI向け実行仕様

- 役割
- 必須入力と任意入力
- 実行手順
- 制約
- 出力形式
- 不足情報がある場合の扱い
- 入力資料の扱い
- プロンプト本文

人向けの説明とAI向け実行仕様は、同じSchema v2データから生成します。

## 現在の収録内容

正式プロンプト30件、画像生成プロンプト18件、暗記カードPDFワークフロー1件の合計49件を収録しています。

- 文章・リライト
- 会議・議事録
- 企画・思考
- 調査・比較
- 広報・PR
- データ整理
- Web・コード
- 資料・画像生成
- 学習・解説

### 暗記カードPDF

`learning-002`は、テーマ・記事・動画文字起こしなどを、問題ページと答えページが交互に並ぶ暗記カード風PDFへ変換します。

- 内容量に応じたカード枚数の判断
- 定義、因果関係、手順、比較、判断基準などを混ぜたカード設計
- 各答えページへの詳細解説、覚え方、出典
- 公式・学術資料を優先した調査
- 縦型レイアウト、ブックマーク、クリック可能なURL
- PDF出力後の文字化け、見切れ、ページ対応、重複、リンク確認

## 入口画面

トップページは、全文検索とカテゴリ別の一覧を主役にしています。

一覧には次を表示します。

- タイトル
- Prompt IDとVersion
- カテゴリ
- 1文の用途
- 主な出力

公式プロンプトを押すと、静的な個別説明ページを開きます。

## 旧ランチャー機能

従来の入力フォーム、履歴、自作プロンプト管理は削除していません。

```text
https://silovar-uk.github.io/prompts/?mode=launcher
```

個別プロンプトページにも、その場で入力を埋めて実行用テキストを作る補助機能があります。

## データ生成

現在のカタログをSchema v2へ変換し、1件のデータからHTML、Markdown、JSONを同時生成します。

```text
src/schema/reference.ts              Schema v2
scripts/image-prompts.ts             画像生成18件
scripts/study-prompts.ts             暗記カードPDFワークフロー
scripts/build-reference-pages.ts     静的参照ページ生成
scripts/validate-reference-pages.ts  生成物検証
```

`npm run catalog`で次を一括実行します。

1. 基本プロンプトを生成
2. 画像生成18件と暗記カードPDFワークフロー1件を結合
3. 49件の静的参照ページを生成
4. HTML・Markdown・JSON・ID・Version・件数を検証

## 開発

```bash
npm install --no-audit --no-fund
npm run dev
```

主なコマンド：

```bash
npm run catalog              # カタログと参照ページを生成・検証
npm run build:references     # HTML・Markdown・JSONを生成
npm run validate:references  # 生成物の欠損と不一致を検査
npm run test:search          # 検索回帰評価
npm run test                 # ユニットテスト
npm run build                # 本番ビルド
npm run ci                   # データ、検索、テスト、ビルドを一括実行
```

## データの安全性

入力フォームへ貼り付けた本文や業務データは、自動保存しません。

端末内へ保存するのは、お気に入り、利用履歴、選択式の前回設定、自作プロンプト、アーカイブ・移行記録などです。

## 公開方針

GitHub Actionsでカタログ生成、参照ページ検証、Viteビルドを行い、GitHub Pagesへ公開します。個別プロンプトページは本文をHTMLへ直接埋め込むため、JavaScriptを実行しないクライアントやAIでも主要内容を読めます。
