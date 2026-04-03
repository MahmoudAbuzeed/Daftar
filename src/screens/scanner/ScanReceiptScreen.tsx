import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ParsedReceipt } from '../../types/database';
import { Spacing, Radius, FontFamily } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanReceipt'>;
const { width: SW } = Dimensions.get('window');

export default function ScanReceiptScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { groupId } = route.params;
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const entrance = useRef(new Animated.Value(0)).current;
  const iconPulse = useRef(new Animated.Value(1)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulse, { toValue: 1.08, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(iconPulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(scanLineAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ).start();
    }
  }, [loading]);

  const pickImage = async (useCamera: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const permissionResult = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(t('scanner.permissionRequired'), t('scanner.permissionMessage'));
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, base64: true });

    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
      await processReceipt(result.assets[0].base64!, result.assets[0].uri);
    }
  };

  const parseReceiptWithOpenAI = async (base64: string): Promise<ParsedReceipt> => {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) throw new Error(t('scanner.apiKeyMissing'));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `You are an expert receipt OCR parser for Daftar, an Egyptian bill-splitting app.
Your job is to extract EVERY line item from a receipt image with maximum accuracy.

CRITICAL RULES:
1. Read the receipt character by character. Do NOT guess or hallucinate items or prices.
2. Item names MUST be exactly as printed on the receipt (Arabic or English). Keep the original language.
3. quantity defaults to 1 if not explicitly shown. unit_price = total / quantity.
4. If an item shows "2x", "x2", "×2", "٢×", or a qty column, set quantity accordingly.
5. Currency is EGP unless you see "$", "USD", "€", or "EUR" printed on the receipt.
6. Tax lines: look for "ضريبة", "Tax", "VAT", "ض.ق.م", "ضريبه", "14%" → put in "tax" field.
7. Service charge lines: look for "خدمة", "Service", "Svc", "سرفيس", "سيرفيس", "12%" → put in "service_charge" field.
8. Discount lines: look for "خصم", "Discount", "Disc" → subtract from subtotal, do NOT include as item.
9. Do NOT include tax, service charge, subtotal, total, or discount as items — they go in their own fields.
10. "total" = subtotal + tax + service_charge - discount. Cross-check with the receipt total.
11. If the receipt has Arabic text, read right-to-left. Numbers are always left-to-right.
12. If prices use Arabic numerals (٠١٢٣٤٥٦٧٨٩), convert them to standard digits.
13. Watch out for dot vs comma as decimal separator. "12,50" means 12.50.
14. If receipt is blurry, extract only what you can read confidently. Never invent data.

JSON schema (return ONLY valid JSON, no markdown, no extra text):
{
  "items": [{"name": "string", "quantity": number, "unit_price": number, "total": number}],
  "subtotal": number,
  "tax": number,
  "service_charge": number,
  "total": number,
  "currency": "EGP" | "USD",
  "merchant_name": "string or null"
}`,
          },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'high' } },
              { type: 'text', text: 'Parse this receipt image. Read every line carefully and extract all food/drink items with exact names and prices as printed. Be extremely precise with numbers.' },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenAI API error (${response.status})`);
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    if (!parsed.items) parsed.items = [];
    if (!parsed.tax) parsed.tax = 0;
    if (!parsed.service_charge) parsed.service_charge = 0;
    if (!parsed.currency) parsed.currency = 'EGP';
    parsed.subtotal = parsed.items.reduce((s: number, i: any) => s + (i.total || i.unit_price * i.quantity), 0);
    if (!parsed.total) parsed.total = parsed.subtotal + parsed.tax + parsed.service_charge;

    return parsed as ParsedReceipt;
  };

  const processReceipt = async (base64: string, _uri: string) => {
    setLoading(true);
    try {
      const fileName = `receipts/${Date.now()}.jpg`;
      supabase.storage
        .from('receipts')
        .upload(fileName, decode(base64), { contentType: 'image/jpeg' })
        .then(({ error: uploadError }) => {
          if (uploadError) console.warn('Upload error (non-blocking):', uploadError.message);
        });

      let receiptData: ParsedReceipt;

      try {
        const { data, error } = await supabase.functions.invoke('scan-receipt', {
          body: { image: base64 },
        });
        if (error) throw error;
        receiptData = data;
      } catch {
        receiptData = await parseReceiptWithOpenAI(base64);
      }

      if (!receiptData.items || receiptData.items.length === 0) {
        Alert.alert(t('scanner.no_items'));
        setImage(null);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace('ParsedItems', {
        groupId,
        receiptData: { ...receiptData, receiptImage: fileName },
      });
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
          <Animated.View style={{
            transform: [{
              translateY: scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [-80, 80] }),
            }],
          }}>
            <LinearGradient
              colors={['transparent', `${colors.primaryLight}88`, 'transparent']}
              style={styles.scanLine}
            />
          </Animated.View>
          <View style={styles.loadingBadge}>
            <ActivityIndicator size="small" color={colors.primaryLight} />
            <Text style={styles.loadingText}>{t('scanner.scanning')}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {isDark && (
        <LinearGradient colors={colors.headerGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} />
      )}

      <Animated.View style={[styles.content, {
        opacity: entrance,
        transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
      }]}>
        <Animated.View style={[styles.iconWrapper, { transform: [{ scale: iconPulse }] }]}>
          <LinearGradient
            colors={isDark ? ['rgba(27,122,108,0.2)', 'rgba(20,184,166,0.08)'] : ['rgba(13,148,136,0.12)', 'rgba(13,148,136,0.04)']}
            style={styles.iconCircleOuter}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <LinearGradient
            colors={colors.primaryGradient}
            style={styles.iconCircleInner}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="scan-outline" size={40} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>

        <Text style={styles.title}>{t('scanner.title')}</Text>
        <Text style={styles.subtitle}>{t('scanner.edit_items')}</Text>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() => pickImage(true)}
          >
            <LinearGradient
              colors={colors.primaryGradient}
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0.5 }}
            >
              <Ionicons name="camera-outline" size={22} color="#FFFFFF" style={{ marginRight: 10 }} />
              <Text style={styles.primaryButtonText}>{t('scanner.take_photo')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.85}
            onPress={() => pickImage(false)}
          >
            <Ionicons name="images-outline" size={22} color={isDark ? colors.primaryLight : colors.primary} style={{ marginRight: 10 }} />
            <Text style={styles.secondaryButtonText}>{t('scanner.choose_photo')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hintRow}>
          <Ionicons name="bulb-outline" size={14} color={colors.accent} />
          <Text style={styles.hintText}>{t('scanner.tip')}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

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

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
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
      borderRadius: 44,
    },
    iconCircleInner: {
      width: 88,
      height: 88,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 12,
    },

    title: {
      fontFamily: FontFamily.display,
      fontSize: 28,
      color: c.text,
      letterSpacing: -0.5,
      textAlign: 'center',
      marginBottom: Spacing.sm,
    },
    subtitle: {
      fontFamily: FontFamily.body,
      fontSize: 15,
      color: c.textTertiary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: Spacing.xxxl,
    },

    buttonsContainer: { width: '100%', gap: Spacing.md },
    primaryButton: { borderRadius: Radius.lg, overflow: 'hidden' },
    btnGradient: {
      flexDirection: 'row',
      paddingVertical: 17,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.lg,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 10,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontFamily: FontFamily.bodyBold,
      fontSize: 17,
      letterSpacing: 0.3,
    },
    secondaryButton: {
      flexDirection: 'row',
      backgroundColor: isDark ? 'rgba(27,122,108,0.12)' : '#E6FAF7',
      borderRadius: Radius.lg,
      paddingVertical: 17,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(27,122,108,0.25)' : 'rgba(13,148,136,0.2)',
    },
    secondaryButtonText: {
      color: isDark ? c.primaryLight : c.primary,
      fontFamily: FontFamily.bodyBold,
      fontSize: 17,
      letterSpacing: 0.3,
    },

    hintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: Spacing.xxl,
      paddingHorizontal: Spacing.lg,
    },
    hintText: {
      fontFamily: FontFamily.body,
      fontSize: 12,
      color: c.textTertiary,
      fontStyle: 'italic',
    },

    loadingContainer: { flex: 1, backgroundColor: isDark ? '#040D0B' : '#0A1210' },
    previewImage: { flex: 1, resizeMode: 'contain' },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(10,18,16,0.75)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    scanLine: { width: SW * 0.7, height: 3, borderRadius: 2 },
    loadingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: Radius.full,
      marginTop: Spacing.xxl,
    },
    loadingText: {
      color: '#F4F0E8',
      fontFamily: FontFamily.bodySemibold,
      fontSize: 16,
    },
  });
