import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

import { useI18n } from '@/hooks';

import { StudioIcon } from './StudioIcon';

const MIN = 50;
const MAX = 300;
const STEP = 25;

type Props = { uri: string | null; title: string; onClose: () => void };

/** Full-screen image viewer: zoom 50% to 300% in 25% steps with zoom out / reset / zoom in / close. */
export function StudioImageViewer({ uri, title, onClose }: Props) {
  const { t } = useI18n();
  const { width, height } = useWindowDimensions();
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (uri) setZoom(100);
  }, [uri]);

  const button = (label: string, onPress: () => void, glyph: 'zoom-out' | 'rotate-ccw' | 'zoom-in' | 'x', black = false) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: black ? '#FFFFFF' : 'rgba(255,255,255,0.14)',
      }}
    >
      <StudioIcon name={glyph} size={20} color={black ? '#000000' : '#FFFFFF'} />
    </Pressable>
  );

  return (
    <Modal visible={uri !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 48, paddingHorizontal: 16, paddingBottom: 8 }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
              {title}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{`${zoom}%`}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {button(t('studio.viewer.zoomOut'), () => setZoom((z) => Math.max(MIN, z - STEP)), 'zoom-out')}
            {button(t('studio.viewer.reset'), () => setZoom(100), 'rotate-ccw')}
            {button(t('studio.viewer.zoomIn'), () => setZoom((z) => Math.min(MAX, z + STEP)), 'zoom-in')}
            {button(t('studio.viewer.close'), onClose, 'x', true)}
          </View>
        </View>
        <ScrollView horizontal contentContainerStyle={{ alignItems: 'center' }} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ alignItems: 'center', justifyContent: 'center', minHeight: height - 120 }}>
            {uri ? (
              <ExpoImage
                source={{ uri }}
                contentFit="contain"
                style={{ width: (width * zoom) / 100, height: ((height - 140) * zoom) / 100 }}
              />
            ) : null}
          </ScrollView>
        </ScrollView>
      </View>
    </Modal>
  );
}
