import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../lib/theme-context';
import { FontFamily, Radius, Spacing } from '../theme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface Props<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Use the brand gradient on the active pill instead of solid primary */
  gradient?: boolean;
  /** Compact spacing for tight layouts */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Single segmented-control primitive that replaces the 4 ad-hoc toggle
 * implementations across the app (PhoneEntry, AddLedgerEntry, Analytics period
 * selector, Activity tab selector). Animated active pill, optional gradient,
 * haptic feedback, RTL-aware (segments lay out via flex so they flip naturally).
 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  gradient,
  compact,
  style,
}: Props<T>) {
  const { colors, isDark } = useAppTheme();
  const [trackWidth, setTrackWidth] = React.useState(0);
  const segmentWidth = trackWidth > 0 && options.length > 0 ? trackWidth / options.length : 0;
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const pillX = useRef(new Animated.Value(activeIndex * segmentWidth)).current;

  useEffect(() => {
    if (segmentWidth > 0) {
      Animated.spring(pillX, {
        toValue: activeIndex * segmentWidth,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
        mass: 0.5,
      }).start();
    }
  }, [activeIndex, segmentWidth, pillX]);

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.track,
        compact && styles.trackCompact,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.borderLight,
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'transparent',
        },
        style,
      ]}
    >
      {/* Sliding active pill */}
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            compact && styles.pillCompact,
            {
              width: segmentWidth - 4,
              transform: [{ translateX: Animated.add(pillX, new Animated.Value(2)) }],
            },
          ]}
        >
          {gradient ? (
            <LinearGradient
              colors={colors.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject as any}
            />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.primary }]} />
          )}
        </Animated.View>
      ) : null}

      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              if (opt.value !== value) {
                Haptics.selectionAsync();
                onChange(opt.value);
              }
            }}
            style={[styles.segment, compact && styles.segmentCompact]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            {opt.icon ? <View style={styles.icon}>{opt.icon}</View> : null}
            <Text
              style={[
                styles.label,
                compact && styles.labelCompact,
                {
                  color: isActive ? colors.textOnPrimary : colors.textSecondary,
                },
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: Radius.pill,
    padding: 3,
    borderWidth: 1,
  },
  trackCompact: {
    padding: 2,
  },
  pill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 0,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  pillCompact: {
    top: 2,
    bottom: 2,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: Spacing.md,
    gap: 6,
    zIndex: 1,
  },
  segmentCompact: {
    paddingVertical: 8,
  },
  icon: {
    marginEnd: 2,
  },
  label: {
    fontFamily: FontFamily.bodySemibold,
    fontSize: 13,
    letterSpacing: 0.1,
  },
  labelCompact: {
    fontSize: 12,
  },
});
