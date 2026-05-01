import { useEffect } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Image as ExpoImage } from 'expo-image';

import { useAppTheme } from '@/hooks';

type ImageLightboxProps = {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
  accessibilityLabel: string;
};

const MAX_SCALE = 4;
const MIN_SCALE = 1;

const AnimatedView = Animated.createAnimatedComponent(View);

export function ImageLightbox({ visible, uri, onClose, accessibilityLabel }: ImageLightboxProps) {
  const { colors } = useAppTheme();
  const { width, height } = Dimensions.get('window');
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      scale.value = 1;
      savedScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  }, [visible, savedScale, savedTranslateX, savedTranslateY, scale, translateX, translateY]);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      const next = savedScale.value * event.scale;
      scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (savedScale.value <= 1) {
        savedScale.value = 1;
        scale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value <= 1) return;
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const zoomingIn = scale.value <= 1.05;
      scale.value = zoomingIn ? 2 : 1;
      savedScale.value = scale.value;
      if (!zoomingIn) {
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close image preview" />
        <GestureDetector gesture={gesture}>
          <AnimatedView style={[styles.imageContainer, { width, height: Math.round(height * 0.82) }, imageStyle]}>
            {uri ? (
              <ExpoImage
                source={{ uri }}
                style={styles.image}
                contentFit="contain"
                accessibilityLabel={accessibilityLabel}
              />
            ) : null}
          </AnimatedView>
        </GestureDetector>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close image preview"
          style={[styles.closeButton, { backgroundColor: `${colors.surface}CC` }]}
        >
          <Ionicons name="close" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
