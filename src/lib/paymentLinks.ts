import { Linking, Platform } from 'react-native';
import { PaymentMethod } from '../types/database';

export type DeepLinkResult =
  | { type: 'url'; url: string }
  | { type: 'instant' }
  | { type: 'unsupported' };

/**
 * Generates a deep link URL for the given payment method.
 * Returns the URL to open, or a flag indicating instant/unsupported payment methods.
 */
export function getPaymentDeepLink(
  method: PaymentMethod,
  amount: number,
  currency: string,
  recipientPhone?: string | null,
  recipientName?: string
): DeepLinkResult {
  // Instant methods that don't require external app
  if (method === 'cash' || method === 'apple_pay') {
    return { type: 'instant' };
  }

  // Google Pay (Android only)
  if (method === 'google_pay') {
    if (Platform.OS === 'android') {
      // Google Pay send URL - works as app link on Android
      return {
        type: 'url',
        url: `https://pay.google.com/send?amount=${amount}&cu=${currency}`,
      };
    }
    return { type: 'unsupported' };
  }

  // InstaPay - try bank app schemes in order
  if (method === 'instapay') {
    const bankSchemes = [
      `qnbaahmobile://instapay?amount=${amount}`,
      `cibmobile://payment?amount=${amount}`,
      `bmobile://instapay?amount=${amount}`,
      `nbemobile://instapay?amount=${amount}`,
    ];
    // Return first scheme; caller will check canOpenURL to find available one
    return { type: 'url', url: bankSchemes[0] };
  }

  // Vodafone Cash
  if (method === 'vodafone_cash') {
    if (recipientPhone) {
      return {
        type: 'url',
        url: `vfcash://pay?amount=${amount}&phone=${recipientPhone}`,
      };
    }
    return { type: 'unsupported' };
  }

  // Venmo
  if (method === 'venmo') {
    return {
      type: 'url',
      url: `venmo://paycharge?txn=pay&amount=${amount}&note=Fifti`,
    };
  }

  // Wise
  if (method === 'wise') {
    return {
      type: 'url',
      url: `https://wise.com/send?amount=${amount}&currency=${currency}`,
    };
  }

  // Bank transfer, PayPal, Zelle, and others - no deep link available
  return { type: 'unsupported' };
}

/**
 * Checks if a deep link can be opened on the current platform.
 * For InstaPay, tries each bank scheme until one is available.
 */
export async function canAttemptDeepLink(
  method: PaymentMethod,
  platform: 'ios' | 'android'
): Promise<boolean> {
  // Instant methods don't need external app
  if (method === 'cash' || method === 'apple_pay') {
    return true;
  }

  // Google Pay only on Android
  if (method === 'google_pay') {
    return platform === 'android';
  }

  // InstaPay - check if any bank scheme is available
  if (method === 'instapay') {
    const schemes = ['qnbaahmobile://', 'cibmobile://', 'bmobile://', 'nbemobile://'];
    for (const scheme of schemes) {
      try {
        const available = await Linking.canOpenURL(scheme);
        if (available) return true;
      } catch {
        // Continue to next scheme
      }
    }
    return false;
  }

  // Vodafone Cash, Venmo - check availability
  if (method === 'vodafone_cash') {
    try {
      return await Linking.canOpenURL('vfcash://');
    } catch {
      return false;
    }
  }

  if (method === 'venmo') {
    try {
      return await Linking.canOpenURL('venmo://');
    } catch {
      return false;
    }
  }

  if (method === 'wise') {
    return true; // https:// link always works
  }

  return false;
}

/**
 * Generates a shareable payment instruction text for WhatsApp/SMS.
 */
export function generatePaymentShareText(params: {
  fromName: string;
  toName: string;
  recipientPhone?: string | null;
  amount: number;
  currency: string;
  method: PaymentMethod;
  lang: 'en' | 'ar';
}): string {
  const { fromName, toName, recipientPhone, amount, currency, method, lang } = params;

  if (lang === 'ar') {
    const methodNames: Record<PaymentMethod, string> = {
      instapay: 'إنستاباي',
      google_pay: 'Google Pay',
      apple_pay: 'Apple Pay',
      vodafone_cash: 'Vodafone Cash',
      venmo: 'Venmo',
      wise: 'Wise',
      bank: 'تحويل بنكي',
      cash: 'نقد',
      paypal: 'PayPal',
      zelle: 'Zelle',
      revolut: 'Revolut',
      stc_pay: 'STC Pay',
      mada: 'Mada',
      upi: 'UPI',
      other: 'دفع',
    };

    const methodName = methodNames[method] || method;
    const recipientInfo = recipientPhone ? `\nرقم الهاتف / المعرّف: ${recipientPhone}` : '';

    return (
      `Fifti: من فضلك حوّل ${amount.toFixed(2)} ${currency} لـ${toName} عبر ${methodName}.` +
      recipientInfo +
      `\nبعد التحويل، أكّد في التطبيق. 💸`
    );
  }

  // English
  const methodNames: Record<PaymentMethod, string> = {
    instapay: 'InstaPay',
    google_pay: 'Google Pay',
    apple_pay: 'Apple Pay',
    vodafone_cash: 'Vodafone Cash',
    venmo: 'Venmo',
    wise: 'Wise',
    bank: 'Bank Transfer',
    cash: 'Cash',
    paypal: 'PayPal',
    zelle: 'Zelle',
    revolut: 'Revolut',
    stc_pay: 'STC Pay',
    mada: 'Mada',
    upi: 'UPI',
    other: 'Payment',
  };

  const methodName = methodNames[method] || method;
  const recipientInfo = recipientPhone ? `\nPhone / IPN ID: ${recipientPhone}` : '';

  return (
    `Fifti: Please send ${amount.toFixed(2)} ${currency} to ${toName} via ${methodName}.` +
    recipientInfo +
    `\nConfirm in app after payment. 💸`
  );
}

/**
 * Checks if a payment method requires external payment app (vs instant cash settle).
 */
export function isInstantMethod(method: PaymentMethod): boolean {
  return method === 'cash' || method === 'apple_pay';
}

/**
 * Launches a deep link URL.
 * Thin wrapper around Linking.openURL for centralized error handling.
 */
export async function launchPaymentDeepLink(url: string): Promise<void> {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  } catch (error) {
    console.warn('Failed to open payment deep link:', error);
  }
}

/**
 * Returns the available InstaPay bank schemes in order of preference.
 * Useful for trying each one until canOpenURL succeeds.
 */
export function getInstapaySchemes(amount: number): string[] {
  return [
    `qnbaahmobile://instapay?amount=${amount}`,
    `cibmobile://payment?amount=${amount}`,
    `bmobile://instapay?amount=${amount}`,
    `nbemobile://instapay?amount=${amount}`,
  ];
}
