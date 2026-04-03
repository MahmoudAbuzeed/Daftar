import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../lib/theme-context';
import { FontFamily } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');

const ICON_MAP: Record<string, [string, string]> = {
  GroupsTab: ['people', 'people-outline'],
  DaftarTab: ['wallet', 'wallet-outline'],
  ActivityTab: ['flash', 'flash-outline'],
  ProfileTab: ['person-circle', 'person-circle-outline'],
};

export default function AnimatedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const tabCount = state.routes.length;
  const tabWidth = SCREEN_W / tabCount;

  const indicatorX = useRef(new Animated.Value(state.index * tabWidth)).current;
  const iconScales = useRef(state.routes.map((_, i) => new Animated.Value(i === state.index ? 1 : 0))).current;

  useEffect(() => {
    Animated.spring(indicatorX, {
      toValue: state.index * tabWidth,
      useNativeDriver: true,
      damping: 18,
      stiffness: 200,
      mass: 0.6,
    }).start();

    iconScales.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: i === state.index ? 1 : 0,
        useNativeDriver: true,
        damping: 14,
        stiffness: 180,
      }).start();
    });
  }, [state.index]);

  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.tabBarBorder,
          paddingBottom: bottomPad,
          shadowColor: colors.shadowColor,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.indicator,
          {
            width: tabWidth - 20,
            backgroundColor: isDark ? 'rgba(20,184,166,0.12)' : 'rgba(13,148,136,0.08)',
            borderColor: isDark ? 'rgba(20,184,166,0.25)' : 'rgba(13,148,136,0.18)',
            transform: [{ translateX: Animated.add(indicatorX, new Animated.Value(10)) }],
          },
        ]}
      />

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const icons = ICON_MAP[route.name] || ['ellipse', 'ellipse-outline'];
        const label = (options.tabBarLabel as string) || route.name;

        const iconScale = iconScales[index].interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.18],
        });

        const labelOpacity = iconScales[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0.55, 1],
        });

        const labelY = iconScales[index].interpolate({
          inputRange: [0, 1],
          outputRange: [2, 0],
        });

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
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
                size={24}
                color={isFocused ? colors.tabActive : colors.tabInactive}
              />
            </Animated.View>
            <Animated.Text
              style={[
                styles.label,
                {
                  color: isFocused ? colors.tabActive : colors.tabInactive,
                  opacity: labelOpacity,
                  transform: [{ translateY: labelY }],
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
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 15,
  },
  indicator: {
    position: 'absolute',
    top: 6,
    height: 46,
    borderRadius: 15,
    borderWidth: 1.5,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    gap: 3,
  },
  label: {
    fontFamily: FontFamily.bodySemibold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
