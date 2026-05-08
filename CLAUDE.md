# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Identity note

The repo directory is `daftar` (the original product name) but the **shipped product is "Fifti — Split Fair"**. The Expo `slug`, bundle id (`com.fifti.app`), AsyncStorage namespace (`@fifti/*`, `fifti_*`), and i18n keys all use `fifti`. Treat `daftar` only as a legacy term — and as the SQL table name `daftar_entries`, which is the personal-ledger feature (see migration `009_rename_daftar_to_ledger.sql` for the user-facing rename to "Ledger" while the table name was kept).

## Commands

```bash
npm run start        # expo start (Metro bundler)
npm run ios          # expo run:ios   (native build, requires dev client)
npm run android      # expo run:android
npm run web          # expo start --web
```

There is **no test runner, linter, or formatter configured** — TypeScript (`tsc`) is the only static check, via `tsconfig.json` extending `expo/tsconfig.base` with `strict: true`. Don't fabricate `npm test` / `npm run lint` instructions.

Native builds go through EAS (`eas.json` defines `development`, `preview`, `production` profiles). The app uses `expo-dev-client` and `newArchEnabled: true`, so Expo Go is **not** sufficient — use a dev client build.

Required env vars (see `.env.example`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_OPENAI_API_KEY`, plus RevenueCat iOS/Android keys (currently unused — see Purchases below).

## Architecture

### Provider tree and entry

`index.ts` → `App.tsx`. Provider order is load-bearing — auth depends on theme being ready, subscription depends on auth:

```
SafeAreaProvider > ThemeProvider > PaperProvider > AuthProvider > SubscriptionProvider > AlertProvider > AppInner
```

`AppInner` waits for `useAppTheme().ready`, plays an animated splash, then renders `<AppNavigator />`. Fonts load at the outer `App` level — the inner tree doesn't render until `useFonts` resolves.

### Navigation (`src/navigation/AppNavigator.tsx`)

Single file containing the entire navigation graph. Three gates in order:

1. **Onboarding** — `AsyncStorage.@fifti/onboarded`. If unset, render `OnboardingScreen` and short-circuit before the NavigationContainer.
2. **Auth** — `useAuth().session && !needsProfile` decides between `AuthNavigator` (PhoneEntry → OTPVerify → ProfileSetup) and `AppStack`. `needsProfile` is true when a Supabase auth user exists but no row in the `users` table — in that case the auth stack jumps straight to ProfileSetup.
3. **App** — `RootStack` wraps `MainTabs` (Groups / People / Notifications / Profile) plus all modals and detail screens. `RootStackParamList` is the single source of truth for route params.

When adding a screen, register it in `RootStackParamList` *and* import it in this file — there is no auto-routing.

### State / contexts (`src/lib/`)

- `auth-context.tsx` — Supabase Auth (phone OTP primary; email exists but is unused in the navigator). On every auth event it fetches the `users` row; missing row → `needsProfile=true`. Uses RPC `ensure_user_profile` to create the profile transactionally.
- `subscription-context.tsx` — Free vs. Pro tier. `canPerform(feature)` and `incrementUsage(feature)` enforce free-tier caps via Supabase RPCs `get_usage` / `increment_usage`. `FREE_LIMITS` / `PRO_LIMITS` (`TierLimits`) are the single source of gating. Cached locally at `@fifti/subscription`. The context also calls into `purchases.ts` to sync RevenueCat — currently a no-op (see below).
- `theme-context.tsx` — light/dark, persisted at `@fifti/theme`. `ready` flag must be true before rendering content.
- `i18n.ts` — i18next, EN/AR only, persisted at `fifti_language`. **RTL is forced via `I18nManager.forceRTL` in `App.tsx`** when language is `ar`; on iOS this requires an app reload to take effect.

### Data layer (Supabase)

- Client: `src/lib/supabase.ts` — anon key + AsyncStorage session persistence.
- Schema lives entirely in `supabase/migrations/*.sql`, applied **in numeric order**. Add a new file (`018_*.sql` etc.) — never edit a past migration. Core tables: `users`, `groups`, `group_members`, `expenses`, `expense_splits`, `expense_items`, `item_assignments`, `settlements`, `daftar_entries` (= ledger), `shared_bills`+`shared_bill_items`+`shared_bill_claims`, `recurring_expenses`, `quick_splits`, `notifications`, `user_achievements`, `group_messages`, `subscriptions`, `usage_tracking`, `push_tokens`.
- TypeScript shapes for all tables: `src/types/database.ts` — keep this in sync when migrations change columns.
- RPCs the app depends on: `ensure_user_profile`, `get_usage`, `increment_usage`. RLS recursion was an issue early on (see migration `002`); be careful when adding policies.
- Edge functions (Deno) in `supabase/functions/`:
  - `scan-receipt` — Google Cloud Vision OCR → GPT-4o-mini structuring → `ParsedReceipt`. Falls back to GPT-4o-mini vision if `GOOGLE_VISION_API_KEY` is unset.
  - `send-push-notification` — Expo push API fan-out.

### Domain logic

- **Debt simplification** lives in `src/utils/balance.ts` (`simplifyDebts`) — a greedy debtor↔creditor match that minimizes the number of transfers. Anything that displays "who owes who" should run balances through this, not just sum splits.
- **Currency formatting** is also in `balance.ts` (`formatCurrency`, `formatCurrencyAr`). The app supports many currencies (`CurrencyCode` in `types/database.ts`) but parts of the SQL schema still constrain a column to `('EGP', 'USD')` — when widening currency support, check the migration CHECK constraints, not just the type.
- **Offline queue** — `src/utils/offline-queue.ts` persists failed Supabase writes to AsyncStorage (`fifti_offline_queue`) with retry/backoff. Use this for any user-visible mutation that should survive flaky networks.
- **Engagement / notifications** — `src/lib/engagement.ts` schedules weekly summaries and daily settle nudges (24-hour cooldown via `last_notified_*` keys). Push token registration is in `src/lib/notifications.ts`.

### Purchases — currently disabled

`src/lib/purchases.ts` is a **stub** (every export is a no-op; commit `16140a5 disable payment`). The full RevenueCat integration is gone from this file but `react-native-purchases` is still a dependency and `subscription-context.tsx` still calls `identifyUser` / `checkProStatus`. Do not assume payments work end-to-end. If asked to re-enable, restore the real implementations rather than wiring around the stubs.

### Conventions

- All client-readable secrets are prefixed `EXPO_PUBLIC_`.
- AsyncStorage keys: `@fifti/<feature>` for app state, `fifti_<feature>` for older keys (both patterns exist; prefer `@fifti/`).
- Screen files live under `src/screens/<feature>/` — each feature is one folder; navigation is wired centrally in `AppNavigator.tsx`, not co-located.
- Theme tokens come from `useAppTheme()` (runtime, light/dark-aware). The static `Colors` / `Gradients` exports in `src/theme/index.ts` are used only for `paperTheme` and a few splash/loader fallbacks — prefer the hook in normal screens.
- Bilingual: every user-visible string goes through `t(...)` and must exist in **both** `src/locales/en.json` and `src/locales/ar.json`. RTL-aware layout helpers are in `src/utils/rtl.ts`.
