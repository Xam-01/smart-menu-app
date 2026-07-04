import { describe, expect, it } from 'vitest';
import { shouldHideForAllergens } from './menu';
import type { PublicMenuItem } from './types';

const baseItem: PublicMenuItem = {
  id: 'item-1',
  nameVi: 'Tom hap',
  name: 'Tom hap',
  price: 120000,
  category: 'Món chính',
  allergenTags: [],
  allergenVerified: true,
  allergenLabel: 'none',
};

describe('menu filtering', () => {
  it('hides items that contain a selected allergen', () => {
    expect(
      shouldHideForAllergens(
        {
          ...baseItem,
          allergenTags: [{ allergen: 'crustacean', confidence: 'contains' }],
        },
        ['crustacean'],
      ),
    ).toBe(true);
  });

  it('hides backend-marked risk items after session allergens are saved', () => {
    expect(shouldHideForAllergens({ ...baseItem, allergenLabel: 'yellow' }, ['milk'])).toBe(true);
  });

  it('keeps safe items visible', () => {
    expect(shouldHideForAllergens(baseItem, ['milk'])).toBe(false);
  });
});
