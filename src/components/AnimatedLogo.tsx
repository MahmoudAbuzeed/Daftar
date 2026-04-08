import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';

interface AnimatedLogoProps {
  /** Width and height of the logo container */
  size?: number;
  /** Whether the animation should loop */
  loop?: boolean;
  /** Whether the animation should autoplay */
  autoPlay?: boolean;
  /** Playback speed (1 = normal, 2 = double speed) */
  speed?: number;
  /** Additional container styles */
  style?: ViewStyle;
  /** Callback when animation finishes (if not looping) */
  onAnimationFinish?: () => void;
}

const AnimatedLogo: React.FC<AnimatedLogoProps> = ({
  size = 200,
  loop = true,
  autoPlay = true,
  speed = 1,
  style,
  onAnimationFinish,
}) => {
  const lottieRef = useRef<LottieView>(null);

  useEffect(() => {
    if (autoPlay && lottieRef.current) {
      lottieRef.current.play();
    }
  }, [autoPlay]);

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <LottieView
        ref={lottieRef}
        source={require('../../assets/animations/logo-animation.json')}
        style={{ width: size, height: size }}
        autoPlay={autoPlay}
        loop={loop}
        speed={speed}
        onAnimationFinish={onAnimationFinish}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AnimatedLogo;
