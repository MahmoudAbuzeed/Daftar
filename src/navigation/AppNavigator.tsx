import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../lib/auth-context';
import { useAppTheme } from '../lib/theme-context';
import { ActivityIndicator, View } from 'react-native';
import AnimatedTabBar from '../components/AnimatedTabBar';
import { FontFamily } from '../theme';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';

// Auth Screens
import PhoneEntryScreen from '../screens/auth/PhoneEntryScreen';
import OTPVerifyScreen from '../screens/auth/OTPVerifyScreen';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';

// Main Tab Screens
import GroupsListScreen from '../screens/groups/GroupsListScreen';
import PeopleScreen from '../screens/people/PeopleScreen';
import ActivityScreen from '../screens/activity/ActivityScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

// Group Screens
import CreateGroupScreen from '../screens/groups/CreateGroupScreen';
import GroupDetailScreen from '../screens/groups/GroupDetailScreen';
import GroupBalancesScreen from '../screens/groups/GroupBalancesScreen';
import AddExpenseScreen from '../screens/groups/AddExpenseScreen';
import JoinGroupScreen from '../screens/groups/JoinGroupScreen';
import GroupSettingsScreen from '../screens/groups/GroupSettingsScreen';

// Scanner Screens
import ScanReceiptScreen from '../screens/scanner/ScanReceiptScreen';
import ParsedItemsScreen from '../screens/scanner/ParsedItemsScreen';
// AssignItemsScreen merged into ParsedItemsScreen

// Ledger Screens
import AddLedgerEntryScreen from '../screens/ledger/AddLedgerEntryScreen';
import LedgerContactScreen from '../screens/ledger/LedgerContactScreen';

// Subscription
import PaywallScreen from '../screens/subscription/PaywallScreen';

// Shared Bill
import SharedBillScreen from '../screens/scanner/SharedBillScreen';

// Collection Summary
import CollectionSummaryScreen from '../screens/scanner/CollectionSummaryScreen';

// Quick Split
import QuickSplitScreen from '../screens/quicksplit/QuickSplitScreen';
import QuickSplitTrackScreen from '../screens/quicksplit/QuickSplitTrackScreen';

// Search & Friends
import SearchScreen from '../screens/search/SearchScreen';
import AddFriendsScreen from '../screens/friends/AddFriendsScreen';
import AnalyticsScreen from '../screens/analytics/AnalyticsScreen';
import RecurringExpensesScreen from '../screens/groups/RecurringExpensesScreen';
import AboutScreen from '../screens/legal/AboutScreen';
import PrivacyPolicyScreen from '../screens/legal/PrivacyPolicyScreen';
import TermsScreen from '../screens/legal/TermsScreen';

export type AuthStackParamList = {
  PhoneEntry: undefined;
  OTPVerify: { phone: string };
  ProfileSetup: undefined;
};

export type MainTabParamList = {
  GroupsTab: undefined;
  PeopleTab: undefined;
  ProfileTab: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  CreateGroup: undefined;
  JoinGroup: undefined;
  GroupDetail: { groupId: string };
  GroupBalances: { groupId: string };
  GroupSettings: { groupId: string };
  AddExpense: { groupId: string; prefillAmount?: number; prefillDescription?: string; prefillSplitType?: string; prefillCategory?: string };
  ScanReceipt: { groupId: string };
  ParsedItems: { groupId: string; receiptData: any };
  // AssignItems merged into ParsedItems
  AddLedgerEntry: undefined;
  LedgerContact: { contactName: string };
  Paywall: { trigger: string };
  SharedBill: { billId: string; groupId: string };
  CollectionSummary: { groupId: string; expenseId: string };
  QuickSplit: undefined;
  QuickSplitTrack: { quickSplitId: string };
  Search: undefined;
  AddFriends: undefined;
  Analytics: { groupId?: string };
  RecurringExpenses: { groupId: string };
  Activity: undefined;
  About: undefined;
  PrivacyPolicy: undefined;
  Terms: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="GroupsTab"
        component={GroupsListScreen}
        options={{ tabBarLabel: t('tabs.groups') }}
      />
      <Tab.Screen
        name="PeopleTab"
        component={PeopleScreen}
        options={{ tabBarLabel: t('tabs.people') }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ tabBarLabel: t('tabs.profile') }}
      />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  const { session, needsProfile } = useAuth();

  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade_from_bottom',
        animationDuration: 300,
      }}
    >
      {session && needsProfile ? (
        // User verified OTP but has no profile yet — go straight to setup
        <AuthStack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      ) : (
        <>
          <AuthStack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
          <AuthStack.Screen name="OTPVerify" component={OTPVerifyScreen} />
          <AuthStack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        </>
      )}
    </AuthStack.Navigator>
  );
}

function AppStack() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();

  return (
    <RootStack.Navigator
      screenOptions={{
        animation: 'slide_from_right',
        animationDuration: 280,
        gestureEnabled: true,
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.bg,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontFamily: FontFamily.bodySemibold,
          fontSize: 17,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <RootStack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{
          animation: 'slide_from_bottom',
          title: t('groups.create'),
          presentation: 'modal',
        }}
      />
      <RootStack.Screen
        name="JoinGroup"
        component={JoinGroupScreen}
        options={{
          animation: 'slide_from_bottom',
          title: t('groups.join'),
          presentation: 'modal',
        }}
      />
      <RootStack.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
        options={{
          title: '',
        }}
      />
      <RootStack.Screen
        name="GroupBalances"
        component={GroupBalancesScreen}
        options={{
          title: t('groups.balances'),
        }}
      />
      <RootStack.Screen
        name="GroupSettings"
        component={GroupSettingsScreen}
        options={{
          title: t('groups.settings'),
        }}
      />
      <RootStack.Screen
        name="AddExpense"
        component={AddExpenseScreen}
        options={{
          animation: 'slide_from_bottom',
          title: t('expenses.add'),
          presentation: 'modal',
        }}
      />
      <RootStack.Screen
        name="ScanReceipt"
        component={ScanReceiptScreen}
        options={{
          animation: 'slide_from_bottom',
          title: t('expenses.scan_receipt'),
          presentation: 'modal',
        }}
      />
      <RootStack.Screen
        name="ParsedItems"
        component={ParsedItemsScreen}
        options={{
          title: t('scanner.parsed_items'),
        }}
      />
      <RootStack.Screen
        name="AddLedgerEntry"
        component={AddLedgerEntryScreen}
        options={{
          animation: 'slide_from_bottom',
          title: t('ledger.addEntry'),
          presentation: 'modal',
        }}
      />
      <RootStack.Screen
        name="LedgerContact"
        component={LedgerContactScreen}
        options={{
          title: '',
        }}
      />
      <RootStack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{
          animation: 'slide_from_bottom',
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <RootStack.Screen
        name="SharedBill"
        component={SharedBillScreen}
        options={{
          title: t('shared_bill.title'),
        }}
      />
      <RootStack.Screen
        name="CollectionSummary"
        component={CollectionSummaryScreen}
        options={{
          title: t('collection.title'),
          headerBackVisible: false,
        }}
      />
      <RootStack.Screen
        name="QuickSplit"
        component={QuickSplitScreen}
        options={{
          animation: 'slide_from_bottom',
          title: t('quick_split.title'),
          presentation: 'modal',
        }}
      />
      <RootStack.Screen
        name="QuickSplitTrack"
        component={QuickSplitTrackScreen}
        options={{
          title: t('quick_split.trackTitle'),
          headerBackVisible: false,
        }}
      />
      <RootStack.Screen
        name="Search"
        component={SearchScreen}
        options={{
          animation: 'fade_from_bottom',
          headerShown: false,
          presentation: 'transparentModal',
        }}
      />
      <RootStack.Screen
        name="AddFriends"
        component={AddFriendsScreen}
        options={{
          animation: 'slide_from_bottom',
          headerShown: false,
        }}
      />
      <RootStack.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          title: t('analytics.title'),
        }}
      />
      <RootStack.Screen
        name="RecurringExpenses"
        component={RecurringExpensesScreen}
        options={{
          title: t('recurring.title'),
        }}
      />
      <RootStack.Screen
        name="Activity"
        component={ActivityScreen}
        options={{ title: t('tabs.activity') }}
      />
      <RootStack.Screen
        name="About"
        component={AboutScreen}
        options={{ title: t('legal.about') }}
      />
      <RootStack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{ title: t('legal.privacyPolicy') }}
      />
      <RootStack.Screen
        name="Terms"
        component={TermsScreen}
        options={{ title: t('legal.terms') }}
      />
    </RootStack.Navigator>
  );
}

export default function AppNavigator() {
  const { session, loading, needsProfile } = useAuth();
  const { colors } = useAppTheme();
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('@fifti/onboarded').then((val) => {
      setIsOnboarded(val === 'true');
    });
  }, []);

  if (loading || isOnboarded === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isOnboarded) {
    return <OnboardingScreen onComplete={() => setIsOnboarded(true)} />;
  }

  return (
    <NavigationContainer>
      {session && !needsProfile ? <AppStack /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
