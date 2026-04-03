import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  StatusBar,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { Spacing, Radius, FontFamily } from '../../theme';
import FunButton from '../../components/FunButton';
import ThemedCard from '../../components/ThemedCard';
import BouncyPressable from '../../components/BouncyPressable';
import ThemedInput from '../../components/ThemedInput';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { useAlert } from '../../hooks/useAlert';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'AddFriends'>;

interface PhoneContact {
  id: string;
  name: string;
  phone: string;
}

const { width: SW } = Dimensions.get('window');

const AVATAR_GRADIENTS: [string, string][] = [
  ['#0D9488', '#14B8A6'], ['#7C3AED', '#A78BFA'], ['#DB2777', '#F472B6'],
  ['#EA580C', '#FB923C'], ['#2563EB', '#60A5FA'], ['#059669', '#34D399'],
  ['#D97706', '#FBBF24'], ['#4F46E5', '#818CF8'],
];

function avatarGradient(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

type Step = 'search' | 'review';

export default function AddFriendsScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const alert = useAlert();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();

  // State
  const [step, setStep] = useState<Step>('search');
  const [allContacts, setAllContacts] = useState<PhoneContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<PhoneContact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<PhoneContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<Contacts.PermissionStatus | null>(null);

  // Review step entrance
  const reviewAnim = useRef(new Animated.Value(0)).current;

  // Load contacts
  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      setPermissionStatus(status);
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        });
        const parsed: PhoneContact[] = [];
        const seenPhones = new Set<string>();
        for (const contact of data) {
          if (!contact.name || !contact.phoneNumbers?.length) continue;
          for (const pn of contact.phoneNumbers) {
            if (!pn.number) continue;
            const normalized = normalizePhone(pn.number);
            if (normalized.length < 6 || seenPhones.has(normalized)) continue;
            seenPhones.add(normalized);
            parsed.push({ id: `${contact.id}-${normalized}`, name: contact.name, phone: pn.number });
            break;
          }
        }
        parsed.sort((a, b) => a.name.localeCompare(b.name));
        setAllContacts(parsed);
        setFilteredContacts(parsed);
      }
    } catch {
      setPermissionStatus('denied' as Contacts.PermissionStatus);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  // Search filter
  useEffect(() => {
    if (!searchQuery.trim()) { setFilteredContacts(allContacts); return; }
    const q = searchQuery.toLowerCase();
    setFilteredContacts(allContacts.filter(c => c.name.toLowerCase().includes(q) || normalizePhone(c.phone).includes(q)));
  }, [searchQuery, allContacts]);

  // Select contact → go to review
  const selectContact = (contact: PhoneContact) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedContact(contact);
    setStep('review');
    reviewAnim.setValue(0);
    Animated.spring(reviewAnim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
  };

  // Select by search text (add custom name)
  const addByName = () => {
    if (!searchQuery.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedContact({ id: `custom-${Date.now()}`, name: searchQuery.trim(), phone: '' });
    setStep('review');
    reviewAnim.setValue(0);
    Animated.spring(reviewAnim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
  };

  // Add friend → save to daftar + send notification
  const handleAddFriend = async () => {
    if (!selectedContact || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setAdding(true);

    try {
      // Create a daftar entry link (so the friend appears in the user's contacts)
      await supabase.from('daftar_entries').insert({
        user_id: user.id,
        contact_name: selectedContact.name,
        amount: 0,
        direction: 'they_owe',
        note: t('addFriends.addedAsFriend'),
        is_settled: true,
      });

      // Show success with SMS option
      alert.show('success', t('addFriends.friendAdded'), t('addFriends.friendAddedBody'), [
        {
          text: t('addFriends.sendTextMessage'),
          onPress: () => {
            const message = i18n.language === 'ar'
              ? `أهلاً ${selectedContact.name}! حمّل تطبيق دفتر عشان نقسّم الحساب مع بعض بسهولة 📱`
              : `Hi ${selectedContact.name}! Download Daftar so we can split bills together easily 📱`;

            const phone = normalizePhone(selectedContact.phone);
            const smsUrl = Platform.OS === 'ios'
              ? `sms:${phone}&body=${encodeURIComponent(message)}`
              : `sms:${phone}?body=${encodeURIComponent(message)}`;

            Linking.openURL(smsUrl).catch(() => {
              // Fallback: try WhatsApp
              const waUrl = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
              Linking.openURL(waUrl).catch(() => {});
            });

            navigation.goBack();
          },
        },
        {
          text: t('notify.skip'),
          style: 'cancel',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (err: any) {
      alert.error(t('common.error'), err.message);
    } finally {
      setAdding(false);
    }
  };

  // ─── RENDER: Search Step ──────────────────────────────

  const renderSearchStep = () => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <BouncyPressable onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </BouncyPressable>
        <Text style={styles.headerTitle}>{t('addFriends.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search input */}
      <View style={styles.searchWrap}>
        <ThemedInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('addFriends.searchPlaceholder')}
          icon="search-outline"
          autoFocus
        />
      </View>

      {/* Add by name option */}
      {searchQuery.trim().length > 0 && (
        <BouncyPressable onPress={addByName} scaleDown={0.98}>
          <View style={styles.addByNameRow}>
            <View style={styles.addByNameIcon}>
              <Ionicons name="person-add-outline" size={20} color={colors.textSecondary} />
            </View>
            <Text style={styles.addByNameText}>
              {t('addFriends.addToDaftar', { name: searchQuery.trim() }) || `Add "${searchQuery.trim()}" to Daftar`}
            </Text>
          </View>
        </BouncyPressable>
      )}

      {/* Section label */}
      {filteredContacts.length > 0 && (
        <Text style={styles.sectionLabel}>{t('addFriends.fromContacts')}</Text>
      )}

      {/* Contact list */}
      <FlatList
        data={filteredContacts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const gradient = avatarGradient(item.name);
          // Highlight matching text
          const q = searchQuery.toLowerCase();
          const nameIdx = item.name.toLowerCase().indexOf(q);

          return (
            <BouncyPressable onPress={() => selectContact(item)} scaleDown={0.98}>
              <View style={styles.contactRow}>
                <LinearGradient colors={gradient} style={styles.avatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
                </LinearGradient>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>
                    {nameIdx >= 0 && q.length > 0 ? (
                      <>
                        <Text>{item.name.slice(0, nameIdx)}</Text>
                        <Text style={{ color: colors.primary }}>{item.name.slice(nameIdx, nameIdx + q.length)}</Text>
                        <Text>{item.name.slice(nameIdx + q.length)}</Text>
                      </>
                    ) : item.name}
                  </Text>
                  <Text style={styles.contactPhone}>{item.phone}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </View>
            </BouncyPressable>
          );
        }}
        contentContainerStyle={filteredContacts.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={36} color={colors.textTertiary} />
              <Text style={styles.emptyText}>{t('addFriends.noContacts')}</Text>
            </View>
          ) : null
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      />
    </>
  );

  // ─── RENDER: Review Step ──────────────────────────────

  const renderReviewStep = () => {
    if (!selectedContact) return null;
    const gradient = avatarGradient(selectedContact.name);

    return (
      <Animated.View style={[styles.reviewContainer, {
        opacity: reviewAnim,
        transform: [{ translateY: reviewAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      }]}>
        {/* Header */}
        <View style={styles.header}>
          <BouncyPressable onPress={() => setStep('search')}>
            <View style={styles.backBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </View>
          </BouncyPressable>
          <Text style={styles.headerTitle}>{t('addFriends.review')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Selected contact card */}
        <ThemedCard style={styles.reviewCard}>
          <View style={styles.reviewRow}>
            <LinearGradient colors={gradient} style={styles.reviewAvatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.reviewAvatarText}>{getInitials(selectedContact.name)}</Text>
            </LinearGradient>
            <View style={styles.reviewInfo}>
              <Text style={styles.reviewName}>{selectedContact.name}</Text>
              {selectedContact.phone ? (
                <View style={styles.reviewPhoneRow}>
                  <Text style={styles.reviewFlag}>🇪🇬</Text>
                  <Text style={styles.reviewPhone}>{selectedContact.phone}</Text>
                </View>
              ) : (
                <Text style={styles.reviewNoPhone}>{t('addFriends.noPhone')}</Text>
              )}
            </View>
            <BouncyPressable onPress={() => setStep('search')}>
              <Text style={styles.editLink}>{t('common.edit') || 'Edit'}</Text>
            </BouncyPressable>
          </View>
        </ThemedCard>

        {/* Explanation */}
        <Text style={styles.reviewExplain}>
          {t('addFriends.reviewExplain') || 'This person will be notified that you added them as a friend. You can start adding expenses right away.'}
        </Text>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Add button */}
        <FunButton
          title={t('addFriends.addFriend')}
          onPress={handleAddFriend}
          loading={adding}
          icon={<Ionicons name="person-add-outline" size={18} color="#FFFFFF" />}
          style={{ marginHorizontal: Spacing.lg, marginBottom: Math.max(insets.bottom, Spacing.xl) }}
        />
      </Animated.View>
    );
  };

  // ─── RENDER: Permission denied ──────────────────────────

  if (!loading && permissionStatus !== null && permissionStatus !== 'granted') {
    return (
      <View style={styles.root}>
        <StatusBar barStyle={colors.statusBarStyle} />
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <BouncyPressable onPress={() => navigation.goBack()}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </BouncyPressable>
            <Text style={styles.headerTitle}>{t('addFriends.title')}</Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.permissionWrap}>
            <Ionicons name="lock-closed-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.permissionTitle}>{t('addFriends.permissionNeeded')}</Text>
            <Text style={styles.permissionExplain}>{t('addFriends.permissionExplain')}</Text>
            <FunButton
              title={t('addFriends.grantAccess')}
              onPress={async () => {
                const { status } = await Contacts.requestPermissionsAsync();
                if (status === 'granted') loadContacts();
                else Linking.openSettings();
              }}
              style={{ marginTop: Spacing.xl }}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ─── MAIN RENDER ──────────────────────────────

  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle={colors.statusBarStyle} />
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle={colors.statusBarStyle} />
      {isDark && <LinearGradient colors={colors.headerGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} />}
      <SafeAreaView style={styles.safe}>
        {step === 'search' ? renderSearchStep() : renderReviewStep()}
      </SafeAreaView>
    </View>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    safe: { flex: 1 },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    cancelText: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 16,
      color: c.primary,
    },
    headerTitle: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 17,
      color: c.text,
    },
    headerSpacer: { width: 60 },
    backBtn: {
      width: 36, height: 36, borderRadius: 12,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.borderLight,
    },

    // Search
    searchWrap: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.sm,
    },

    // Add by name
    addByNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: c.borderLight,
    },
    addByNameIcon: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.borderLight,
      justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md,
    },
    addByNameText: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 15,
      color: c.textSecondary,
      flex: 1,
    },

    // Section label
    sectionLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 12,
      color: c.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.sm,
    },

    // Contact row
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xl,
    },
    avatar: {
      width: 40, height: 40, borderRadius: 20,
      justifyContent: 'center', alignItems: 'center',
    },
    avatarText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 14, color: '#FFFFFF',
    },
    contactInfo: { flex: 1, marginHorizontal: Spacing.md },
    contactName: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 15, color: c.text,
    },
    contactPhone: {
      fontFamily: FontFamily.body,
      fontSize: 12, color: c.textTertiary, marginTop: 1,
    },

    // List
    list: { paddingBottom: 40 },
    emptyList: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { alignItems: 'center', gap: Spacing.md },
    emptyText: { fontFamily: FontFamily.body, fontSize: 15, color: c.textTertiary },

    // Review step
    reviewContainer: { flex: 1 },
    reviewCard: { marginHorizontal: Spacing.lg, marginTop: Spacing.sm },
    reviewRow: { flexDirection: 'row', alignItems: 'center' },
    reviewAvatar: {
      width: 50, height: 50, borderRadius: 25,
      justifyContent: 'center', alignItems: 'center',
    },
    reviewAvatarText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 18, color: '#FFFFFF',
    },
    reviewInfo: { flex: 1, marginHorizontal: Spacing.lg },
    reviewName: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 17, color: c.text,
    },
    reviewPhoneRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    reviewFlag: { fontSize: 14, marginRight: 6 },
    reviewPhone: {
      fontFamily: FontFamily.body,
      fontSize: 14, color: c.textSecondary,
    },
    reviewNoPhone: {
      fontFamily: FontFamily.body,
      fontSize: 13, color: c.textTertiary, marginTop: 2,
    },
    editLink: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 15, color: c.primary,
    },
    reviewExplain: {
      fontFamily: FontFamily.body,
      fontSize: 14, color: c.textTertiary,
      textAlign: 'center',
      lineHeight: 21,
      paddingHorizontal: Spacing.xxxl,
      marginTop: Spacing.xxl,
    },

    // Permission
    permissionWrap: {
      flex: 1, justifyContent: 'center', alignItems: 'center',
      paddingHorizontal: Spacing.xxxl,
    },
    permissionTitle: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 18, color: c.text,
      marginTop: Spacing.xl, marginBottom: Spacing.sm,
    },
    permissionExplain: {
      fontFamily: FontFamily.body,
      fontSize: 14, color: c.textSecondary,
      textAlign: 'center', lineHeight: 22,
    },
  });
