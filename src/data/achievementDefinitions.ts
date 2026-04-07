import { AchievementType } from '../lib/achievements';

export interface AchievementDef {
  type: AchievementType;
  icon: string;
  gradientColors: [string, string];
  titleKey: string;
  descKey: string;
  shareTextKey: string;
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    type: 'first_expense',
    icon: 'receipt-outline',
    gradientColors: ['#1DB954', '#4AD97B'],
    titleKey: 'achievements.first_expense_title',
    descKey: 'achievements.first_expense_desc',
    shareTextKey: 'achievements.first_expense_share',
  },
  {
    type: 'debt_free',
    icon: 'checkmark-circle-outline',
    gradientColors: ['#0D9488', '#14B8A6'],
    titleKey: 'achievements.debt_free_title',
    descKey: 'achievements.debt_free_desc',
    shareTextKey: 'achievements.debt_free_share',
  },
  {
    type: 'speed_settler',
    icon: 'flash-outline',
    gradientColors: ['#D97706', '#FBBF24'],
    titleKey: 'achievements.speed_settler_title',
    descKey: 'achievements.speed_settler_desc',
    shareTextKey: 'achievements.speed_settler_share',
  },
  {
    type: 'group_creator',
    icon: 'people-outline',
    gradientColors: ['#7C3AED', '#A78BFA'],
    titleKey: 'achievements.group_creator_title',
    descKey: 'achievements.group_creator_desc',
    shareTextKey: 'achievements.group_creator_share',
  },
  {
    type: 'social_butterfly',
    icon: 'globe-outline',
    gradientColors: ['#FF9500', '#FFBB54'],
    titleKey: 'achievements.social_butterfly_title',
    descKey: 'achievements.social_butterfly_desc',
    shareTextKey: 'achievements.social_butterfly_share',
  },
  {
    type: 'receipt_scanner',
    icon: 'scan-outline',
    gradientColors: ['#E53E3E', '#FC8181'],
    titleKey: 'achievements.receipt_scanner_title',
    descKey: 'achievements.receipt_scanner_desc',
    shareTextKey: 'achievements.receipt_scanner_share',
  },
];

export function getAchievementDef(type: AchievementType): AchievementDef | undefined {
  return ACHIEVEMENT_DEFS.find(def => def.type === type);
}
