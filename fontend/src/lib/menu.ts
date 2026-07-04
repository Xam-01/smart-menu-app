import type { AllergenType, PublicMenuItem } from './types';

export function shouldHideForAllergens(
  item: PublicMenuItem,
  selectedAllergens: AllergenType[],
): boolean {
  if (selectedAllergens.length === 0) return false;
  if (item.allergenLabel === 'red' || item.allergenLabel === 'yellow') return true;

  const selected = new Set(selectedAllergens);
  return item.allergenTags.some(
    (tag) =>
      selected.has(tag.allergen) &&
      (tag.confidence === 'contains' || tag.confidence === 'may_contain'),
  );
}
