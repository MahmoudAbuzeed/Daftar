import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth-context';
import { useAppTheme } from '../lib/theme-context';
import { ActivityIndicator, View } from 'react-native';
import AnimatedTabBar from '../components/AnimatedTabBar';
import { FontFamily } from '../theme';

// Auth Screens
import PhoneEntryScreen from '../screens/auth/PhoneEntryScreen';
import OTPVerifyScreen from '../screens/auth/OTPVerifyScreen';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';

// Main Tab Screens
import GroupsListScreen from '../screens/groups/GroupsListScreen';
import DaftarScreen from '../screens/daftar/DaftarScreen';
import ActivityScreen from '../screens/activity/ActivityScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

// Group Screens
import CreateGroupScreen from '../screens/groups/CreateGroupScreen';
import GroupDetailScreen from '../screens/groups/GroupDetailScreen';
import GroupBalancesScreen from '../screens/groups/GroupBalancesScreen';
import AddExpenseScreen from '../screens/groups/AddExpenseScreen';
import JoinGroupScreen from '../screens/groups/JoinGroupScreen';

// Scanner Screens
import ScanReceiptScreen from '../screens/scanner/ScanReceiptScreen';
import ParsedItemsScreen from '../screens/scanner/ParsedItemsScreen';
import AssignItemsScreen from '../screens/scanner/AssignItemsScreen';

// Daftar Screens
import AddDaftarEntryScreen from '../screens/daftar/AddDaftarEntryScreen';
import DaftarContactScreen from '../screens/daftar/DaftarContactScreen';

// Subscription
import PaywallScreen from '../screens/subscription/PaywallScreen';

// Shared Bill
import SharedBillScreen from '../screens/scanner/SharedBillScreen';

// Friends & Search
import FriendsScreen from '../screens/friends/FriendsScreen';
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
  FriendsTab: undefined;
  GroupsTab: undefined;
  DaftarTab: undefined;
  ActivityTab: undefined;
  ProfileTab: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  CreateGroup: undefined;
  JoinGroup: undefined;
  GroupDetail: { groupId: string };
  GroupBalances: { groupId: string };
  AddExpense: { groupId: string; prefillAmount?: number; prefillDescription?: string };
  ScanReceipt: { groupId: string };
  ParsedItems: { groupId: string; receiptData: any };
  AssignItems: { groupId: string; items: any[]; tax: number; serviceCharge: number };
  AddDaftarEntry: undefined;
  DaftarContact: { contactName: string };
  Paywall: { trigger: string };
  SharedBill: { billId: string; groupId: string };
  Search: undefined;
  AddFriends: undefined;
  Analytics: { groupId?: string };
  RecurringExpenses: { groupId: string };
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
        name="FriendsTab"
        component={FriendsScreen}
        options={{ tabBarLabel: t('tabs.friends') }}
      />
      <Tab.Screen
        name="GroupsTab"
        component={GroupsListScreen}
        options={{ tabBarLabel: t('tabs.groups') }}
      />
      <Tab.Screen
        name="DaftarTab"
        component={DaftarScreen}
        options={{ tabBarLabel: t('tabs.daftar') }}
      />
      <Tab.Screen
        name="ActivityTab"
        component={ActivityScreen}
        options={{ tabBarLabel: t('tabs.activity') }}
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
          title: '',
          headerShown: false,
        }}
      />
      <RootStack.Screen
        name="JoinGroup"
        component={JoinGroupScreen}
        options={{
          animation: 'slide_from_bottom',
          title: t('groups.join'),
          headerShown: false,
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
        name="AddExpense"
        component={AddExpenseScreen}
        options={{
          animation: 'slide_from_bottom',
          title: '',
          headerShown: false,
        }}
      />
      <RootStack.Screen
        name="ScanReceipt"
        component={ScanReceiptScreen}
        options={{
          animation: 'slide_from_bottom',
          title: '',
          headerShown: false,
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
        name="AssignItems"
        component={AssignItemsScreen}
        options={{
          title: t('scanner.assign_items'),
        }}
      />
      <RootStack.Screen
        name="AddDaftarEntry"
        component={AddDaftarEntryScreen}
        options={{
          animation: 'slide_from_bottom',
          title: '',
          headerShown: false,
        }}
      />
      <RootStack.Screen
        name="DaftarContact"
        component={DaftarContactScreen}
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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session && !needsProfile ? <AppStack /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
