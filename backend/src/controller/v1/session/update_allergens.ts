/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import logger from 'src/lib/logger';
import Session, { ALLERGEN_TYPES, AllergenType } from 'src/model/session.model';
import type { Request, Response } from 'express';

const updateAllergens = async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;
  const { allergens, preferences } = req.body as {
    allergens: AllergenType[];
    preferences?: string[];
  };

  const session = await Session.findOne({ sessionId });
  if (!session) {
    res.status(404).json({
      success: false,
      code: 'SESSION_NOT_FOUND',
      message: 'Session không tồn tại hoặc đã hết hạn',
    });
    return;
  }

  if (session.expiresAt < new Date()) {
    res.status(401).json({
      success: false,
      code: 'SESSION_EXPIRED',
      message: 'Session đã hết hạn, vui lòng quét QR lại',
    });
    return;
  }

  const invalidAllergens = allergens.filter(
    (a) => !ALLERGEN_TYPES.includes(a as AllergenType),
  );
  if (invalidAllergens.length > 0) {
    res.status(422).json({
      success: false,
      code: 'INVALID_ALLERGENS',
      message: `Allergen không hợp lệ: ${invalidAllergens.join(', ')}`,
    });
    return;
  }

  session.allergens = allergens.map((a) => ({
    allergen: a,
    addedAt: new Date(),
  }));
  if (preferences !== undefined) session.preferences = preferences;
  session.lastInteractionAt = new Date();
  await session.save();

  logger.info(
    `Allergens updated for session: ${sessionId} - [${allergens.join(', ')}]`,
  );

  res.status(200).json({
    success: true,
    message: 'Thông tin dị ứng đã được cập nhật',
    data: {
      sessionId: session.sessionId,
      allergens: session.allergens.map((a) => a.allergen),
      preferences: session.preferences,
    },
  });
};

export default updateAllergens;
