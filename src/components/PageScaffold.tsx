import React from 'react';
import { View, StyleSheet, StatusBar, Dimensions, StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../lib/theme-context';

interface Props {
  children: React.ReactNode;
  /** Show the soft decorative background orbs (used by Groups, Ledger, etc.) */
  decor?: boolean;
  /** Skip the SafeArea wrapper (use when you need a full-bleed hero) */
  noSafeArea?: boolean;
  /** Override SafeArea edges */
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
  contentStyle?: StyleProp<ViewStyle>;
}

const { width: SW } = Dimensions.get('window');

/**
 * Page scaffold — wraps every screen with:
 *   - background color from theme
 *   - dark-mode gradient overlay (only in dark mode)
 *   - optional decorative bg orbs (warm brand atmosphere)
 *   - StatusBar synced with theme
 *   - SafeAreaView (optional)
 *
 * Replaces the ~80 lines of boilerplate every screen used to repeat:
 *   <View style={styles.root}>
 *     <StatusBar barStyle={...} />
 *     {isDark && <LinearGradient ... />}
 *     <View style={styles.bgOrb} />
 *     <View style={styles.bgOrbSmall} />
 *     <SafeAreaView>...</SafeAreaView>
 *   </View>
 */
export default function PageScaffold({
  children,
  decor,
  noSafeArea,
  edges,
  contentStyle,
}: Props) {
  const { colors, isDark } = useAppTheme();

  const inner = noSafeArea ? (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  ) : (
    <SafeAreaView style={[styles.flex, contentStyle]} edges={edges}>
      {children}
    </SafeAreaView>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={colors.statusBarStyle}
        backgroundColor="transparent"
        translucent
      />
      {isDark ? (
        <LinearGradient
          colors={colors.headerGradient}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.3, y: 1 }}
        />
      ) : null}
      {decor ? (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.orb,
              styles.orbLarge,
              { backgroundColor: isDark ? 'rgba(29,185,84,0.07)' : 'rgba(29,185,84,0.05)' },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.orb,
              styles.orbSmall,
              { backgroundColor: isDark ? 'rgba(255,149,0,0.05)' : 'rgba(255,149,0,0.04)' },
            ]}
          />
        </>
      ) : null}
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  orb: {
    position: 'absolute',
    borderRadius: SW,
  },
  orbLarge: {
    width: SW * 0.75,
    height: SW * 0.75,
    top: -SW * 0.18,
    left: -SW * 0.22,
  },
  orbSmall: {
    width: SW * 0.4,
    height: SW * 0.4,
    bottom: SW * 0.08,
    right: -SW * 0.12,
  },
});
