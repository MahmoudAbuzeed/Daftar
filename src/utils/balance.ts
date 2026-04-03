import { Balance } from '../types/database';

/**
 * Simplify debts to minimize the number of transactions.
 * Uses a greedy algorithm: the person who owes the most pays the person who is owed the most.
 */
export function simplifyDebts(balances: Balance[]): Balance[] {
  // Build net balance per user
  const netBalance = new Map<string, number>();

  for (const b of balances) {
    netBalance.set(b.from_user, (netBalance.get(b.from_user) || 0) - b.net_amount);
    netBalance.set(b.to_user, (netBalance.get(b.to_user) || 0) + b.net_amount);
  }

  // Separate into debtors (negative balance) and creditors (positive balance)
  const debtors: { user: string; amount: number }[] = [];
  const creditors: { user: string; amount: number }[] = [];

  for (const [user, amount] of netBalance.entries()) {
    if (amount < -0.01) {
      debtors.push({ user, amount: Math.abs(amount) });
    } else if (amount > 0.01) {
      creditors.push({ user, amount });
    }
  }

  // Sort descending by amount
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  // Greedy matching
  const simplified: Balance[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const payment = Math.min(debtors[i].amount, creditors[j].amount);

    if (payment > 0.01) {
      simplified.push({
        from_user: debtors[i].user,
        to_user: creditors[j].user,
        net_amount: Math.round(payment * 100) / 100,
      });
    }

    debtors[i].amount -= payment;
    creditors[j].amount -= payment;

    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  return simplified;
}

/**
 * Format currency amount with symbol
 */
export function formatCurrency(amount: number, currency: 'EGP' | 'USD' = 'EGP'): string {
  if (currency === 'USD') {
    return `$${amount.toFixed(2)}`;
  }
  return `${amount.toFixed(2)} EGP`;
}

/**
 * Format currency for Arabic
 */
export function formatCurrencyAr(amount: number, currency: 'EGP' | 'USD' = 'EGP'): string {
  if (currency === 'USD') {
    return `${amount.toFixed(2)} دولار`;
  }
  return `${amount.toFixed(2)} ج.م`;
}
