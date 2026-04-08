import React, { useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../lib/theme-context';
import { Radius } from '../theme';
import BouncyPressable from './BouncyPressable';

export type SendButtonStyle = 'pill' | 'animated-gradient' | 'minimalist' | 'glassmorphism';

interface SendButtonProps {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: SendButtonStyle;
  colors: ThemeColors;
  isDark: boolean;
}

// Modern Pill Button - with text
export const ModernPillButton: React.FC<SendButtonProps> = ({
  onPress,
  disabled,
  loading,
  colors,
  isDark,
}) => {
  return (
    <BouncyPressable onPress={onPress} disabled={disabled || loading}>
      <LinearGradient
        colors={
          disabled || loading
            ? [colors.textTertiary, colors.textTertiary]
            : colors.primaryGradient
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pillButton}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </>
        )}
      </LinearGradient>
    </BouncyPressable>
  );
};

// Animated Gradient Button
export const AnimatedGradientButton: React.FC<SendButtonProps> = ({
  onPress,
  disabled,
  loading,
  colors,
  isDark,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={
            disabled || loading
              ? [colors.textTertiary, colors.textTertiary]
              : [...colors.primaryGradient].reverse()
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.circleButton, { shadowColor: colors.primary, shadowOpacity: disabled ? 0 : 0.4 }]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={20} color="#FFFFFF" />
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Minimalist Icon Button
export const MinimalistButton: React.FC<SendButtonProps> = ({
  onPress,
  disabled,
  loading,
  colors,
  isDark,
}) => {
  return (
    <BouncyPressable onPress={onPress} disabled={disabled || loading}>
      <View
        style={[
          styles.minimalistButton,
          {
            backgroundColor: disabled || loading ? colors.bgCard : colors.primary,
            borderColor: disabled || loading ? colors.border : colors.primary,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={disabled ? colors.textTertiary : '#FFFFFF'} />
        ) : (
          <Ionicons
            name="send"
            size={18}
            color={disabled ? colors.textTertiary : '#FFFFFF'}
          />
        )}
      </View>
    </BouncyPressable>
  );
};

// Glassmorphism Button
export const GlassmorphismButton: React.FC<SendButtonProps> = ({
  onPress,
  disabled,
  loading,
  colors,
  isDark,
}) => {
  return (
    <BouncyPressable onPress={onPress} disabled={disabled || loading}>
      <LinearGradient
        colors={
          disabled || loading
            ? [
                isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.3)',
                isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.3)',
              ]
            : ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.glassmorphismButton,
          {
            borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.4)',
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="send" size={18} color={colors.primary} />
        )}
      </LinearGradient>
    </BouncyPressable>
  );
};

const styles = StyleSheet.create({
  pillButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 5,
  },
  minimalistButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  glassmorphismButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
  },
});
