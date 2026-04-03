import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

interface Props {
  children: React.ReactNode;
  index: number;
  delay?: number;
}

export default function AnimatedListItem({ children, index, delay = 60 }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 450,
      delay: Math.min(index * delay, 400),
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [28, 0],
            }),
          },
          {
            scale: anim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.95, 1.02, 1],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
