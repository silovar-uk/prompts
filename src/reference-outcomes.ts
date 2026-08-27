import type { Prompt } from "./schema/catalog";

type OutcomePrompt = Pick<Prompt, "id" | "outputTypes">;

const defaultOutputLabels: Record<string, string> = {
  body: "完成文",
  analysis: "分析",
  outline: "構成案",
  minutes: "議事録",
  agenda: "アジェンダ",
  email: "メール",
  ideas: "企画案",
  concept: "コンセプト",
  "action-plan": "実行計画",
  checklist: "チェックリスト",
  explanation: "解説",
  comparison: "比較表",
  "case-list": "事例一覧",
  "verification-plan": "確認計画",
  "press-release": "プレスリリース",
  newsletter: "メルマガ原稿",
  "social-posts": "SNS投稿案",
  "risk-review": "点検結果",
  tsv: "TSV",
  requirements: "要件定義",
  "code-review": "コードレビュー",
  "slide-outline": "スライド構成",
  "image-prompt": "画像生成プロンプト",
  json: "JSON",
  text: "文章",
  lesson: "教材"
};

// Card outcomes answer “what will I have when this prompt is done?”
// Keep them concrete enough to distinguish neighboring prompts without adding another UI row.
const outcomeLabelOverrides: Record<string, string> = {
  "writing-001": "短くした完成文",
  "writing-002": "トーン調整済み本文",
  "writing-003": "送れる実務メール",
  "writing-004": "文章化した完成本文",
  "writing-005": "点検済みの修正版",
  "meeting-001": "決定事項＋TODO",
  "meeting-002": "共有用議事録",
  "meeting-004": "会議後フォローメール",
  "planning-001": "弱点＋改善点",
  "planning-004": "優先順位つき実行案",
  "planning-005": "リスク＋先回り策",
  "research-001": "調査手順＋確認先",
  "pr-004": "点検済み対外説明文",
  "data-002": "傾向＋異常点",
  "visual-002": "再現用の画像指示",
  "learning-001": "初学者向け解説",
  "learning-002": "暗記カードPDF",
  "image-001": "イベントKV生成指示",
  "image-002": "試合告知の生成指示",
  "image-003": "募集告知の生成指示",
  "image-004": "1枚図解の生成指示",
  "image-005": "ページ別の生成指示",
  "image-006": "比較図解の生成指示",
  "image-007": "時系列図解の生成指示",
  "image-008": "サムネ生成指示",
  "image-009": "アプリアイコン指示",
  "image-010": "favicon生成指示",
  "image-011": "アプリ紹介の生成指示",
  "image-012": "LPヒーロー生成指示",
  "image-013": "完成画像プロンプト",
  "image-014": "共通＋個別指示JSON",
  "image-015": "Jinja2テンプレート",
  "image-016": "再生成用の改善指示",
  "image-017": "量産用の指示セット",
  "image-018": "ページ別SNS生成指示"
};

const outcomeTypesThatNeedSpecificCopy = new Set([
  "body",
  "analysis",
  "action-plan",
  "risk-review",
  "image-prompt",
  "lesson",
  "text"
]);

export function resolveOutcomeLabel(prompt: OutcomePrompt): string {
  const outputType = prompt.outputTypes[0] ?? "";
  return outcomeLabelOverrides[prompt.id]
    ?? defaultOutputLabels[outputType]
    ?? outputType
    ?? "成果物";
}

export function validateOutcomeLabels(prompts: readonly OutcomePrompt[]): void {
  const issues: string[] = [];
  const labelsByType = new Map<string, Map<string, string[]>>();

  for (const prompt of prompts) {
    const outputType = prompt.outputTypes[0] ?? "";
    const label = resolveOutcomeLabel(prompt);

    if (!label || label === "成果物") issues.push(`${prompt.id}: 成果物名を解決できません`);
    if (label.length > 16) issues.push(`${prompt.id}: 返るものが長すぎます（${label.length}文字）— ${label}`);
    if (outcomeTypesThatNeedSpecificCopy.has(outputType) && !outcomeLabelOverrides[prompt.id]) {
      issues.push(`${prompt.id}: ${outputType} は具体的な返るもの表現が必要です`);
    }

    if (!labelsByType.has(outputType)) labelsByType.set(outputType, new Map());
    const labels = labelsByType.get(outputType)!;
    labels.set(label, [...(labels.get(label) ?? []), prompt.id]);
  }

  for (const [outputType, labels] of labelsByType) {
    for (const [label, ids] of labels) {
      if (ids.length > 1) {
        issues.push(`${outputType}: 「${label}」が重複しています — ${ids.join(", ")}`);
      }
    }
  }

  if (issues.length) {
    throw new Error(`カード用「返るもの」の品質基準を満たしていません:\n${issues.join("\n")}`);
  }
}
