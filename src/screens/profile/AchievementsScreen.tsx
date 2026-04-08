import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Dimensions,
  Animated,
  Easing,
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { supabase } from '../../lib/supabase';
import { Spacing, Radius, FontFamily } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ACHIEVEMENT_DEFS, getAchievementDef } from '../../data/achievementDefinitions';
import BouncyPressable from '../../components/BouncyPressable';
import AnimatedListItem from '../../components/AnimatedListItem';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { useFocusEffect } from '@react-navigation/native';

const { width: SW } = Dimensions.get('window');

export default function AchievementsScreen() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [earnedAchievements, setEarnedAchievements] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch earned achievements when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const fetchAchievements = async () => {
        if (!profile?.id) return;
        try {
          const { data, error } = await supabase
            .from('user_achievements')
            .select('type, earned_at')
            .eq('user_id', profile.id);

          if (error) throw error;
          setEarnedAchievements(data?.map((d: any) => d.type) || []);
        } catch (err) {
          console.error('Error fetching achievements:', err);
        }
      };

      fetchAchievements();
    }, [profile?.id])
  );

  const handleShareBadge = async (badgeType: string) => {
    const def = getAchievementDef(badgeType as any);
    if (!def) return;

    const shareText = t(def.shareTextKey);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Share.share({
        message: shareText,
        url: 'https://fifti.app',
        title: t(def.titleKey),
      });
    } catch (err) {
      console.error('Error sharing badge:', err);
    }
  };

  const earnedCount = earnedAchievements.length;
  const totalCount = ACHIEVEMENT_DEFS.length;
  const progressPercent = Math.round((earnedCount / totalCount) * 100);

  return (
    <View style={styles.root}>
      <StatusBar barStyle={colors.statusBarStyle} />
      {isDark && (
        <LinearGradient
          colors={colors.headerGradient}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.3, y: 1 }}
        />
      )}

      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('achievements.sectionTitle')}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom + Spacing.xl, Spacing.xxl) }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Progress Section */}
          <Animated.View style={[styles.progressSection, entrance.style]}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>{t('achievements.progress')}</Text>
              <Text style={styles.progressCount}>{earnedCount}/{totalCount}</Text>
            </View>
            <View style={styles.progressBar}>
              <Animated.View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          </Animated.View>

          {/* Achievements List */}
          <View style={styles.listContainer}>
            {ACHIEVEMENT_DEFS.map((def, idx) => {
              const isEarned = earnedAchievements.includes(def.type);
              const isExpanded = expandedId === def.type;

              return (
                <AnimatedListItem key={def.type} index={idx}>
                  <BouncyPressable
                    onPress={() => {
                      setExpandedId(isExpanded ? null : def.type);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <View style={[styles.achievementCard, isExpanded && styles.achievementCardExpanded]}>
                      {/* Top Section: Icon + Title */}
                      <View style={styles.cardHeader}>
                        <LinearGradient
                          colors={def.gradientColors}
                          style={[styles.iconBadge, !isEarned && { opacity: 0.3 }]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <Ionicons
                            name={def.icon as any}
                            size={28}
                            color="#FFFFFF"
                          />
                        </LinearGradient>

                        <View style={styles.cardTitleSection}>
                          <Text
                            style={[styles.achievementTitle, !isEarned && { opacity: 0.5 }]}
                            numberOfLines={2}
                          >
                            {t(def.titleKey)}
                          </Text>
                          {!isEarned && (
                            <View style={styles.lockedBadge}>
                              <Ionicons name="lock-closed" size={11} color={colors.textTertiary} />
                              <Text style={styles.lockedText}>{t('achievements.locked')}</Text>
                            </View>
                          )}
                        </View>

                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={colors.textSecondary}
                        />
                      </View>

                      {/* Expanded Section: Description + Share */}
                      {isExpanded && (
                        <View style={styles.cardDetails}>
                          <Text style={styles.detailsDescription}>
                            {t(def.descKey)}
                          </Text>
                          {isEarned && (
                            <BouncyPressable onPress={() => handleShareBadge(def.type)}>
                              <View style={styles.shareButton}>
                                <Ionicons name="share-social" size={16} color={colors.accent} />
                                <Text style={styles.shareButtonText}>{t('achievements.share')}</Text>
                              </View>
                            </BouncyPressable>
                          )}
                        </View>
                      )}
                    </View>
                  </BouncyPressable>
                </AnimatedListItem>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    safe: { flex: 1 },
    scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
    headerTitle: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 18,
      color: c.text,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },

    progressSection: {
      marginBottom: Spacing.xxl,
      gap: Spacing.md,
    },
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    progressLabel: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 12,
      color: c.textSecondary,
      letterSpacing: 0.5,
    },
    progressCount: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 13,
      color: c.accent,
      letterSpacing: 0.3,
    },
    progressBar: {
      height: 8,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : c.bgSubtle,
      borderRadius: Radius.full,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: Radius.full,
      backgroundColor: c.accent,
    },

    listContainer: {
      gap: Spacing.md,
    },

    achievementCard: {
      borderRadius: Radius.lg,
      backgroundColor: isDark ? c.bgDarkCard : c.bgCard,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : c.borderLight,
      padding: Spacing.lg,
      overflow: 'hidden',
    },
    achievementCardExpanded: {
      borderColor: c.accent,
      borderWidth: 1.5,
    },

    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    iconBadge: {
      width: 56,
      height: 56,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    cardTitleSection: {
      flex: 1,
      gap: 6,
    },
    achievementTitle: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 15,
      color: c.text,
      letterSpacing: -0.3,
      lineHeight: 18,
    },
    lockedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      width: 'fit-content',
    },
    lockedText: {
      fontFamily: FontFamily.body,
      fontSize: 10,
      color: c.textTertiary,
      letterSpacing: 0.2,
      textTransform: 'capitalize',
    },

    cardDetails: {
      marginTop: Spacing.lg,
      paddingTop: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : c.borderLight,
      gap: Spacing.md,
    },
    detailsDescription: {
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: c.textSecondary,
      lineHeight: 16,
    },

    shareButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: Radius.lg,
      backgroundColor: isDark ? 'rgba(201,162,39,0.1)' : 'rgba(13,148,136,0.08)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(201,162,39,0.2)' : 'rgba(13,148,136,0.15)',
    },
    shareButtonText: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 13,
      color: c.accent,
      letterSpacing: 0.3,
    },
  });
