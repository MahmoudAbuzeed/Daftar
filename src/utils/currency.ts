import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RATE_CACHE_KEY = '@daftar/exchange_rates';
const RATE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedRates {
  egpToUsd: number;
  usdToEgp: number;
  updatedAt: number;
}

let memoryCache: CachedRates | null = null;

export async function getExchangeRates(): Promise<CachedRates> {
  if (memoryCache && Date.now() - memoryCache.updatedAt < RATE_TTL) {
    return memoryCache;
  }

  try {
    const stored = await AsyncStorage.getItem(RATE_CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as CachedRates;
      if (Date.now() - parsed.updatedAt < RATE_TTL) {
        memoryCache = parsed;
        return parsed;
      }
    }
  } catch {}

  try {
    const { data } = await supabase
      .from('exchange_rates')
      .select('from_currency, to_currency, rate');

    const rates: CachedRates = { egpToUsd: 0.02, usdToEgp: 50.0, updatedAt: Date.now() };

    for (const row of data || []) {
      if (row.from_currency === 'EGP' && row.to_currency === 'USD') rates.egpToUsd = row.rate;
      if (row.from_currency === 'USD' && row.to_currency === 'EGP') rates.usdToEgp = row.rate;
    }

    memoryCache = rates;
    await AsyncStorage.setItem(RATE_CACHE_KEY, JSON.stringify(rates));
    return rates;
  } catch {
    return memoryCache || { egpToUsd: 0.02, usdToEgp: 50.0, updatedAt: Date.now() };
  }
}

export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: CachedRates,
): number {
  if (from === to) return amount;
  if (from === 'EGP' && to === 'USD') return Math.round(amount * rates.egpToUsd * 100) / 100;
  if (from === 'USD' && to === 'EGP') return Math.round(amount * rates.usdToEgp * 100) / 100;
  // For other pairs, fallback via USD
  const inUsd = from === 'USD' ? amount : Math.round(amount * rates.egpToUsd * 100) / 100;
  return to === 'USD' ? inUsd : Math.round(inUsd * rates.usdToEgp * 100) / 100;
}

export function formatConverted(
  amount: number,
  from: string,
  to: string,
  rates: CachedRates,
): string {
  const { formatCurrency } = require('./balance');
  const converted = convertCurrency(amount, from, to, rates);
  return formatCurrency(converted, to);
}
