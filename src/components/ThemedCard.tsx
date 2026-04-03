import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../lib/theme-context';
import { Radius, Spacing } from '../theme';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: boolean; // Show brass accent stripe on top
  padded?: boolean;
}

export default function ThemedCard({ children, style, accent, padded = true }: Props) {
  const { colors, isDark } = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? undefined : colors.bgCard,
          borderColor: colors.border,
          shadowColor: colors.shadowColor,
          shadowOpacity: isDark ? 0 : 0.06,
          elevation: isDark ? 0 : 4,
        },
        padded && styles.padded,
        style,
      ]}
    >
      {isDark && (
        <LinearGradient
          colors={colors.cardGradient}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}
      {accent && (
        <View
          style={[
            styles.accentStripe,
            { backgroundColor: colors.accent, opacity: isDark ? 0.5 : 0.35 },
          ]}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  padded: {
    padding: Spacing.xl,
  },
  accentStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
});
