import type { InputField, Prompt } from "../src/schema/catalog";

type ImagePromptDefinition = {
  id: string;
  title: string;
  shortTitle: string;
  emoji: string;
  problem: string;
  summary: string;
  searchPhrases: string[];
  inputId: string;
  inputLabel: string;
  inputPlaceholder: string;
  promptTemplate: string;
  optionalInputs?: InputField[];
  intents?: string[];
  inputTypes?: string[];
  outputTypes?: string[];
  tags?: string[];
  mobilePriority?: number;
};

function makeImagePrompt(definition: ImagePromptDefinition): Prompt {
  return {
    id: definition.id,
    type: "base",
    version: 1,
    title: definition.title,
    shortTitle: definition.shortTitle,
    emoji: definition.emoji,
    problem: definition.problem,
    summary: definition.summary,
    category: "image",
    intents: definition.intents ?? ["create"],
    inputTypes: definition.inputTypes ?? ["memo", "text"],
    outputTypes: definition.outputTypes ?? ["image-prompt"],
    audiences: ["general"],
    stages: ["draft"],
    tags: ["画像生成", ...(definition.tags ?? [])].slice(0, 8),
    searchPhrases: definition.searchPhrases,
    requiredInputs: [{
      id: definition.inputId,
      label: definition.inputLabel,
      type: "textarea",
      placeholder: definition.inputPlaceholder
    }],
    optionalInputs: definition.optionalInputs ?? [],
    promptTemplate: definition.promptTemplate,
    compatibleModifiers: [],
    relatedIds: [],
    mobilePriority: definition.mobilePriority ?? 4,
    updatedAt: "2026-07-14"
  };
}

const toneField: InputField = {
  id: "tone",
  label: "トーン",
  type: "text",
  placeholder: "上品、力強い、親しみやすい など"
};

const formatField: InputField = {
  id: "format",
  label: "用途・サイズ",
  type: "text",
  placeholder: "Instagram正方形、縦長、Webバナー など"
};

export const imagePrompts: Prompt[] = [
  makeImagePrompt({
    id: "image-001",
    title: "イベント告知KVを作る",
    shortTitle: "イベント告知KV",
    emoji: "🖼️",
    problem: "イベント告知用のキービジュアルを作りたい",
    summary: "イベント情報を、文字を載せやすく視認性の高い告知KVへ変換します。",
    searchPhrases: ["イベント告知画像を作りたい", "KVを作りたい", "告知ビジュアルを作る", "イベントのキービジュアル", "告知画像を作る"],
    inputId: "eventInfo",
    inputLabel: "イベント情報",
    inputPlaceholder: "イベント名、日時、場所、訴求点、対象者",
    optionalInputs: [toneField, formatField],
    tags: ["告知", "KV", "イベント"],
    mobilePriority: 5,
    promptTemplate: `以下のイベント情報をもとに、画像生成AIへそのまま渡せる完成プロンプトを作成してください。\n\nイベント情報:\n{{eventInfo}}\n{{#tone}}\nトーン: {{tone}}\n{{/tone}}{{#format}}\n用途・サイズ: {{format}}\n{{/format}}\n要件:\n- 告知画像として一目で内容が伝わる\n- 日本語のタイトルや日時を後から載せやすい余白を確保する\n- 主役、背景、情報エリアの階層を明確にする\n- 視認性とブランド感を両立する\n- 最後に完成した画像生成プロンプトだけを出力する`
  }),
  makeImagePrompt({
    id: "image-002",
    title: "試合告知画像を作る",
    shortTitle: "試合告知画像",
    emoji: "⚽",
    problem: "対戦カードや試合の高揚感が伝わる画像を作りたい",
    summary: "対戦カード、日時、会場を載せやすいスポーツ告知ビジュアルを設計します。",
    searchPhrases: ["試合告知画像を作る", "マッチデー画像", "対戦カード画像", "試合のKV", "スポーツ告知ビジュアル"],
    inputId: "matchInfo",
    inputLabel: "試合情報",
    inputPlaceholder: "大会名、対戦カード、日時、会場、訴求点",
    optionalInputs: [toneField, formatField],
    tags: ["試合", "スポーツ", "告知"],
    mobilePriority: 5,
    promptTemplate: `以下の試合情報から、スポーツ告知画像の完成プロンプトを作成してください。\n\n試合情報:\n{{matchInfo}}\n{{#tone}}\n表現トーン: {{tone}}\n{{/tone}}{{#format}}\n掲載先・比率: {{format}}\n{{/format}}\n要件:\n- 対戦の緊張感と期待感がある\n- 選手や象徴的モチーフを主役にする\n- 対戦カード、日時、会場の文字を後載せしやすい\n- 過剰なエフェクトに頼らず力強く整理する\n- 最後に完成プロンプトだけを出力する`
  }),
  makeImagePrompt({
    id: "image-003",
    title: "募集告知画像を作る",
    shortTitle: "募集告知画像",
    emoji: "📣",
    problem: "参加者募集や応募案内を一目で伝えたい",
    summary: "対象者と応募の魅力が明確な募集告知画像を設計します。",
    searchPhrases: ["募集告知画像を作る", "参加者募集の画像", "応募案内画像", "申込告知画像", "エントリー募集画像"],
    inputId: "recruitInfo",
    inputLabel: "募集内容",
    inputPlaceholder: "募集対象、内容、締切、参加メリット、申込方法",
    optionalInputs: [toneField, formatField],
    tags: ["募集", "応募", "告知"],
    promptTemplate: `以下の募集内容をもとに、応募や参加につながる告知画像の完成プロンプトを作成してください。\n\n募集内容:\n{{recruitInfo}}\n{{#tone}}\nトーン: {{tone}}\n{{/tone}}{{#format}}\n用途・サイズ: {{format}}\n{{/format}}\n要件:\n- 誰向けの募集かが一目で分かる\n- 参加する魅力を視覚化する\n- 募集名、締切、CTAを後載せしやすい\n- 不安より期待が勝つ表現にする\n- 最後に完成プロンプトだけを出力する`
  }),
  makeImagePrompt({
    id: "image-004",
    title: "1枚の要約インフォグラフィックを作る",
    shortTitle: "要約インフォグラフィック",
    emoji: "📊",
    problem: "長い情報を1枚で理解できる図解にしたい",
    summary: "要点と数字の階層を整理し、1枚で伝わる図解構成を作ります。",
    searchPhrases: ["インフォグラフィックを作る", "1枚でまとめたい", "要約を画像化", "図解画像を作る", "情報を一枚にする"],
    inputId: "sourceText",
    inputLabel: "元情報",
    inputPlaceholder: "図解したい文章、数値、箇条書き",
    optionalInputs: [
      { id: "audience", label: "読み手", type: "text", placeholder: "一般向け、初心者、社内 など" },
      { id: "focus", label: "強調点", type: "text", placeholder: "結論、数字、比較、流れ など" }
    ],
    intents: ["arrange", "create"],
    tags: ["図解", "要約", "情報整理"],
    mobilePriority: 5,
    promptTemplate: `以下の元情報を、1枚のインフォグラフィックへ変換する画像生成プロンプトを作成してください。\n\n元情報:\n{{sourceText}}\n{{#audience}}\n読み手: {{audience}}\n{{/audience}}{{#focus}}\n強調点: {{focus}}\n{{/focus}}\n要件:\n- 結論、主要ポイント、補足の3階層に整理する\n- 数字や比較は視線誘導の中心に置く\n- 装飾より情報理解を優先する\n- 日本語文字を後載せする領域を明確にする\n- 完成プロンプトだけを出力する`
  }),
  makeImagePrompt({
    id: "image-005",
    title: "複数枚の解説画像に分解する",
    shortTitle: "複数枚の解説画像",
    emoji: "🧩",
    problem: "長いテーマを複数枚で順序よく説明したい",
    summary: "内容をページ単位に分け、各画像の役割と生成指示を設計します。",
    searchPhrases: ["複数枚の画像にしたい", "解説画像を分割", "連番画像を作る", "複数ページの図解", "内容を画像に分ける"],
    inputId: "themeText",
    inputLabel: "解説したい内容",
    inputPlaceholder: "テーマ、要点、伝えたい順番",
    optionalInputs: [
      { id: "pageCount", label: "枚数", type: "number", placeholder: "6" },
      formatField
    ],
    intents: ["arrange", "create"],
    outputTypes: ["image-prompt", "json"],
    tags: ["複数枚", "解説", "カルーセル"],
    mobilePriority: 5,
    promptTemplate: `以下の内容を、独立した複数枚の解説画像へ分解してください。\n\n内容:\n{{themeText}}\n{{#pageCount}}\n希望枚数: {{pageCount}}枚\n{{/pageCount}}{{#format}}\n用途・比率: {{format}}\n{{/format}}\n要件:\n- 1枚目はテーマと読む理由を示す\n- 1枚につき主張は1つに絞る\n- 各ページを別画像として生成できるよう個別プロンプトにする\n- 全ページで構図、色、余白のルールを統一する\n- ページ構成一覧の後に、各画像の完成プロンプトを出力する`
  }),
  makeImagePrompt({
    id: "image-006",
    title: "比較表を画像化する",
    shortTitle: "比較表を画像化",
    emoji: "📋",
    problem: "複数の選択肢の違いを一目で比較したい",
    summary: "比較軸を整理し、差が視覚的に伝わる画像構成を作ります。",
    searchPhrases: ["比較表を画像にする", "比較を図解する", "違いを一枚で見せる", "項目比較画像", "表を画像化"],
    inputId: "comparisonData",
    inputLabel: "比較内容",
    inputPlaceholder: "比較対象、比較項目、各対象の特徴",
    optionalInputs: [{ id: "highlight", label: "強調する差", type: "text", placeholder: "価格、用途、メリット など" }, formatField],
    intents: ["compare", "create"],
    tags: ["比較", "表", "図解"],
    promptTemplate: `以下の比較内容を、1枚で違いが分かる比較画像へ変換するプロンプトを作成してください。\n\n比較内容:\n{{comparisonData}}\n{{#highlight}}\n強調する差: {{highlight}}\n{{/highlight}}{{#format}}\n用途・サイズ: {{format}}\n{{/format}}\n要件:\n- 比較軸を揃える\n- 差が小さい項目は装飾で誇張しない\n- 視線を左右または上下へ自然に動かす\n- 見出しと数値を後載せしやすくする\n- 完成プロンプトだけを出力する`
  }),
  makeImagePrompt({
    id: "image-007",
    title: "タイムライン画像を作る",
    shortTitle: "タイムライン画像",
    emoji: "🕒",
    problem: "出来事や工程を時系列で分かりやすく見せたい",
    summary: "順番と節目が読み取りやすいタイムライン図解を設計します。",
    searchPhrases: ["タイムライン画像を作る", "時系列を画像にする", "工程を図解する", "歴史を画像化", "流れを一枚にする"],
    inputId: "timelineInfo",
    inputLabel: "時系列情報",
    inputPlaceholder: "日付または順番、出来事、補足",
    optionalInputs: [{ id: "orientation", label: "向き", type: "select", options: ["縦", "横"] }, formatField],
    intents: ["arrange", "create"],
    tags: ["時系列", "工程", "図解"],
    promptTemplate: `以下の時系列情報を、読みやすいタイムライン画像へ変換する完成プロンプトを作成してください。\n\n時系列情報:\n{{timelineInfo}}\n{{#orientation}}\n向き: {{orientation}}\n{{/orientation}}{{#format}}\n用途・サイズ: {{format}}\n{{/format}}\n要件:\n- 時間の進行方向を明確にする\n- 各節目の重要度を大きさで示す\n- 情報量を均等に詰め込まず重要箇所に余白を使う\n- 日付と説明を後載せしやすくする\n- 完成プロンプトだけを出力する`
  }),
  makeImagePrompt({
    id: "image-008",
    title: "サムネイル画像を作る",
    shortTitle: "サムネイル画像",
    emoji: "🎯",
    problem: "小さく表示されても内容が伝わるサムネイルを作りたい",
    summary: "主題と感情を一瞬で伝える、クリックされやすい構図を作ります。",
    searchPhrases: ["サムネイル画像を作る", "YouTubeサムネを作る", "記事サムネイル", "クリックされる画像", "目立つサムネ"],
    inputId: "thumbTheme",
    inputLabel: "テーマ・訴求",
    inputPlaceholder: "動画や記事の内容、タイトル案、見せたい感情",
    optionalInputs: [toneField, formatField],
    tags: ["サムネイル", "YouTube", "訴求"],
    promptTemplate: `以下のテーマをもとに、小さく表示しても意味が伝わるサムネイル画像の完成プロンプトを作成してください。\n\nテーマ・訴求:\n{{thumbTheme}}\n{{#tone}}\nトーン: {{tone}}\n{{/tone}}{{#format}}\n媒体・比率: {{format}}\n{{/format}}\n要件:\n- 主役を1つに絞る\n- 背景との明暗差を確保する\n- 見出し文字を置く余白を確保する\n- 細かい要素を増やしすぎない\n- 完成プロンプトだけを出力する`
  }),
  makeImagePrompt({
    id: "image-009",
    title: "アプリアイコン画像を作る",
    shortTitle: "アプリアイコン",
    emoji: "🔷",
    problem: "小さくても識別できるアプリの象徴を作りたい",
    summary: "サービスの中核を単純な形へ落とし込み、アイコン用プロンプトを作ります。",
    searchPhrases: ["アプリアイコンを作る", "サービスアイコン", "アイコン画像を作りたい", "アプリのロゴ画像", "小さいアイコン"],
    inputId: "iconConcept",
    inputLabel: "アイコンのコンセプト",
    inputPlaceholder: "サービス名、用途、象徴するモチーフ、色、印象",
    optionalInputs: [toneField],
    tags: ["アイコン", "アプリ", "シンボル"],
    mobilePriority: 5,
    promptTemplate: `以下のコンセプトから、モバイルアプリ用アイコンの完成プロンプトを作成してください。\n\nコンセプト:\n{{iconConcept}}\n{{#tone}}\nスタイル・印象: {{tone}}\n{{/tone}}\n要件:\n- 角丸正方形の中で中央構図にする\n- 小さく表示しても輪郭が識別できる\n- モチーフは1〜2個に絞る\n- 文字や細い線に依存しない\n- 1024×1024の制作を想定する\n- 完成プロンプトだけを出力する`
  }),
  makeImagePrompt({
    id: "image-010",
    title: "favicon向け画像を作る",
    shortTitle: "favicon画像",
    emoji: "⭐",
    problem: "16pxでも潰れないサイトの目印を作りたい",
    summary: "色と輪郭を絞り、極小サイズでも判別できるfaviconを設計します。",
    searchPhrases: ["faviconを作る", "ファビコン画像", "ブラウザアイコン", "16pxのアイコン", "小さいサイトアイコン"],
    inputId: "faviconConcept",
    inputLabel: "faviconのコンセプト",
    inputPlaceholder: "サイト名、モチーフ、色、残したい特徴",
    optionalInputs: [toneField],
    tags: ["favicon", "アイコン", "Web"],
    mobilePriority: 5,
    promptTemplate: `以下のコンセプトを、favicon向けの極めて単純な画像へ変換する完成プロンプトを作成してください。\n\nコンセプト:\n{{faviconConcept}}\n{{#tone}}\nスタイル: {{tone}}\n{{/tone}}\n要件:\n- 16pxと32pxで識別できる\n- シルエットを単純にする\n- 色数は2〜3色に抑える\n- 文字、細線、細かな陰影を使わない\n- 正方形の中央へ配置する\n- 完成プロンプトだけを出力する`
  }),
  makeImagePrompt({
    id: "image-011",
    title: "アプリ紹介画像を作る",
    shortTitle: "アプリ紹介画像",
    emoji: "📱",
    problem: "アプリの特徴や利用場面を1枚で紹介したい",
    summary: "画面モックアップと価値が両立する紹介ビジュアルを設計します。",
    searchPhrases: ["アプリ紹介画像を作る", "機能紹介ビジュアル", "アプリのモックアップ", "ツール紹介画像", "サービス紹介バナー"],
    inputId: "appInfo",
    inputLabel: "アプリ情報",
    inputPlaceholder: "名称、用途、主要機能、利用者、特徴",
    optionalInputs: [toneField, formatField],
    tags: ["アプリ", "紹介", "モックアップ"],
    promptTemplate: `以下のアプリ情報をもとに、アプリ紹介用ビジュアルの完成プロンプトを作成してください。\n\nアプリ情報:\n{{appInfo}}\n{{#tone}}\nトーン: {{tone}}\n{{/tone}}{{#format}}\n掲載先・サイズ: {{format}}\n{{/format}}\n要件:\n- スマートフォンまたはPC画面のモックアップを主役にする\n- 利用場面が直感的に伝わる\n- 機能名やコピーを後載せできる\n- 広告的に盛りすぎず実用感を残す\n- 完成プロンプトだけを出力する`
  }),
  makeImagePrompt({
    id: "image-012",
    title: "LPヒーロー画像を作る",
    shortTitle: "LPヒーロー画像",
    emoji: "🚀",
    problem: "ページを開いた瞬間に価値が伝わる画像を作りたい",
    summary: "コピーやCTAと競合せず、サービスの世界観を伝えるメイン画像を作ります。",
    searchPhrases: ["LPヒーロー画像を作る", "ファーストビュー画像", "トップ画像を作る", "Webのメインビジュアル", "ランディングページ画像"],
    inputId: "lpInfo",
    inputLabel: "LP情報",
    inputPlaceholder: "サービス内容、対象者、価値、コピー、世界観",
    optionalInputs: [toneField, formatField],
    tags: ["LP", "Web", "ヒーロー"],
    promptTemplate: `以下のLP情報から、ファーストビュー用ヒーロー画像の完成プロンプトを作成してください。\n\nLP情報:\n{{lpInfo}}\n{{#tone}}\nトーン: {{tone}}\n{{/tone}}{{#format}}\n画面比率: {{format}}\n{{/format}}\n要件:\n- コピーとCTAを置く側に十分な余白を確保する\n- サービスの価値を抽象表現だけでごまかさない\n- PCとスマホでトリミングしやすい中央安全領域を持つ\n- 背景として使える情報密度に抑える\n- 完成プロンプトだけを出力する`
  }),
  makeImagePrompt({
    id: "image-013",
    title: "画像生成用の完成プロンプトを作る",
    shortTitle: "画像プロンプト作成",
    emoji: "✍️",
    problem: "雑なイメージを画像生成AIに伝わる指示へ変えたい",
    summary: "用途、構図、質感、制約を整理して、そのまま使える指示文にします。",
    searchPhrases: ["画像生成プロンプトを作る", "画像AIの指示文", "画像プロンプトを改善", "作りたい画像を言語化", "画像生成の完成指示"],
    inputId: "imageRequest",
    inputLabel: "作りたい画像",
    inputPlaceholder: "内容、用途、雰囲気、入れたい要素、避けたい表現",
    optionalInputs: [formatField],
    intents: ["arrange", "create"],
    tags: ["プロンプト", "生成AI", "指示文"],
    mobilePriority: 5,
    promptTemplate: `以下の要望を、画像生成AIへそのまま渡せる完成プロンプトへ変換してください。\n\n要望:\n{{imageRequest}}\n{{#format}}\n用途・サイズ: {{format}}\n{{/format}}\n要件:\n- 主題、構図、背景、光、質感、カメラ距離を必要な範囲で具体化する\n- 元の要望にない過剰な要素を増やさない\n- 文字入れが必要な場合は余白設計として指示する\n- 避けるべき要素も短く明示する\n- 完成プロンプトだけを出力する`
  }),
  makeImagePrompt({
    id: "image-014",
    title: "複数画像用のJSONを作る",
    shortTitle: "複数画像JSON",
    emoji: "🧱",
    problem: "複数枚を1枚にまとめず、個別画像として安定生成したい",
    summary: "共通ルールとページ固有指示を分離したJSON設計を作ります。",
    searchPhrases: ["画像用JSONを作る", "複数枚出力のJSON", "画像プロンプトをJSON化", "ページごとの画像指示", "連番画像JSON"],
    inputId: "multiImagePlan",
    inputLabel: "作りたい画像セット",
    inputPlaceholder: "テーマ、枚数、各ページの内容、共通デザイン",
    optionalInputs: [{ id: "jsonRules", label: "必要なキー", type: "text", placeholder: "title、prompt、aspectRatio など" }],
    intents: ["arrange", "convert"],
    outputTypes: ["json"],
    tags: ["JSON", "複数枚", "構造化"],
    mobilePriority: 5,
    promptTemplate: `以下の画像セットを、各画像が明確に分離されたJSONへ変換してください。\n\n画像セット:\n{{multiImagePlan}}\n{{#jsonRules}}\n必要なキー: {{jsonRules}}\n{{/jsonRules}}\n要件:\n- ルートは画像配列にする\n- 各要素に一意のid、役割、個別プロンプトを持たせる\n- 共通デザインルールと個別内容を混同しない\n- 画像を1枚へ統合する指示を入れない\n- JSON以外の説明文を出力しない`
  }),
  makeImagePrompt({
    id: "image-015",
    title: "画像プロンプトをJinja2化する",
    shortTitle: "Jinja2変数化",
    emoji: "🪄",
    problem: "画像生成指示を差し替えて繰り返し使いたい",
    summary: "固定するデザインルールと可変内容を分け、Jinja2テンプレートにします。",
    searchPhrases: ["画像プロンプトをJinja2にする", "画像指示を変数化", "JSONをJinja化", "画像テンプレートを作る", "再利用できる画像プロンプト"],
    inputId: "templateSource",
    inputLabel: "元のプロンプト・JSON",
    inputPlaceholder: "テンプレート化したい画像生成指示",
    optionalInputs: [{ id: "variablePolicy", label: "変数化方針", type: "text", placeholder: "人物名と色だけ変えたい など" }],
    intents: ["arrange", "convert"],
    outputTypes: ["text"],
    tags: ["Jinja2", "テンプレート", "変数"],
    promptTemplate: `以下の画像生成指示をJinja2テンプレートへ変換してください。\n\n元データ:\n{{templateSource}}\n{{#variablePolicy}}\n変数化方針: {{variablePolicy}}\n{{/variablePolicy}}\n要件:\n- 固定すべきデザインルールは本文へ残す\n- 差し替える項目だけを分かりやすい変数名にする\n- 変数一覧と既定値の例を付ける\n- JSONの場合は構造を壊さない\n- 最後にJinja2テンプレートをコードブロックで出力する`
  }),
  makeImagePrompt({
    id: "image-016",
    title: "画像生成結果を批評して改善する",
    shortTitle: "画像の改善指示",
    emoji: "🧪",
    problem: "生成画像の違和感を具体的な再生成指示へ変えたい",
    summary: "残す点、問題点、修正方法を分けて、次の生成指示へ変換します。",
    searchPhrases: ["画像を改善したい", "生成画像を批評", "画像の違和感を直す", "再生成の指示を作る", "画像修正プロンプト"],
    inputId: "resultDescription",
    inputLabel: "画像の状態・直したい点",
    inputPlaceholder: "現在の画像の特徴、違和感、残したい部分、理想",
    optionalInputs: [{ id: "originalPrompt", label: "元の指示", type: "textarea", placeholder: "使用した画像生成プロンプト" }],
    intents: ["inspect", "improve"],
    inputTypes: ["image", "memo", "text"],
    tags: ["批評", "改善", "再生成"],
    promptTemplate: `以下の画像生成結果を批評し、改善された再生成プロンプトを作成してください。\n\n画像の状態・直したい点:\n{{resultDescription}}\n{{#originalPrompt}}\n元の指示:\n{{originalPrompt}}\n{{/originalPrompt}}\n要件:\n- 良い点、問題点、原因、改善方法を分ける\n- 構図、情報量、視線誘導、質感、文字余白を確認する\n- 残す要素と削る要素を明示する\n- 最後に改善後の完成プロンプトだけを独立して出力する`
  }),
  makeImagePrompt({
    id: "image-017",
    title: "同じデザインで画像を量産する",
    shortTitle: "画像バリエーション量産",
    emoji: "♻️",
    problem: "同じ世界観を保ちながら内容違いの画像を作りたい",
    summary: "固定要素と差し替え要素を定義し、量産用の指示セットを作ります。",
    searchPhrases: ["同じデザインで画像を量産", "別バージョンを作る", "画像の差し替え版", "共通デザインで複数作る", "バリエーション画像"],
    inputId: "designRule",
    inputLabel: "共通デザインと差し替え内容",
    inputPlaceholder: "固定する色・構図・質感、各版で変える内容",
    optionalInputs: [{ id: "variationCount", label: "作成数", type: "number", placeholder: "5" }, formatField],
    intents: ["arrange", "create"],
    outputTypes: ["image-prompt", "json"],
    tags: ["量産", "バリエーション", "テンプレート"],
    promptTemplate: `以下の条件から、同じデザインルールを保った画像バリエーションを設計してください。\n\n共通デザインと差し替え内容:\n{{designRule}}\n{{#variationCount}}\n作成数: {{variationCount}}\n{{/variationCount}}{{#format}}\n用途・サイズ: {{format}}\n{{/format}}\n要件:\n- 固定要素と可変要素を最初に整理する\n- 各バージョンを別画像として生成できる個別指示にする\n- 色、余白、カメラ距離、質感の一貫性を保つ\n- 各版の違いが意図的に見えるようにする\n- 最後に量産用プロンプト一覧またはJSONを出力する`
  }),
  makeImagePrompt({
    id: "image-018",
    title: "SNSカルーセル画像を作る",
    shortTitle: "SNSカルーセル",
    emoji: "📚",
    problem: "SNSで読み進めたくなる複数枚の画像を作りたい",
    summary: "表紙から結論までの流れを設計し、各ページの画像指示を作ります。",
    searchPhrases: ["SNSカルーセル画像を作る", "Instagram複数枚投稿", "連番投稿画像", "SNS解説画像", "カルーセルを作る"],
    inputId: "carouselTheme",
    inputLabel: "テーマと伝えたい内容",
    inputPlaceholder: "主題、要点、読後にしてほしい行動",
    optionalInputs: [{ id: "pageCount", label: "枚数", type: "number", placeholder: "7" }, formatField],
    intents: ["arrange", "create"],
    outputTypes: ["image-prompt", "json"],
    tags: ["SNS", "カルーセル", "複数枚"],
    mobilePriority: 5,
    promptTemplate: `以下のテーマから、SNSカルーセル用の複数画像を設計してください。\n\nテーマと内容:\n{{carouselTheme}}\n{{#pageCount}}\n枚数: {{pageCount}}\n{{/pageCount}}{{#format}}\n媒体・比率: {{format}}\n{{/format}}\n要件:\n- 1枚目は短い問いまたは結論で興味を引く\n- 中盤は1ページ1要点で読み進めやすくする\n- 最終ページは要約と次の行動を示す\n- 全ページでグリッド、余白、書体領域、色を統一する\n- ページ構成の後に各画像の完成プロンプトを出力する`
  })
];
