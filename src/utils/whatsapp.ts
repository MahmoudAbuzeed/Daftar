import { Linking } from 'react-native';

/**
 * Validate phone number format
 * Accepts E.164 format, local format, and various separators
 */
export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  if (!phone || typeof phone !== 'string') return false;

  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // Must start with + or digit
  if (!cleaned.match(/^\+?\d/)) return false;

  // Must have at least 7 digits (minimum for valid phone)
  const digitsOnly = cleaned.replace(/\D/g, '');
  return digitsOnly.length >= 7 && digitsOnly.length <= 15;
}

/**
 * Format phone number for WhatsApp API
 * Converts to E.164 format (without +) or country-prefixed format
 */
export function formatPhoneForWhatsApp(phone: string): string {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // If it already starts with +, remove it (WhatsApp API doesn't need it)
  if (cleaned.startsWith('+')) {
    return cleaned.substring(1);
  }

  // If no country code (doesn't start with 2), assume Egyptian (+20)
  if (cleaned.length <= 10 && !cleaned.startsWith('2')) {
    // Remove leading 0 if present
    const withoutLeadingZero = cleaned.replace(/^0/, '');
    return `20${withoutLeadingZero}`;
  }

  return cleaned;
}

/**
 * Share a message via WhatsApp
 */
export async function shareViaWhatsApp(message: string, phone?: string): Promise<void> {
  const encoded = encodeURIComponent(message);

  // If phone is provided, validate it
  if (phone) {
    if (!isValidPhoneNumber(phone)) {
      throw new Error('Invalid phone number format');
    }
    const formattedPhone = formatPhoneForWhatsApp(phone);
    const url = `whatsapp://send?phone=${formattedPhone}&text=${encoded}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return;
    }
  }

  // Fallback to web WhatsApp (or web version if app not available)
  const webUrl = `https://wa.me/${phone ? formatPhoneForWhatsApp(phone) : ''}?text=${encoded}`;
  await Linking.openURL(webUrl);
}

/**
 * Generate a balance summary message for sharing
 */
export function generateBalanceSummary(
  groupName: string,
  balances: { from: string; to: string; amount: number; currency: string }[],
  lang: 'en' | 'ar' = 'en'
): string {
  if (lang === 'ar') {
    let msg = `📊 ملخص حسابات "${groupName}" من Fifti\n\n`;
    for (const b of balances) {
      msg += `• ${b.from} مديون لـ ${b.to}: ${b.amount.toFixed(2)} ${b.currency}\n`;
    }
    msg += `\nحمّل تطبيق Fifti عشان تقسّم الحساب بسهولة! 📱`;
    return msg;
  }

  let msg = `📊 Balance summary for "${groupName}" from Fifti\n\n`;
  for (const b of balances) {
    msg += `• ${b.from} owes ${b.to}: ${b.amount.toFixed(2)} ${b.currency}\n`;
  }
  msg += `\nDownload Fifti to split bills easily! 📱`;
  return msg;
}

/**
 * Generate a payment reminder message
 */
export function generateReminder(
  fromName: string,
  toName: string,
  amount: number,
  currency: string,
  lang: 'en' | 'ar' = 'en'
): string {
  if (lang === 'ar') {
    return `👋 تذكير من Fifti: ${toName}، أنت مديون لـ ${fromName} بمبلغ ${amount.toFixed(2)} ${currency}. ممكن تسوّي الحساب؟ 🙏`;
  }
  return `👋 Fifti reminder: Hey ${toName}, you owe ${fromName} ${amount.toFixed(2)} ${currency}. Can you settle up? 🙏`;
}

/**
 * Share group invite via WhatsApp
 */
export function generateInviteMessage(
  groupName: string,
  inviteCode: string,
  lang: 'en' | 'ar' = 'en'
): string {
  if (lang === 'ar') {
    return `🎉 انضم لمجموعة "${groupName}" على Fifti!\n\nكود الدعوة: ${inviteCode}\n\nحمّل التطبيق وادخل الكود عشان تنضم. 📱`;
  }
  return `🎉 Join "${groupName}" on Fifti!\n\nInvite code: ${inviteCode}\n\nDownload the app and enter the code to join. 📱`;
}

/**
 * Generate a payment notification after bill assignment
 */
/**
 * Generate a notification listing all debtors and their amounts
 */
export function generateMultiDebtorNotification(
  payerName: string,
  payerPhone: string | null,
  debtors: { name: string; amount: number }[],
  currency: string,
  description: string,
  lang: 'en' | 'ar' = 'en'
): string {
  const phoneInfo = payerPhone ? `\n📱 ${payerPhone}` : '';

  if (lang === 'ar') {
    let msg = `🧾 Fifti: تقسيم حساب "${description}"${phoneInfo}\n\n`;
    for (const d of debtors) {
      msg += `• ${d.name}: ${d.amount.toFixed(2)} ${currency}\n`;
    }
    msg += `\nسددوا الحساب عن طريق التطبيق. 💸`;
    return msg;
  }

  let msg = `🧾 Fifti: Bill split for "${description}"${phoneInfo}\n\n`;
  for (const d of debtors) {
    msg += `• ${d.name} owes ${d.amount.toFixed(2)} ${currency}\n`;
  }
  msg += `\nSettle up through the app! 💸`;
  return msg;
}

export function generatePaymentNotification(
  payerName: string,
  payerPhone: string | null,
  amount: number,
  currency: string,
  description: string,
  lang: 'en' | 'ar' = 'en'
): string {
  const formattedAmount = `${amount.toFixed(2)} ${currency}`;
  const phoneInfo = payerPhone ? `\n📱 ${payerPhone}` : '';

  if (lang === 'ar') {
    return `🧾 Fifti: عليك ${formattedAmount} لـ ${payerName} عن "${description}".${phoneInfo}\n\nسدد الحساب عن طريق التطبيق. 💸`;
  }
  return `🧾 Fifti: You owe ${formattedAmount} to ${payerName} for "${description}".${phoneInfo}\n\nSettle up through the app. 💸`;
}
