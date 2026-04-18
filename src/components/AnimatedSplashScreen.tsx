import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, StatusBar, I18nManager } from 'react-native';
import LottieView from 'lottie-react-native';
import { useTranslation } from 'react-i18next';
import { FontFamily } from '../theme';
import { displayFor } from '../theme/fonts';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
  /** Callback when splash animation completes */
  onFinish?: () => void;
  /** Duration to show splash in milliseconds (default: 4000ms = animation length) */
  duration?: number;
  /** Minimum time to show splash even if app loads faster */
  minimumDuration?: number;
}

const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({
  onFinish,
  duration = 4000,
  minimumDuration = 2500,
}) => {
  const lottieRef = useRef<LottieView>(null);
  const [isVisible, setIsVisible] = useState(true);
  const startTime = useRef(Date.now());
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (lottieRef.current) {
      lottieRef.current.play();
    }
  }, []);

  const handleAnimationFinish = () => {
    const elapsed = Date.now() - startTime.current;
    const remaining = Math.max(0, minimumDuration - elapsed);

    setTimeout(() => {
      setIsVisible(false);
      onFinish?.();
    }, remaining);
  };

  if (!isVisible) return null;

  const direction = I18nManager.isRTL ? 'rtl' : 'ltr';
  const titleFont = displayFor(i18n.language, 'bold');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Lottie animation layer */}
      <LottieView
        ref={lottieRef}
        source={require('../../assets/animations/splash-animation.json')}
        style={styles.animation}
        autoPlay
        loop={false}
        speed={1}
        onAnimationFinish={handleAnimationFinish}
        resizeMode="cover"
      />

      {/* Text overlay - rendered on top of the Lottie placeholder shapes */}
      <View style={styles.textOverlay}>
        <Text style={[styles.appName, { fontFamily: titleFont, writingDirection: direction }]}>
          {t('app_name')}
        </Text>
        <Text style={[styles.tagline, { writingDirection: direction }]}>
          {t('auth.taglineShort')}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  animation: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  textOverlay: {
    position: 'absolute',
    alignItems: 'center',
    // Position to overlap with the text placeholder in the Lottie animation
    top: SCREEN_HEIGHT * 0.47,
  },
  appName: {
    fontSize: 44,
    color: '#0D0D14',
    letterSpacing: -0.6,
    lineHeight: 48,
  },
  tagline: {
    fontFamily: FontFamily.bodySemibold,
    fontSize: 12,
    color: '#1DB954',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 8,
  },
});

export default AnimatedSplashScreen;
