import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';

type FilterTab = 'all' | 'expenses' | 'settlements' | 'joined';

interface ActivityItem {
  id: string;
  type: 'expense' | 'settlement' | 'joined';
  title: string;
  groupName: string;
  subtitle: string;
  timeAgo: string;
  amount?: string;
  icon: string;
}

const ActivityScreenRedesign = () => {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const scrollViewRef = useRef<ScrollView>(null);

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'settlements', label: 'Settlements' },
    { id: 'joined', label: 'Joined' },
  ];

  const activityItems: ActivityItem[] = [
    {
      id: '1',
      type: 'expense',
      title: 'Help',
      groupName: 'Sally\'s Group',
      subtitle: 'Paid by Abuzeed',
      timeAgo: '1d ago',
      amount: '33.00 EGP',
      icon: '📋',
    },
    {
      id: '2',
      type: 'joined',
      title: 'Abuzeed joined',
      groupName: 'Sally\'s Group',
      subtitle: 'Group',
      timeAgo: '1d ago',
      icon: '👤',
    },
  ];

  const filteredItems = activeTab === 'all'
    ? activityItems
    : activityItems.filter(item => item.type === activeTab);

  return (
    <ScrollView ref={scrollViewRef} style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.subtitle}>Recent transactions</Text>
      </View>

      {/* Compact Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          contentContainerStyle={styles.tabsContent}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={styles.tabButton}
            >
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === tab.id && styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
              {activeTab === tab.id && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Activity Items */}
      <View style={styles.itemsContainer}>
        {filteredItems.map((item) => (
          <View key={item.id} style={styles.activityCard}>
            <View style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <Text style={styles.itemIcon}>{item.icon}</Text>
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <View style={styles.itemMetaRow}>
                  <Text style={styles.itemMeta}>
                    <Text style={styles.groupBadge}>👥 {item.groupName}</Text>
                    {' '}· {item.timeAgo}
                  </Text>
                </View>
                <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
              </View>
              {item.amount && (
                <View style={styles.amountContainer}>
                  <Text style={styles.amount}>{item.amount}</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>

      {filteredItems.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No {activeTab === 'all' ? 'activity' : activeTab} yet</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },

  // Header
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  // Compact Filter Tabs
  filterContainer: {
    paddingHorizontal: 0,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 0,
  },
  tabButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginRight: 8,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: '#1F7C4C',
    fontWeight: '600',
  },
  tabIndicator: {
    height: 2,
    backgroundColor: '#1F7C4C',
    borderRadius: 1,
    marginTop: 8,
    width: 'auto',
  },

  // Activity Items Container
  itemsContainer: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 32,
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  itemIcon: {
    fontSize: 20,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  itemMetaRow: {
    marginBottom: 2,
  },
  itemMeta: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  groupBadge: {
    color: '#1F7C4C',
    fontWeight: '500',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '400',
    marginTop: 2,
  },
  amountContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 4,
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F7C4C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    overflow: 'hidden',
  },

  // Empty State
  emptyState: {
    paddingVertical: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});

export default ActivityScreenRedesign;
