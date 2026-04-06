import { Linking } from 'react-native';

/**
 * Share a message via WhatsApp
 */
export async function shareViaWhatsApp(message: string, phone?: string): Promise<void> {
  const encoded = encodeURIComponent(message);
  const url = phone
    ? `whatsapp://send?phone=${phone}&text=${encoded}`
    : `whatsapp://send?text=${encoded}`;

  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
  } else {
    // Fallback to web WhatsApp
    const webUrl = `https://wa.me/?text=${encoded}`;
    await Linking.openURL(webUrl);
  }
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
