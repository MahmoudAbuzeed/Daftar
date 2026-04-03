import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { I18nManager, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Cormorant_600SemiBold,
  Cormorant_700Bold,
} from '@expo-google-fonts/cormorant';
import {
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
} from '@expo-google-fonts/sora';
import { Ionicons } from '@expo/vector-icons';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { AuthProvider } from './src/lib/auth-context';
import { ThemeProvider, useAppTheme } from './src/lib/theme-context';
import AppNavigator from './src/navigation/AppNavigator';
import './src/lib/i18n';
import i18n from './src/lib/i18n';
import { Colors } from './src/theme';

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

  if (!ready) {
    return (
      <View
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F0E6' }}
      >
        <ActivityIndicator size="large" color="#0D9488" />
      </View>
    );
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
    Cormorant_600SemiBold,
    Cormorant_700Bold,
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    ...Ionicons.font,
  });

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
          backgroundColor: '#F5F0E6',
        }}
      >
        <ActivityIndicator size="large" color="#0D9488" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PaperProvider theme={paperTheme}>
          <AuthProvider>
            <AppInner />
          </AuthProvider>
        </PaperProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
