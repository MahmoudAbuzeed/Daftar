// Loaded in App.tsx via useFonts — keys must match font map

export const FontFamily = {
  // ── UI / body ──────────────────────────────────────────────
  // Poppins is the workhorse. Used for body, labels, buttons, captions.
  display: 'Poppins_700Bold',
  displaySemibold: 'Poppins_600SemiBold',
  body: 'Poppins_400Regular',
  bodyMedium: 'Poppins_500Medium',
  bodySemibold: 'Poppins_600SemiBold',
  bodyBold: 'Poppins_700Bold',

  // ── Editorial display ─────────────────────────────────────
  // Cormorant is the editorial voice for hero amounts, screen
  // titles, and section dividers. Used sparingly for impact.
  // Latin/EN only — Cormorant has no Arabic glyphs.
  serif: 'Cormorant_500Medium',
  serifSemibold: 'Cormorant_600SemiBold',
  serifBold: 'Cormorant_700Bold',

  // ── Arabic display ────────────────────────────────────────
  // Tajawal is the Arabic counterpart to Cormorant — slightly
  // condensed, geometric, works at large sizes.
  serifAr: 'Tajawal_500Medium',
  serifArBold: 'Tajawal_700Bold',
  serifArExtra: 'Tajawal_800ExtraBold',
} as const;

/**
 * Returns the right display font family for the current language.
 * Cormorant for Latin scripts, Tajawal for Arabic.
 */
export function displayFor(lang: string | undefined, weight: 'medium' | 'semibold' | 'bold' = 'bold') {
  const isAr = lang === 'ar';
  if (isAr) {
    if (weight === 'bold') return FontFamily.serifArBold;
    return FontFamily.serifAr;
  }
  if (weight === 'medium') return FontFamily.serif;
  if (weight === 'semibold') return FontFamily.serifSemibold;
  return FontFamily.serifBold;
}
