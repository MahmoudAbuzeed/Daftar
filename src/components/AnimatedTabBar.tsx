import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../lib/theme-context';
import { FontFamily } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const DOCK_H_PAD = 14;
const DOCK_WIDTH = SCREEN_W - DOCK_H_PAD * 2;

const ICON_MAP: Record<string, [string, string]> = {
  FriendsTab: ['person-add', 'person-add-outline'],
  GroupsTab: ['people', 'people-outline'],
  DaftarTab: ['wallet', 'wallet-outline'],
  ActivityTab: ['flash', 'flash-outline'],
  ProfileTab: ['person-circle', 'person-circle-outline'],
};

export default function AnimatedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const tabCount = state.routes.length;
  const tabWidth = DOCK_WIDTH / tabCount;

  const pillX = useRef(new Animated.Value(state.index * tabWidth)).current;
  const anims = useRef(
    state.routes.map((_, i) => new Animated.Value(i === state.index ? 1 : 0)),
  ).current;

  // Entrance
  const dockY = useRef(new Animated.Value(80)).current;
  const dockOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(dockY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 180,
        mass: 0.8,
        delay: 200,
      }),
      Animated.timing(dockOpacity, {
        toValue: 1,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.spring(pillX, {
      toValue: state.index * tabWidth,
      useNativeDriver: true,
      damping: 22,
      stiffness: 220,
      mass: 0.5,
    }).start();

    anims.forEach((a, i) => {
      Animated.spring(a, {
        toValue: i === state.index ? 1 : 0,
        useNativeDriver: true,
        damping: 14,
        stiffness: 180,
      }).start();
    });
  }, [state.index]);

  const bottomPad = Math.max(insets.bottom, 8);

  const dockBg = isDark
    ? 'rgba(6, 15, 13, 0.94)'
    : 'rgba(255, 255, 255, 0.96)';

  const dockBorder = isDark
    ? 'rgba(201, 162, 39, 0.12)'
    : 'rgba(0, 0, 0, 0.08)';

  const pillGradient: [string, string, ...string[]] = isDark
    ? [colors.primaryDark, colors.primary]
    : [colors.primary, colors.primaryLight];

  return (
    <Animated.View
      style={[
        styles.dockOuter,
        {
          paddingBottom: bottomPad,
          opacity: dockOpacity,
          transform: [{ translateY: dockY }],
        },
      ]}
    >
      <View
        style={[
          styles.dock,
          {
            backgroundColor: dockBg,
            borderColor: dockBorder,
            shadowColor: isDark ? '#000' : '#3B4F47',
          },
        ]}
      >
        {/* Sliding gradient pill */}
        <Animated.View
          style={[
            styles.pillWrap,
            {
              width: tabWidth - 12,
              transform: [{ translateX: Animated.add(pillX, new Animated.Value(6)) }],
            },
          ]}
        >
          <LinearGradient
            colors={pillGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pill}
          />
        </Animated.View>

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const icons = ICON_MAP[route.name] || ['ellipse', 'ellipse-outline'];
          const label = (options.tabBarLabel as string) || route.name;
          const anim = anims[index];

          const iconScale = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.12],
          });

          const labelOpacity = anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.5, 0.75, 1],
          });

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={styles.tab}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={label}
            >
              <Animated.View style={{ transform: [{ scale: iconScale }] }}>
                <Ionicons
                  name={icons[isFocused ? 0 : 1] as any}
                  size={22}
                  color={isFocused ? '#FFFFFF' : isDark ? 'rgba(244,240,232,0.3)' : colors.textTertiary}
                />
              </Animated.View>
              <Animated.Text
                style={[
                  styles.label,
                  {
                    color: isFocused
                      ? '#FFFFFF'
                      : isDark
                        ? 'rgba(244,240,232,0.25)'
                        : colors.textTertiary,
                    opacity: labelOpacity,
                  },
                ]}
                numberOfLines={1}
              >
                {label}
              </Animated.Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dockOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: DOCK_H_PAD,
  },
  dock: {
    flexDirection: 'row',
    width: '100%',
    borderRadius: 20,
    paddingVertical: 6,
    borderWidth: 1,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 16,
    overflow: 'hidden',
  },
  pillWrap: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 0,
  },
  pill: {
    flex: 1,
    borderRadius: 15,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    gap: 2,
    zIndex: 1,
  },
  label: {
    fontFamily: FontFamily.bodySemibold,
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
