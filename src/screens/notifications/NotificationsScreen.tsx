import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import {
  getNotifications,
  markNotificationRead,
  deleteNotification,
  getUnreadNotificationCount,
} from '../../lib/notifications';
import { Notification } from '../../types/database';
import { Spacing, Radius, FontFamily } from '../../theme';
import AnimatedListItem from '../../components/AnimatedListItem';
import ThemedCard from '../../components/ThemedCard';
import BouncyPressable from '../../components/BouncyPressable';
import useScreenEntrance from '../../hooks/useScreenEntrance';

const { width: SW } = Dimensions.get('window');

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Bouncing empty-state icon
  const emptyBounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(emptyBounce, {
          toValue: -12,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(emptyBounce, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const data = await getNotifications(profile.id);
      setNotifications(data);
      const count = await getUnreadNotificationCount(profile.id);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchNotifications();
    }, [fetchNotifications])
  );

  const handleNotificationPress = async (notification: Notification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!notification.is_read) {
      await markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    // TODO: Navigate to group detail based on notification.data.groupId
  };

  const handleNotificationDelete = async (notificationId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const notification = notifications.find((n) => n.id === notificationId);
    if (notification && !notification.is_read) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    await deleteNotification(notificationId);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t('common.now');
    if (diffMins < 60) return t('common.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('common.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('common.daysAgo', { count: diffDays });
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type: string): string => {
    switch (type) {
      case 'expense':
        return 'receipt-outline';
      case 'settlement':
        return 'checkmark-done-outline';
      case 'group_settled':
        return 'happy-outline';
      default:
        return 'notifications-outline';
    }
  };

  const getNotificationColor = (type: string): string[] => {
    switch (type) {
      case 'expense':
        return colors.dangerGradient;
      case 'settlement':
        return colors.successGradient;
      case 'group_settled':
        return colors.primaryGradient;
      default:
        return colors.neutralGradient;
    }
  };

  const renderNotificationItem = ({ item, index }: { item: Notification; index: number }) => (
    <AnimatedListItem index={index}>
      <BouncyPressable
        onPress={() => handleNotificationPress(item)}
        style={[styles.notificationCard, !item.is_read && styles.unreadCard]}
      >
        <View style={styles.notificationContent}>
          <View style={styles.leftSection}>
            <LinearGradient
              colors={getNotificationColor(item.type)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.icon}
            >
              <Ionicons name={getNotificationIcon(item.type) as any} size={20} color="white" />
            </LinearGradient>
          </View>

          <View style={styles.middleSection}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.body} numberOfLines={2}>
              {item.body}
            </Text>
            <Text style={styles.time}>{formatTime(item.created_at)}</Text>
          </View>

          <View style={styles.rightSection}>
            {!item.is_read && <View style={styles.unreadDot} />}
            <Pressable
              onPress={() => handleNotificationDelete(item.id)}
              hitSlop={8}
              style={styles.deleteButton}
            >
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      </BouncyPressable>
    </AnimatedListItem>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Animated.View style={[styles.emptyIcon, { transform: [{ translateY: emptyBounce }] }]}>
        <Ionicons name="notifications-off-outline" size={64} color={colors.textTertiary} />
      </Animated.View>
      <Text style={styles.emptyTitle}>{t('notifications.empty')}</Text>
      <Text style={styles.emptySubtitle}>{t('notifications.emptySubtitle')}</Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount}</Text>
        </View>
      )}
    </View>
  );

  if (loading && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        {renderHeader()}
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.contentContainer}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchNotifications} tintColor={colors.primary} />}
        scrollEnabled={notifications.length > 0}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    contentContainer: {
      paddingBottom: Spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      fontFamily: FontFamily.bold,
    },
    badge: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      minWidth: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badgeText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '700',
      fontFamily: FontFamily.semibold,
    },
    notificationCard: {
      marginHorizontal: Spacing.md,
      marginVertical: Spacing.xs,
      borderRadius: Radius.lg,
      backgroundColor: colors.bgCard,
      overflow: 'hidden',
    },
    unreadCard: {
      backgroundColor: isDark ? 'rgba(29, 185, 84, 0.08)' : 'rgba(29, 185, 84, 0.04)',
    },
    notificationContent: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: Spacing.md,
    },
    leftSection: {
      marginRight: Spacing.md,
    },
    icon: {
      width: 44,
      height: 44,
      borderRadius: Radius.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    middleSection: {
      flex: 1,
      marginRight: Spacing.md,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      fontFamily: FontFamily.semibold,
      marginBottom: Spacing.xs,
    },
    body: {
      fontSize: 13,
      color: colors.textSecondary,
      fontFamily: FontFamily.regular,
      marginBottom: Spacing.xs,
      lineHeight: 18,
    },
    time: {
      fontSize: 12,
      color: colors.textTertiary,
      fontFamily: FontFamily.regular,
    },
    rightSection: {
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 44,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginBottom: Spacing.xs,
    },
    deleteButton: {
      padding: Spacing.xs,
    },
    centerLoader: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      marginTop: 80,
    },
    emptyIcon: {
      marginBottom: Spacing.lg,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: Spacing.sm,
      fontFamily: FontFamily.semibold,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      fontFamily: FontFamily.regular,
      textAlign: 'center',
    },
  });
