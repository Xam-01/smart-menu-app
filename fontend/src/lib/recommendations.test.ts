import { describe, expect, it } from 'vitest';
import { getAiDishSuggestions } from './recommendations';
import type { PublicMenu } from './types';

const menu: PublicMenu = {
  restaurant: {
    id: 'restaurant-1',
    name: 'Hotpot House',
    address: '1 Le Loi',
  },
  menu: {
    id: 'menu-1',
    version: 1,
  },
  categories: {
    'Món chính': [
      {
        id: 'beef',
        nameVi: 'Bò nhúng lẩu',
        name: 'Bò nhúng lẩu',
        description: 'Món lẩu cay nổi bật',
        price: 120000,
        category: 'Món chính',
        allergenTags: [],
        allergenVerified: true,
        allergenLabel: 'green',
      },
      {
        id: 'shrimp',
        nameVi: 'Tôm sốt cay',
        name: 'Tôm sốt cay',
        description: 'Hải sản cay',
        price: 140000,
        category: 'Món chính',
        allergenTags: [{ allergen: 'crustacean', confidence: 'contains' }],
        allergenVerified: true,
        allergenLabel: 'red',
      },
    ],
    'Đồ uống': [
      {
        id: 'tea',
        nameVi: 'Trà hoa',
        name: 'Trà hoa',
        description: 'Dịu nhẹ',
        price: 30000,
        category: 'Đồ uống',
        allergenTags: [],
        allergenVerified: true,
        allergenLabel: 'none',
      },
    ],
  },
  guestAllergens: ['crustacean'],
  language: 'vi',
  disclaimer: 'Kiểm tra dị ứng với nhân viên.',
};

describe('AI dish recommendations', () => {
  it('prioritizes dishes that match the preference and avoid selected allergens', () => {
    const suggestions = getAiDishSuggestions({
      menu,
      selectedAllergens: ['crustacean'],
      preference: 'ăn cay',
    });

    expect(suggestions.map((suggestion) => suggestion.item.id)).toEqual(['beef', 'tea']);
    expect(suggestions[0].reason).toContain('hợp khẩu vị');
    expect(suggestions.some((suggestion) => suggestion.item.id === 'shrimp')).toBe(false);
  });

  it('returns a warning suggestion when every dish has allergy risk', () => {
    const riskyMenu: PublicMenu = {
      ...menu,
      categories: {
        'Món chính': [menu.categories['Món chính'][1]],
      },
    };

    expect(getAiDishSuggestions({
      menu: riskyMenu,
      selectedAllergens: ['crustacean'],
      preference: '',
    })).toEqual([
      expect.objectContaining({
        item: expect.objectContaining({ id: 'shrimp' }),
        risk: 'red',
      }),
    ]);
  });
});
