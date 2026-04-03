import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth-context';
import { ActivityIndicator, View } from 'react-native';
import { Colors } from '../theme';

// Auth Screens
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';

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

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

export type MainTabParamList = {
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
  AddExpense: { groupId: string };
  ScanReceipt: { groupId: string };
  ParsedItems: { groupId: string; receiptData: any };
  AssignItems: { groupId: string; items: any[]; tax: number; serviceCharge: number };
  AddDaftarEntry: undefined;
  DaftarContact: { contactName: string };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E8E5E0',
          height: 68,
          paddingBottom: 10,
          paddingTop: 10,
          shadowColor: '#1E1B4B',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
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
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

function AppStack() {
  return (
    <RootStack.Navigator>
      <RootStack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <RootStack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <RootStack.Screen name="JoinGroup" component={JoinGroupScreen} />
      <RootStack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <RootStack.Screen name="GroupBalances" component={GroupBalancesScreen} />
      <RootStack.Screen name="AddExpense" component={AddExpenseScreen} />
      <RootStack.Screen name="ScanReceipt" component={ScanReceiptScreen} />
      <RootStack.Screen name="ParsedItems" component={ParsedItemsScreen} />
      <RootStack.Screen name="AssignItems" component={AssignItemsScreen} />
      <RootStack.Screen name="AddDaftarEntry" component={AddDaftarEntryScreen} />
      <RootStack.Screen name="DaftarContact" component={DaftarContactScreen} />
    </RootStack.Navigator>
  );
}

export default function AppNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? <AppStack /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
