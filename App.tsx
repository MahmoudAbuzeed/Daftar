import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { I18nManager, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Cormorant_500Medium,
  Cormorant_600SemiBold,
  Cormorant_700Bold,
} from '@expo-google-fonts/cormorant';
import {
  Tajawal_500Medium,
  Tajawal_700Bold,
  Tajawal_800ExtraBold,
} from '@expo-google-fonts/tajawal';
import { Ionicons } from '@expo/vector-icons';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { AuthProvider } from './src/lib/auth-context';
import { ThemeProvider, useAppTheme } from './src/lib/theme-context';
import AppNavigator from './src/navigation/AppNavigator';
import { AlertProvider } from './src/hooks/useAlert';
import { SubscriptionProvider } from './src/lib/subscription-context';
import { initPurchases } from './src/lib/purchases';
import './src/lib/i18n';
import i18n from './src/lib/i18n';
import { Colors } from './src/theme';
import { useAuth } from './src/lib/auth-context';
import { registerForPushNotifications } from './src/lib/notifications';
import { checkOnAppOpen, scheduleWeeklySummary, scheduleDailySettleNudge } from './src/lib/engagement';
import AnimatedSplashScreen from './src/components/AnimatedSplashScreen';

const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colors.primary,
    primaryContainer: Colors.primarySurface,
    secondary: Colors.accent,
    surface: Colors.bgCard,
    background: Colors.bg,
  },
};

function AppInner() {
  const { colors, ready } = useAppTheme();
  const { user } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Register for push notifications after user is authenticated
    if (user?.id) {
      registerForPushNotifications(user.id);
      // Check for engagement notifications on app open
      checkOnAppOpen(user.id);
      // Schedule recurring engagement notifications
      scheduleWeeklySummary(user.id);
      scheduleDailySettleNudge(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    // Set up listener for notification responses (when user taps a notification)
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const { data } = response.notification.request.content;
        // Handle navigation based on notification data
        if (data?.groupId) {
          // Navigate to group detail screen
          console.log('Notification tapped, navigate to group:', data.groupId);
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  if (!ready) {
    return (
      <View
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}
      >
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  if (showSplash) {
    return <AnimatedSplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <>
      <StatusBar style={colors.statusBarStyle === 'dark-content' ? 'dark' : 'light'} />
      <AppNavigator />
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Cormorant_500Medium,
    Cormorant_600SemiBold,
    Cormorant_700Bold,
    Tajawal_500Medium,
    Tajawal_700Bold,
    Tajawal_800ExtraBold,
    ...Ionicons.font,
  });

  useEffect(() => {
    initPurchases();
  }, []);

  useEffect(() => {
    const isRTL = i18n.language === 'ar';
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.forceRTL(isRTL);
    }
  }, []);

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
        }}
      >
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PaperProvider theme={paperTheme}>
          <AuthProvider>
            <SubscriptionProvider>
              <AlertProvider>
                <AppInner />
              </AlertProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </PaperProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
