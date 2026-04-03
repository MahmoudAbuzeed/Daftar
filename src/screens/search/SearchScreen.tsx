import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TextInput,
  Keyboard,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { formatCurrency } from '../../utils/balance';
import { Spacing, Radius, FontFamily } from '../../theme';
import ThemedCard from '../../components/ThemedCard';
import BouncyPressable from '../../components/BouncyPressable';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

const { width: SW } = Dimensions.get('window');

// ── Types ──────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  type: 'group' | 'expense' | 'person';
  title: string;
  subtitle: string;
  onPress: () => void;
}

interface SearchSection {
  title: string;
  icon: string;
  data: SearchResult[];
}

// ── Helpers ────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, string> = {
  groups: 'people-circle-outline',
  expenses: 'receipt-outline',
  people: 'person-outline',
};

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// ── Component ──────────────────────────────────────────────────

export default function SearchScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // ── Search logic ─────────────────────────────────────────────

  const performSearch = useCallback(
    async (q: string) => {
      if (!user || q.length < 2) {
        setResults([]);
        setHasSearched(q.length >= 2);
        setLoading(false);
        return;
      }

      setLoading(true);
      setHasSearched(true);

      try {
        // Get user's group IDs
        const { data: memberships } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', user.id);

        const groupIds = (memberships ?? []).map((m) => m.group_id);

        // Search groups by name
        const { data: groups } = groupIds.length
          ? await supabase
              .from('groups')
              .select('id, name, currency')
              .in('id', groupIds)
              .ilike('name', `%${q}%`)
              .limit(5)
          : { data: [] };

        // Search expenses by description
        const { data: expenses } = groupIds.length
          ? await supabase
              .from('expenses')
              .select('id, description, total_amount, currency, group_id, created_at')
              .in('group_id', groupIds)
              .eq('is_deleted', false)
              .ilike('description', `%${q}%`)
              .order('created_at', { ascending: false })
              .limit(10)
          : { data: [] };

        // Search users by name (from group members)
        const { data: users } = await supabase
          .from('users')
          .select('id, display_name')
          .ilike('display_name', `%${q}%`)
          .limit(5);

        // Build sections
        const sections: SearchSection[] = [];

        if (groups && groups.length > 0) {
          sections.push({
            title: t('search.groups'),
            icon: SECTION_ICONS.groups,
            data: groups.map((g) => ({
              id: g.id,
              type: 'group' as const,
              title: g.name,
              subtitle: g.currency ?? 'EGP',
              onPress: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.replace('GroupDetail', { groupId: g.id });
              },
            })),
          });
        }

        if (expenses && expenses.length > 0) {
          sections.push({
            title: t('search.expenses'),
            icon: SECTION_ICONS.expenses,
            data: expenses.map((e) => ({
              id: e.id,
              type: 'expense' as const,
              title: e.description,
              subtitle: `${formatCurrency(e.total_amount, e.currency ?? 'EGP')} · ${formatDate(e.created_at)}`,
              onPress: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.replace('GroupDetail', { groupId: e.group_id });
              },
            })),
          });
        }

        if (users && users.length > 0) {
          sections.push({
            title: t('search.people'),
            icon: SECTION_ICONS.people,
            data: users.map((u) => ({
              id: u.id,
              type: 'person' as const,
              title: u.display_name ?? '',
              subtitle: '',
              onPress: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.goBack();
              },
            })),
          });
        }

        setResults(sections);
      } catch {
        // Silently fail — results stay empty
      } finally {
        setLoading(false);
      }
    },
    [user, navigation, t],
  );

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (text.length < 2) {
        setResults([]);
        setHasSearched(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      debounceRef.current = setTimeout(() => {
        performSearch(text);
      }, 300);
    },
    [performSearch],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Result icon ──────────────────────────────────────────────

  const iconForType = (type: SearchResult['type']): string => {
    switch (type) {
      case 'group':
        return 'people-circle-outline';
      case 'expense':
        return 'receipt-outline';
      case 'person':
        return 'person-outline';
    }
  };

  const iconColorForType = (type: SearchResult['type']): string => {
    switch (type) {
      case 'group':
        return colors.primary;
      case 'expense':
        return colors.accent;
      case 'person':
        return colors.success;
    }
  };

  // ── Render helpers ───────────────────────────────────────────

  const renderSectionHeader = ({ section }: { section: SearchSection }) => (
    <View style={styles.sectionHeader}>
      <Ionicons
        name={section.icon as any}
        size={16}
        color={colors.textTertiary}
        style={{ marginRight: Spacing.sm }}
      />
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  const renderItem = ({ item }: { item: SearchResult }) => (
    <BouncyPressable onPress={item.onPress} style={styles.resultRow}>
      <View
        style={[
          styles.resultIconWrap,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : `${iconColorForType(item.type)}12` },
        ]}
      >
        <Ionicons
          name={iconForType(item.type) as any}
          size={20}
          color={iconColorForType(item.type)}
        />
      </View>
      <View style={styles.resultTextWrap}>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text style={styles.resultSubtitle} numberOfLines={1}>
            {item.subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </BouncyPressable>
  );

  const renderEmpty = () => {
    if (loading) return null;
    if (!hasSearched) return null;

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="search-outline" size={36} color={colors.textTertiary} />
        </View>
        <Text style={styles.emptyTitle}>{t('search.noResults')}</Text>
        <Text style={styles.emptySubtitle}>
          {query.length > 0
            ? `No matches for "${query}"`
            : t('search.placeholder')}
        </Text>
      </View>
    );
  };

  // ── Main render ──────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Search Header */}
        <View style={styles.searchHeader}>
          <BouncyPressable
            onPress={() => {
              Keyboard.dismiss();
              navigation.goBack();
            }}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </BouncyPressable>

          <View style={styles.inputContainer}>
            <Ionicons
              name="search-outline"
              size={18}
              color={colors.textTertiary}
              style={{ marginRight: Spacing.sm }}
            />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder={t('search.placeholder')}
              placeholderTextColor={colors.textTertiary}
              value={query}
              onChangeText={handleQueryChange}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
        </View>

        {/* Loading indicator */}
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}

        {/* Results */}
        <SectionList
          sections={results}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    safe: { flex: 1 },

    // Search header
    searchHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      gap: Spacing.md,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.bgCard,
      borderWidth: 1,
      borderColor: isDark ? c.borderLight : c.border,
    },
    inputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.bgCard,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: isDark ? c.borderLight : c.border,
    },
    searchInput: {
      flex: 1,
      fontFamily: FontFamily.body,
      fontSize: 15,
      color: c.text,
      padding: 0,
    },

    // Loading
    loadingWrap: {
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },

    // Section headers
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.sm,
    },
    sectionHeaderText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 11,
      letterSpacing: 2,
      color: c.textTertiary,
      textTransform: 'uppercase',
    },

    // Result rows
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
    },
    resultIconWrap: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    resultTextWrap: {
      flex: 1,
      marginRight: Spacing.sm,
    },
    resultTitle: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 15,
      color: c.text,
      letterSpacing: -0.2,
    },
    resultSubtitle: {
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: c.textSecondary,
      marginTop: 2,
    },

    // Empty state
    emptyContainer: {
      alignItems: 'center',
      paddingTop: SW * 0.2,
      paddingHorizontal: Spacing.xxxl,
    },
    emptyIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : c.bgSubtle,
      borderWidth: 1.5,
      borderColor: isDark ? c.borderLight : c.border,
      marginBottom: Spacing.xl,
    },
    emptyTitle: {
      fontFamily: FontFamily.display,
      fontSize: 18,
      color: c.text,
      marginBottom: Spacing.sm,
    },
    emptySubtitle: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: c.textTertiary,
      textAlign: 'center',
      lineHeight: 22,
    },

    // List
    listContent: {
      paddingBottom: 100,
      flexGrow: 1,
    },
  });
