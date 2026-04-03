import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ParsedReceipt } from '../../types/database';
import { Colors, Gradients, Spacing, Radius, Typography, Shadows, CommonStyles } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanReceipt'>;

export default function ScanReceiptScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { groupId } = route.params;
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async (useCamera: boolean) => {
    const permissionResult = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Please grant camera/photo access.');
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          base64: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          base64: true,
        });

    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
      await processReceipt(result.assets[0].base64!, result.assets[0].uri);
    }
  };

  const processReceipt = async (base64: string, uri: string) => {
    setLoading(true);
    try {
      // Upload image to Supabase Storage
      const fileName = `receipts/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, decode(base64), {
          contentType: 'image/jpeg',
        });

      if (uploadError) {
        console.warn('Upload error (non-blocking):', uploadError.message);
      }

      // Call Edge Function to parse receipt with AI
      const { data, error } = await supabase.functions.invoke('scan-receipt', {
        body: { image: base64 },
      });

      if (error) throw error;

      const receiptData: ParsedReceipt = data;

      if (!receiptData.items || receiptData.items.length === 0) {
        Alert.alert(t('scanner.no_items'));
        setImage(null);
        return;
      }

      navigation.replace('ParsedItems', {
        groupId,
        receiptData: { ...receiptData, receiptImage: fileName },
      });
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
      setImage(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        {image && <Image source={{ uri: image }} style={styles.previewImage} />}
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.textOnDark} />
          <Text style={styles.loadingText}>{t('scanner.scanning')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Large gradient circle behind icon */}
        <View style={styles.iconWrapper}>
          <LinearGradient
            colors={[...Gradients.hero]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconCircleOuter}
          />
          <View style={styles.iconCircleInner}>
            <Text style={styles.icon}>📄</Text>
          </View>
        </View>

        <Text style={styles.title}>{t('scanner.title')}</Text>
        <Text style={styles.subtitle}>{t('scanner.edit_items')}</Text>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.8}
            onPress={() => pickImage(true)}
          >
            <Text style={styles.primaryButtonText}>{t('scanner.take_photo')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.8}
            onPress={() => pickImage(false)}
          >
            <Text style={styles.secondaryButtonText}>{t('scanner.choose_photo')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// Helper to decode base64 to Uint8Array for Supabase upload
function decode(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bufferLength = base64.length * 0.75;
  const bytes = new Uint8Array(bufferLength);
  let p = 0;

  for (let i = 0; i < base64.length; i += 4) {
    const a = chars.indexOf(base64[i]);
    const b = chars.indexOf(base64[i + 1]);
    const c = chars.indexOf(base64[i + 2]);
    const d = chars.indexOf(base64[i + 3]);

    bytes[p++] = (a << 2) | (b >> 4);
    bytes[p++] = ((b & 15) << 4) | (c >> 2);
    bytes[p++] = ((c & 3) << 6) | d;
  }

  return bytes;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  iconWrapper: {
    width: 140,
    height: 140,
    marginBottom: Spacing.xxxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleOuter: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.15,
  },
  iconCircleInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    ...Typography.screenTitle,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.huge,
  },
  buttonsContainer: {
    width: '100%',
    gap: Spacing.md,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    ...Shadows.glow,
  },
  primaryButtonText: {
    color: Colors.textOnPrimary,
    ...Typography.button,
  },
  secondaryButton: {
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.primary,
    ...Typography.button,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.bgDark,
  },
  previewImage: {
    flex: 1,
    resizeMode: 'contain',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textOnDark,
    fontSize: 18,
    fontWeight: '600',
    marginTop: Spacing.lg,
  },
});
