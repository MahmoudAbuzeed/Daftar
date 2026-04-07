import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Animated,
  Share,
  Clipboard,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Group, GroupMember, User } from '../../types/database';
import { generateInviteMessage, shareViaWhatsApp } from '../../utils/whatsapp';
import { Spacing, Radius, FontFamily } from '../../theme';
import FunButton from '../../components/FunButton';
import ThemedCard from '../../components/ThemedCard';
import ThemedInput from '../../components/ThemedInput';
import BouncyPressable from '../../components/BouncyPressable';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { useAlert } from '../../hooks/useAlert';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupSettings'>;

const AVATAR_GRADIENTS: [string, string][] = [
  ['#0D9488', '#14B8A6'],
  ['#A67C00', '#D4AF37'],
  ['#7C3AED', '#A78BFA'],
  ['#DC2626', '#F87171'],
  ['#2563EB', '#60A5FA'],
  ['#D97706', '#FBBF24'],
  ['#059669', '#34D399'],
  ['#DB2777', '#F472B6'],
];

function avatarGradient(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function GroupSettingsScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const alert = useAlert();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [descValue, setDescValue] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = useMemo(
    () => members.some((m) => m.user_id === user?.id && m.role === 'admin'),
    [members, user]
  );

  const isCreator = group?.created_by === user?.id;

  const fetchData = useCallback(async () => {
    try {
      const [{ data: groupData }, { data: membersData }] = await Promise.all([
        supabase.from('groups').select('*').eq('id', groupId).single(),
        supabase
          .from('group_members')
          .select('*, user:users(*)')
          .eq('group_id', groupId)
          .order('joined_at', { ascending: true }),
      ]);

      if (groupData) {
        setGroup(groupData);
        setNameValue(groupData.name);
        setDescValue(groupData.description || '');
      }
      if (membersData) setMembers(membersData);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Edit group ---
  const saveGroupName = async () => {
    if (!nameValue.trim() || !group) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('groups')
        .update({ name: nameValue.trim() })
        .eq('id', groupId);
      if (error) throw error;
      setGroup({ ...group, name: nameValue.trim() });
      setEditingName(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      alert.error(t('common.error'), err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveGroupDesc = async () => {
    if (!group) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('groups')
        .update({ description: descValue.trim() || null })
        .eq('id', groupId);
      if (error) throw error;
      setGroup({ ...group, description: descValue.trim() || null });
      setEditingDesc(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      alert.error(t('common.error'), err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- Invite ---
  const copyInviteCode = () => {
    if (!group) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Clipboard.setString(group.invite_code);
    alert.success(t('group_settings.codeCopied'));
  };

  const shareInvite = () => {
    if (!group) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const lang = (i18n.language === 'ar' ? 'ar' : 'en') as 'en' | 'ar';
    const message = generateInviteMessage(group.name, group.invite_code, lang);
    shareViaWhatsApp(message);
  };

  const shareInviteGeneric = async () => {
    if (!group) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const lang = (i18n.language === 'ar' ? 'ar' : 'en') as 'en' | 'ar';
    const message = generateInviteMessage(group.name, group.invite_code, lang);
    try {
      await Share.share({ message });
    } catch {
      // cancelled
    }
  };

  // --- Member management ---
  const removeMember = (member: GroupMember) => {
    const memberName = member.user?.display_name || t('common.unknown');
    alert.confirm(
      t('group_settings.removeMember'),
      t('group_settings.removeMemberConfirm', { name: memberName }),
      async () => {
        try {
          const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('id', member.id);
          if (error) throw error;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setMembers((prev) => prev.filter((m) => m.id !== member.id));
        } catch (err: any) {
          alert.error(t('common.error'), err.message);
        }
      },
      t('group_settings.remove'),
      t('common.cancel'),
      true
    );
  };

  const toggleRole = async (member: GroupMember) => {
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    try {
      const { error } = await supabase
        .from('group_members')
        .update({ role: newRole })
        .eq('id', member.id);
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
      );
    } catch (err: any) {
      alert.error(t('common.error'), err.message);
    }
  };

  // --- Leave group ---
  const handleLeave = () => {
    alert.confirm(
      t('groups.leave'),
      t('group_settings.leaveConfirm'),
      async () => {
        try {
          const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', user!.id);
          if (error) throw error;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          navigation.popToTop();
        } catch (err: any) {
          alert.error(t('common.error'), err.message);
        }
      },
      t('groups.leave'),
      t('common.cancel'),
      true
    );
  };

  // --- Archive group ---
  const handleArchive = () => {
    alert.confirm(
      t('groups.archive'),
      t('group_settings.archiveConfirm'),
      async () => {
        try {
          const { error } = await supabase
            .from('groups')
            .update({ is_archived: true })
            .eq('id', groupId);
          if (error) throw error;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          navigation.popToTop();
        } catch (err: any) {
          alert.error(t('common.error'), err.message);
        }
      },
      t('groups.archive'),
      t('common.cancel'),
      true
    );
  };

  // --- Delete group ---
  const handleDelete = () => {
    alert.confirm(
      t('group_settings.deleteGroup'),
      t('group_settings.deleteConfirm'),
      async () => {
        try {
          // Delete members first, then group
          await supabase.from('group_members').delete().eq('group_id', groupId);
          const { error } = await supabase
            .from('groups')
            .delete()
            .eq('id', groupId);
          if (error) throw error;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          navigation.popToTop();
        } catch (err: any) {
          alert.error(t('common.error'), err.message);
        }
      },
      t('common.delete'),
      t('common.cancel'),
      true
    );
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle={colors.statusBarStyle} />
      </View>
    );
  }

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

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={entrance.style}>
          {/* --- Group Info Section --- */}
          <Text style={styles.sectionLabel}>
            {t('group_settings.groupInfo')}
          </Text>
          <ThemedCard accent style={styles.card}>
            {/* Name */}
            {editingName ? (
              <View style={styles.editRow}>
                <ThemedInput
                  value={nameValue}
                  onChangeText={setNameValue}
                  placeholder={t('groups.name')}
                  maxLength={50}
                  autoFocus
                  containerStyle={styles.editInput}
                />
                <View style={styles.editActions}>
                  <BouncyPressable onPress={saveGroupName} scaleDown={0.9}>
                    <View style={styles.editSaveBtn}>
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    </View>
                  </BouncyPressable>
                  <BouncyPressable
                    onPress={() => {
                      setEditingName(false);
                      setNameValue(group?.name || '');
                    }}
                    scaleDown={0.9}
                  >
                    <View style={styles.editCancelBtn}>
                      <Ionicons
                        name="close"
                        size={18}
                        color={colors.textTertiary}
                      />
                    </View>
                  </BouncyPressable>
                </View>
              </View>
            ) : (
              <BouncyPressable
                onPress={() => isAdmin && setEditingName(true)}
                scaleDown={0.98}
              >
                <View style={styles.infoRow}>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('groups.name')}</Text>
                    <Text style={styles.infoValue}>{group?.name}</Text>
                  </View>
                  {isAdmin && (
                    <Ionicons
                      name="pencil-outline"
                      size={16}
                      color={colors.textTertiary}
                    />
                  )}
                </View>
              </BouncyPressable>
            )}

            <View style={styles.divider} />

            {/* Description */}
            {editingDesc ? (
              <View style={styles.editRow}>
                <ThemedInput
                  value={descValue}
                  onChangeText={setDescValue}
                  placeholder={t('groups.description')}
                  maxLength={200}
                  multiline
                  autoFocus
                  containerStyle={styles.editInput}
                />
                <View style={styles.editActions}>
                  <BouncyPressable onPress={saveGroupDesc} scaleDown={0.9}>
                    <View style={styles.editSaveBtn}>
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    </View>
                  </BouncyPressable>
                  <BouncyPressable
                    onPress={() => {
                      setEditingDesc(false);
                      setDescValue(group?.description || '');
                    }}
                    scaleDown={0.9}
                  >
                    <View style={styles.editCancelBtn}>
                      <Ionicons
                        name="close"
                        size={18}
                        color={colors.textTertiary}
                      />
                    </View>
                  </BouncyPressable>
                </View>
              </View>
            ) : (
              <BouncyPressable
                onPress={() => isAdmin && setEditingDesc(true)}
                scaleDown={0.98}
              >
                <View style={styles.infoRow}>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>
                      {t('groups.description')}
                    </Text>
                    <Text style={styles.infoValue}>
                      {group?.description || t('group_settings.noDescription')}
                    </Text>
                  </View>
                  {isAdmin && (
                    <Ionicons
                      name="pencil-outline"
                      size={16}
                      color={colors.textTertiary}
                    />
                  )}
                </View>
              </BouncyPressable>
            )}

            <View style={styles.divider} />

            {/* Currency */}
            <View style={styles.infoRow}>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('groups.currency')}</Text>
                <Text style={styles.infoValue}>{group?.currency}</Text>
              </View>
            </View>
          </ThemedCard>

          {/* --- Invite Section --- */}
          <Text style={styles.sectionLabel}>
            {t('group_settings.invite')}
          </Text>
          <ThemedCard accent style={styles.card}>
            <View style={styles.inviteCodeRow}>
              <View style={styles.inviteCodeBox}>
                <Text style={styles.inviteCodeLabel}>
                  {t('groups.invite_code')}
                </Text>
                <Text style={styles.inviteCode}>{group?.invite_code}</Text>
              </View>
              <BouncyPressable onPress={copyInviteCode} scaleDown={0.9}>
                <View style={styles.copyBtn}>
                  <Ionicons
                    name="copy-outline"
                    size={18}
                    color={colors.primary}
                  />
                </View>
              </BouncyPressable>
            </View>

            <View style={styles.inviteButtons}>
              <BouncyPressable onPress={shareInvite} scaleDown={0.95}>
                <View style={styles.inviteBtn}>
                  <Ionicons
                    name="logo-whatsapp"
                    size={18}
                    color={colors.success}
                  />
                  <Text style={styles.inviteBtnText}>WhatsApp</Text>
                </View>
              </BouncyPressable>
              <BouncyPressable onPress={shareInviteGeneric} scaleDown={0.95}>
                <View style={styles.inviteBtn}>
                  <Ionicons
                    name="share-outline"
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={styles.inviteBtnText}>
                    {t('group_settings.shareLink')}
                  </Text>
                </View>
              </BouncyPressable>
            </View>
          </ThemedCard>

          {/* --- Members Section --- */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>
              {t('groups.members')}
            </Text>
            <Text style={styles.sectionCount}>{members.length}</Text>
          </View>

          {members.map((member) => {
            const memberUser = member.user as User | undefined;
            const name = memberUser?.display_name || t('common.unknown');
            const isYou = member.user_id === user?.id;
            const grad = avatarGradient(name);

            return (
              <ThemedCard key={member.id} style={styles.memberCard}>
                <View style={styles.memberRow}>
                  <LinearGradient
                    colors={grad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.memberAvatar}
                  >
                    <Text style={styles.memberAvatarText}>
                      {getInitials(name)}
                    </Text>
                  </LinearGradient>

                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {name}
                      {isYou && (
                        <Text style={styles.youTag}>
                          {' '}
                          ({t('common.you')})
                        </Text>
                      )}
                    </Text>
                    {memberUser?.phone && (
                      <Text style={styles.memberPhone}>
                        {memberUser.phone}
                      </Text>
                    )}
                  </View>

                  {/* Role badge */}
                  <View
                    style={[
                      styles.roleBadge,
                      member.role === 'admin' && styles.roleBadgeAdmin,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleBadgeText,
                        member.role === 'admin' && styles.roleBadgeTextAdmin,
                      ]}
                    >
                      {member.role === 'admin'
                        ? t('group_settings.admin')
                        : t('group_settings.member')}
                    </Text>
                  </View>

                  {/* Admin actions on other members */}
                  {isAdmin && !isYou && (
                    <View style={styles.memberActions}>
                      <BouncyPressable
                        onPress={() => toggleRole(member)}
                        scaleDown={0.9}
                      >
                        <View style={styles.memberActionBtn}>
                          <Ionicons
                            name={
                              member.role === 'admin'
                                ? 'arrow-down-outline'
                                : 'arrow-up-outline'
                            }
                            size={14}
                            color={colors.primary}
                          />
                        </View>
                      </BouncyPressable>
                      <BouncyPressable
                        onPress={() => removeMember(member)}
                        scaleDown={0.9}
                      >
                        <View style={styles.memberRemoveBtn}>
                          <Ionicons
                            name="person-remove-outline"
                            size={14}
                            color={colors.danger}
                          />
                        </View>
                      </BouncyPressable>
                    </View>
                  )}
                </View>
              </ThemedCard>
            );
          })}

          {/* --- Add People --- */}
          <BouncyPressable
            onPress={() => navigation.navigate('AddFriends')}
            scaleDown={0.97}
          >
            <View style={styles.addPeopleBtn}>
              <Ionicons
                name="person-add-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.addPeopleText}>
                {t('group_settings.addPeople')}
              </Text>
            </View>
          </BouncyPressable>

          {/* --- Danger Zone --- */}
          <Text style={[styles.sectionLabel, styles.dangerLabel]}>
            {t('group_settings.dangerZone')}
          </Text>

          <View style={styles.dangerActions}>
            <BouncyPressable onPress={handleLeave} scaleDown={0.97}>
              <View style={styles.dangerButton}>
                <Ionicons name="exit-outline" size={20} color={colors.danger} />
                <Text style={styles.dangerButtonText}>{t('groups.leave')}</Text>
              </View>
            </BouncyPressable>

            {isAdmin && (
              <BouncyPressable onPress={handleArchive} scaleDown={0.97}>
                <View style={styles.dangerButton}>
                  <Ionicons name="archive-outline" size={20} color={colors.danger} />
                  <Text style={styles.dangerButtonText}>{t('groups.archive')}</Text>
                </View>
              </BouncyPressable>
            )}

            {isCreator && (
              <FunButton
                title={t('group_settings.deleteGroup')}
                onPress={handleDelete}
                variant="danger"
                icon={
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                }
              />
            )}
          </View>

          <View style={{ height: insets.bottom + 40 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    content: {
      padding: Spacing.xl,
      paddingBottom: 60,
    },

    /* Section */
    sectionLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 11,
      letterSpacing: 3,
      color: isDark ? c.kicker : c.textSecondary,
      textTransform: 'uppercase',
      marginBottom: Spacing.md,
      marginTop: Spacing.lg,
    },
    sectionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
      marginTop: Spacing.lg,
    },
    sectionCount: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 13,
      color: c.primary,
    },

    /* Card */
    card: { marginBottom: Spacing.sm },

    /* Info rows */
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.xs,
    },
    infoContent: { flex: 1 },
    infoLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 11,
      letterSpacing: 1,
      color: c.textTertiary,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    infoValue: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 16,
      color: c.text,
    },
    divider: {
      height: 1,
      backgroundColor: c.borderLight,
      marginVertical: Spacing.md,
    },

    /* Edit mode */
    editRow: {
      gap: Spacing.sm,
    },
    editInput: { flex: 1 },
    editActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      justifyContent: 'flex-end',
    },
    editSaveBtn: {
      width: 36,
      height: 36,
      borderRadius: Radius.full,
      backgroundColor: c.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    editCancelBtn: {
      width: 36,
      height: 36,
      borderRadius: Radius.full,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.borderLight,
      justifyContent: 'center',
      alignItems: 'center',
    },

    /* Invite */
    inviteCodeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    inviteCodeBox: { flex: 1 },
    inviteCodeLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 11,
      letterSpacing: 1,
      color: c.textTertiary,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    inviteCode: {
      fontFamily: FontFamily.display,
      fontSize: 28,
      color: c.primary,
      letterSpacing: 4,
    },
    copyBtn: {
      width: 40,
      height: 40,
      borderRadius: Radius.full,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.borderLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    inviteButtons: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.lg,
    },
    inviteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: Radius.full,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.borderLight,
    },
    inviteBtnText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 13,
      color: c.text,
    },

    /* Members */
    memberCard: { marginBottom: Spacing.sm },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: Radius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    memberAvatarText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 14,
      color: '#FFFFFF',
    },
    memberInfo: { flex: 1 },
    memberName: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 15,
      color: c.text,
    },
    youTag: {
      fontFamily: FontFamily.body,
      fontSize: 12,
      color: c.textTertiary,
    },
    memberPhone: {
      fontFamily: FontFamily.body,
      fontSize: 12,
      color: c.textTertiary,
      marginTop: 1,
    },
    roleBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: Radius.full,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.borderLight,
    },
    roleBadgeAdmin: {
      backgroundColor: isDark ? 'rgba(29,185,84,0.15)' : c.primarySurface,
    },
    roleBadgeText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 11,
      color: c.textTertiary,
    },
    roleBadgeTextAdmin: {
      color: c.primary,
    },
    memberActions: {
      flexDirection: 'row',
      gap: Spacing.xs,
      marginLeft: Spacing.xs,
    },
    memberActionBtn: {
      width: 30,
      height: 30,
      borderRadius: Radius.full,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.borderLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    memberRemoveBtn: {
      width: 30,
      height: 30,
      borderRadius: Radius.full,
      backgroundColor: isDark ? 'rgba(229,62,62,0.12)' : '#FEF2F2',
      justifyContent: 'center',
      alignItems: 'center',
    },

    /* Add people */
    addPeopleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: Spacing.lg,
      borderRadius: Radius.xl,
      borderWidth: 1.5,
      borderColor: c.primary,
      borderStyle: 'dashed',
      marginTop: Spacing.sm,
    },
    addPeopleText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 14,
      color: c.primary,
    },

    /* Danger zone */
    dangerLabel: {
      color: c.danger,
      marginTop: Spacing.xxl,
    },
    dangerActions: {
      gap: Spacing.sm,
    },
    dangerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: Spacing.lg,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(229,62,62,0.3)' : '#FECACA',
      backgroundColor: isDark ? 'rgba(229,62,62,0.06)' : '#FEF2F2',
    },
    dangerButtonText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 15,
      color: c.danger,
    },
  });
