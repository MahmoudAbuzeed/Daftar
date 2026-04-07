import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useAppTheme } from '../lib/theme-context';
import { Spacing, Radius } from '../theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = Radius.sm, style }: SkeletonProps) {
  const { colors, isDark } = useAppTheme();
  const shimmer = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F2F2F7',
          opacity: shimmer,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  const { colors, isDark } = useAppTheme();

  return (
    <View style={[styles.card, {
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.bgCard,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : colors.borderLight,
    }]}>
      <View style={styles.cardRow}>
        <Skeleton width={34} height={34} borderRadius={11} />
        <View style={styles.cardContent}>
          <Skeleton width="70%" height={14} />
          <Skeleton width="40%" height={10} style={{ marginTop: 6 }} />
        </View>
        <Skeleton width={60} height={16} borderRadius={Radius.sm} />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cardContent: {
    flex: 1,
  },
  list: {
    padding: Spacing.xl,
  },
});
