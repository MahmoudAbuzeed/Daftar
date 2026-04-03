import { I18nManager } from 'react-native';

/** Returns the correct directional icon name for RTL/LTR */
export function directionalIcon(ltr: string, rtl: string): string {
  return I18nManager.isRTL ? rtl : ltr;
}

/** Chevron that points "forward" (right in LTR, left in RTL) */
export function chevronForward(): string {
  return directionalIcon('chevron-forward', 'chevron-back');
}

/** Arrow that points "forward" */
export function arrowForward(): string {
  return directionalIcon('arrow-forward', 'arrow-back');
}
