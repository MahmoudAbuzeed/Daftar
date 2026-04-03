import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../lib/theme-context';
import { FontFamily } from '../theme';

interface Props {
  title?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  transparent?: boolean;
}

export default function ScreenHeader({ title, onBack, rightAction, transparent }: Props) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  // Entrance animation
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideX = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(slideX, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }),
    ]).start();
  }, []);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack?.();
  };

  const bg = transparent ? 'transparent' : colors.bg;
  const borderColor = transparent ? 'transparent' : isDark ? colors.borderLight : colors.border;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 4,
          backgroundColor: bg,
          borderBottomColor: borderColor,
          borderBottomWidth: transparent ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={styles.row}>
        {/* Back button */}
        {onBack ? (
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.6}
            style={[
              styles.backBtn,
              {
                backgroundColor: isDark
                  ? 'rgba(255,252,247,0.06)'
                  : 'rgba(0,0,0,0.04)',
                borderColor: isDark
                  ? 'rgba(201,162,39,0.15)'
                  : 'rgba(0,0,0,0.06)',
              },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={isDark ? colors.accentLight : colors.text}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.backPlaceholder} />
        )}

        {/* Title */}
        <Animated.Text
          style={[
            styles.title,
            {
              color: colors.text,
              opacity: fadeIn,
              transform: [{ translateX: slideX }],
            },
          ]}
          numberOfLines={1}
        >
          {title || ''}
        </Animated.Text>

        {/* Right action */}
        {rightAction ? (
          <View style={styles.rightSlot}>{rightAction}</View>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backPlaceholder: {
    width: 36,
  },
  title: {
    flex: 1,
    fontFamily: FontFamily.bodySemibold,
    fontSize: 17,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  rightSlot: {
    width: 36,
    alignItems: 'flex-end',
  },
});
