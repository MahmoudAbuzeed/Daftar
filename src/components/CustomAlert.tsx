import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../lib/theme-context';
import { FontFamily, Radius, Spacing } from '../theme';
import FunButton from './FunButton';

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertConfig {
  visible: boolean;
  type: AlertType;
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

interface Props extends AlertConfig {
  onDismiss: () => void;
}

const ICON_MAP: Record<AlertType, { name: string; gradient: string[] }> = {
  success: { name: 'checkmark-circle', gradient: ['#059669', '#34D399'] },
  error: { name: 'alert-circle', gradient: ['#DC2626', '#EF4444'] },
  warning: { name: 'warning', gradient: ['#D97706', '#FBBF24'] },
  info: { name: 'information-circle', gradient: ['#0D9488', '#14B8A6'] },
  confirm: { name: 'help-circle', gradient: ['#0D9488', '#14B8A6'] },
};

const { width: SW } = Dimensions.get('window');

export default function CustomAlert({
  visible,
  type,
  title,
  message,
  buttons,
  onDismiss,
}: Props) {
  const { colors, isDark } = useAppTheme();

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const iconBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(
        type === 'error'
          ? Haptics.NotificationFeedbackType.Error
          : type === 'success'
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
      );
      scaleAnim.setValue(0.6);
      opacityAnim.setValue(0);
      iconBounce.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 12,
          stiffness: 200,
          mass: 0.8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        Animated.spring(iconBounce, {
          toValue: 1,
          useNativeDriver: true,
          damping: 6,
          stiffness: 180,
        }).start();
      });
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  };

  const handleButtonPress = (btn: AlertButton) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleDismiss();
    setTimeout(() => btn.onPress?.(), 200);
  };

  const resolvedButtons = buttons?.length
    ? buttons
    : [{ text: 'OK', onPress: undefined, style: 'default' as const }];

  const iconConfig = ICON_MAP[type];
  const iconScale = iconBounce.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleDismiss}>
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#0E1E1A' : '#FFFFFF',
              borderColor: isDark ? 'rgba(201,162,39,0.15)' : 'rgba(0,0,0,0.06)',
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Icon */}
          <Animated.View style={{ transform: [{ scale: iconScale }] }}>
            <LinearGradient
              colors={iconConfig.gradient as [string, string]}
              style={styles.iconCircle}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name={iconConfig.name as any} size={32} color="#FFFFFF" />
            </LinearGradient>
          </Animated.View>

          {/* Title */}
          <Text
            style={[
              styles.title,
              { color: isDark ? '#F4F0E8' : '#1C2420' },
            ]}
          >
            {title}
          </Text>

          {/* Message */}
          {message ? (
            <Text
              style={[
                styles.message,
                { color: isDark ? 'rgba(244,240,232,0.6)' : '#526059' },
              ]}
            >
              {message}
            </Text>
          ) : null}

          {/* Buttons */}
          <View style={styles.buttons}>
            {resolvedButtons.map((btn, i) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              const variant = isDestructive ? 'danger' : isCancel ? 'ghost' : 'primary';

              return (
                <FunButton
                  key={i}
                  title={btn.text}
                  onPress={() => handleButtonPress(btn)}
                  variant={variant}
                  size={resolvedButtons.length > 1 ? 'small' : 'normal'}
                  style={resolvedButtons.length > 1 ? styles.btnHalf : styles.btnFull}
                />
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 18, 16, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: SW - 64,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    padding: Spacing.xxl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: Spacing.xl,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
    marginTop: Spacing.sm,
  },
  btnFull: {
    flex: 1,
  },
  btnHalf: {
    flex: 1,
  },
});
