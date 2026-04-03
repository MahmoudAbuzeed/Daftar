import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Animated,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../lib/theme-context';
import { FontFamily, Radius, Spacing } from '../theme';

interface Props extends TextInputProps {
  label?: string;
  icon?: string;
  containerStyle?: ViewStyle;
  error?: string;
}

export default function ThemedInput({ label, icon, containerStyle, error, ...rest }: Props) {
  const { colors, isDark } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setFocused(true);
    Animated.spring(borderAnim, {
      toValue: 1,
      useNativeDriver: false,
      damping: 15,
      stiffness: 200,
    }).start();
  };

  const handleBlur = () => {
    setFocused(false);
    Animated.spring(borderAnim, {
      toValue: 0,
      useNativeDriver: false,
      damping: 15,
      stiffness: 200,
    }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  const bg = isDark ? 'rgba(255,252,247,0.05)' : '#F8F7F5';

  return (
    <View style={containerStyle}>
      {label && (
        <Text
          style={[
            styles.label,
            { color: isDark ? colors.kicker : colors.textSecondary },
          ]}
        >
          {label}
        </Text>
      )}
      <Animated.View
        style={[
          styles.inputWrap,
          {
            backgroundColor: bg,
            borderColor: error ? colors.danger : borderColor,
          },
        ]}
      >
        {icon && (
          <Ionicons
            name={icon as any}
            size={18}
            color={focused ? colors.primary : colors.textTertiary}
            style={styles.icon}
          />
        )}
        <TextInput
          {...rest}
          style={[
            styles.input,
            { color: colors.text },
            rest.style,
          ]}
          placeholderTextColor={colors.textTertiary}
          onFocus={(e) => {
            handleFocus();
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            handleBlur();
            rest.onBlur?.(e);
          }}
        />
      </Animated.View>
      {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: FontFamily.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: FontFamily.body,
  },
  error: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    marginTop: 4,
  },
});
