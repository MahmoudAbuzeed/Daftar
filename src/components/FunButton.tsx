import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../lib/theme-context';
import { FontFamily } from '../theme';
import { Radius } from '../theme';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: React.ReactNode;
  style?: ViewStyle;
  size?: 'normal' | 'small';
}

export default function FunButton({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  icon,
  style,
  size = 'normal',
}: Props) {
  const { colors, isDark } = useAppTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.94,
      useNativeDriver: true,
      damping: 15,
      stiffness: 300,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 8,
      stiffness: 250,
    }).start();
  };

  const handlePress = () => {
    if (loading || disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const isSmall = size === 'small';
  const py = isSmall ? 12 : 17;

  const gradientMap: Record<string, [string, string, ...string[]]> = {
    primary: colors.primaryGradient,
    secondary: isDark ? ['rgba(255,252,247,0.06)', 'rgba(255,252,247,0.03)'] : [colors.primarySurface, colors.primarySurface],
    danger: colors.dangerGradient,
    ghost: ['transparent', 'transparent'],
  };

  const textColorMap: Record<string, string> = {
    primary: colors.textOnPrimary,
    secondary: isDark ? colors.primaryLight : colors.primary,
    danger: colors.textOnPrimary,
    ghost: colors.primary,
  };

  const shadowColor = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : 'transparent';

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        disabled={loading || disabled}
      >
        <LinearGradient
          colors={gradientMap[variant]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.5 }}
          style={[
            styles.btn,
            {
              paddingVertical: py,
              opacity: disabled ? 0.5 : 1,
              shadowColor,
              shadowOpacity: variant === 'primary' || variant === 'danger' ? 0.35 : 0,
              borderWidth: variant === 'secondary' ? 1.5 : variant === 'ghost' ? 0 : 0,
              borderColor: variant === 'secondary'
                ? isDark ? colors.borderLight : colors.border
                : 'transparent',
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={textColorMap[variant]} size="small" />
          ) : (
            <>
              {icon}
              <Text
                style={[
                  styles.text,
                  {
                    color: textColorMap[variant],
                    fontSize: isSmall ? 14 : 16,
                    marginLeft: icon ? 8 : 0,
                  },
                ]}
              >
                {title}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 8,
  },
  text: {
    fontFamily: FontFamily.bodyBold,
    letterSpacing: 0.3,
  },
});
