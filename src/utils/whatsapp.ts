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
    let msg = `📊 ملخص حسابات "${groupName}" من دفتر\n\n`;
    for (const b of balances) {
      msg += `• ${b.from} مديون لـ ${b.to}: ${b.amount.toFixed(2)} ${b.currency === 'EGP' ? 'ج.م' : 'دولار'}\n`;
    }
    msg += `\nحمّل تطبيق دفتر عشان تقسّم الحساب بسهولة! 📱`;
    return msg;
  }

  let msg = `📊 Balance summary for "${groupName}" from Daftar\n\n`;
  for (const b of balances) {
    msg += `• ${b.from} owes ${b.to}: ${b.amount.toFixed(2)} ${b.currency}\n`;
  }
  msg += `\nDownload Daftar to split bills easily! 📱`;
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
    return `👋 تذكير من دفتر: ${toName}، أنت مديون لـ ${fromName} بمبلغ ${amount.toFixed(2)} ${currency === 'EGP' ? 'ج.م' : 'دولار'}. ممكن تسوّي الحساب؟ 🙏`;
  }
  return `👋 Daftar reminder: Hey ${toName}, you owe ${fromName} ${amount.toFixed(2)} ${currency}. Can you settle up? 🙏`;
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
    return `🎉 انضم لمجموعة "${groupName}" على دفتر!\n\nكود الدعوة: ${inviteCode}\n\nحمّل التطبيق وادخل الكود عشان تنضم. 📱`;
  }
  return `🎉 Join "${groupName}" on Daftar!\n\nInvite code: ${inviteCode}\n\nDownload the app and enter the code to join. 📱`;
}
