import { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';

export default function useScreenEntrance(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        useNativeDriver: true,
        damping: 18,
        stiffness: 160,
        mass: 0.8,
      }),
    ]).start();
  }, []);

  return {
    opacity,
    translateY,
    style: {
      opacity,
      transform: [{ translateY }],
    },
  };
}
