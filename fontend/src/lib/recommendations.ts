import type { AllergenType, PublicMenu, PublicMenuItem } from './types';

export type AiDishSuggestion = {
  item: PublicMenuItem;
  reason: string;
  risk: PublicMenuItem['allergenLabel'];
};

type SuggestionInput = {
  menu: PublicMenu;
  selectedAllergens: AllergenType[];
  preference: string;
  limit?: number;
};

const RISK_SCORE: Record<PublicMenuItem['allergenLabel'], number> = {
  none: 3,
  green: 3,
  yellow: 1,
  red: -8,
};

const PREFERENCE_KEYWORDS: Record<string, string[]> = {
  cay: ['cay', 'lẩu', 'nướng', 'sốt'],
  nhẹ: ['nhẹ', 'salad', 'rau', 'trà', 'canh'],
  nước: ['nước', 'trà', 'sữa', 'đồ uống'],
  no: ['cơm', 'mì', 'bún', 'phở', 'lẩu', 'món chính'],
  tiết: ['rẻ', 'tiết kiệm', 'khai vị', 'đồ uống'],
};

export function getAiDishSuggestions({
  menu,
  selectedAllergens,
  preference,
  limit = 3,
}: SuggestionInput): AiDishSuggestion[] {
  const normalizedPreference = preference.trim().toLocaleLowerCase('vi-VN');
  const selected = new Set(selectedAllergens);
  const items = Object.values(menu.categories).flat();

  const scored = items
    .map((item) => {
      const risk = getItemRisk(item, selected);
      const haystack = `${item.name} ${item.nameVi} ${item.description ?? ''} ${item.category}`.toLocaleLowerCase('vi-VN');
      const preferenceScore = getPreferenceScore(haystack, normalizedPreference);
      return {
        item,
        risk,
        score: RISK_SCORE[risk] + preferenceScore,
        reason: buildReason(preferenceScore, risk),
      };
    })
    .sort((left, right) => right.score - left.score || left.item.price - right.item.price);

  const safeSuggestions = scored.filter((suggestion) => suggestion.risk !== 'red').slice(0, limit);
  const selectedSuggestions = safeSuggestions.length > 0 ? safeSuggestions : scored.slice(0, limit);

  return selectedSuggestions.map(({ item, reason, risk }) => ({ item, reason, risk }));
}

function getPreferenceScore(haystack: string, preference: string): number {
  if (!preference) return 0;
  const directMatch = haystack.includes(preference) ? 4 : 0;
  const keywordMatch = Object.entries(PREFERENCE_KEYWORDS).some(([key, keywords]) =>
    preference.includes(key) && keywords.some((keyword) => haystack.includes(keyword)),
  )
    ? 3
    : 0;
  return directMatch + keywordMatch;
}

function getItemRisk(
  item: PublicMenuItem,
  selectedAllergens: Set<AllergenType>,
): PublicMenuItem['allergenLabel'] {
  if (item.allergenLabel === 'red' || item.allergenLabel === 'yellow') return item.allergenLabel;
  const matchingTag = item.allergenTags.find((tag) => selectedAllergens.has(tag.allergen));
  if (!matchingTag) return item.allergenLabel;
  return matchingTag.confidence === 'contains' ? 'red' : 'yellow';
}

function buildReason(score: number, risk: PublicMenuItem['allergenLabel']): string {
  if (risk === 'red') return 'có rủi ro dị ứng, cần hỏi nhân viên';
  if (risk === 'yellow') return 'cần kiểm tra dị ứng trước khi đặt';
  if (score > 0) return 'hợp khẩu vị và ít rủi ro dị ứng';
  return 'phù hợp để gọi kèm và ít rủi ro dị ứng';
}
