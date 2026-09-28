import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks';
import { ImageGenerationPlaceholder } from './ImageGenerationPlaceholder';
import { VideoGenerationPlaceholder } from './VideoGenerationPlaceholder';
import type { UiArtifactItem } from './types';

/**
 * Real, dedicated artifact gallery. Ports web's ArtifactPanel.tsx concept
 * (not code) to React Native as a full-screen modal -- web itself falls
 * back to a full-screen overlay on narrow viewports ("there is no room for
 * both" a side panel and chat), which is the only real layout mobile ever
 * has, so a modal is the direct, correct equivalent here, not a compromise.
 */
type ArtifactPanelProps = {
  visible: boolean;
  artifacts: UiArtifactItem[];
  onClose: () => void;
  onDownload: (artifact: UiArtifactItem) => void;
  onDelete: (artifact: UiArtifactItem) => Promise<void>;
  // Real parity port of web's handleSelectArtifact (ChatShell.tsx:651-668):
  // on the dedicated Edit Image / Image-to-Video screens, tapping an
  // artifact sets it as the active composerMediaReference (the source image
  // for the next edit/animate request). Only passed on those screens.
  onSelect?: (artifact: UiArtifactItem) => void;
};

const ArtifactVideoView = ({ uri }: { uri: string }) => {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });
  return (
    <VideoView
      style={{ width: '100%', height: 260, borderRadius: 12 }}
      player={player}
      nativeControls
      contentFit="contain"
    />
  );
};

const BeforeAfterSlider = ({ beforeUrl, afterUrl }: { beforeUrl: string; afterUrl: string }) => {
  const [split, setSplit] = useState(50);
  return (
    <View style={{ width: '100%' }}>
      <View style={styles.compareFrame}>
        <ExpoImage source={{ uri: afterUrl }} style={StyleSheet.absoluteFillObject} contentFit="contain" />
        <View style={[StyleSheet.absoluteFillObject, { width: `${split}%`, overflow: 'hidden' }]}>
          <ExpoImage
            source={{ uri: beforeUrl }}
            style={[StyleSheet.absoluteFillObject, { width: undefined }]}
            contentFit="contain"
          />
        </View>
        <View style={[styles.compareDivider, { left: `${split}%` }]} />
      </View>
      <Slider
        style={{ width: '100%', marginTop: 8 }}
        minimumValue={0}
        maximumValue={100}
        value={split}
        onValueChange={setSplit}
        minimumTrackTintColor="#7C3AED"
        maximumTrackTintColor="#7C3AED"
      />
      <View className="flex-row justify-between">
        <Text style={styles.compareLabel}>Original</Text>
        <Text style={styles.compareLabel}>Edited</Text>
      </View>
    </View>
  );
};

export function ArtifactPanel({ visible, artifacts, onClose, onDownload, onDelete, onSelect }: ArtifactPanelProps) {
  const { colors, isDark } = useAppTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [deleting, setDeleting] = useState(false);

  const selected = artifacts.find((a) => a.id === selectedId) ?? artifacts[artifacts.length - 1] ?? null;
  const mutedText = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)';
  const cardBorder = isDark ? '#2A2A31' : '#D4D4DC';

  const confirmDelete = (artifact: UiArtifactItem) => {
    Alert.alert('Delete this?', 'This permanently removes the generated file.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await onDelete(artifact);
            setSelectedId(null);
          } catch (error) {
            Alert.alert('Could not delete', error instanceof Error ? error.message : 'Please try again.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: isDark ? '#0B0B0D' : '#FFFFFF' }}>
        <View style={[styles.header, { borderBottomColor: cardBorder }]}>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>Artifacts</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close artifacts panel">
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>

        {artifacts.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ color: mutedText, fontSize: 13, textAlign: 'center' }}>
              Generated images, videos, and documents will appear here.
            </Text>
          </View>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              {selected ? (
                <View style={{ flex: 1 }}>
                  {selected.generating ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      {selected.kind === 'video' ? (
                        <VideoGenerationPlaceholder isDark={isDark} accentColor="#7C3AED" width={280} height={280} timingNote="This can take a minute or two." />
                      ) : (
                        <ImageGenerationPlaceholder isDark={isDark} accentColor="#7C3AED" width={280} height={280} />
                      )}
                    </View>
                  ) : selected.failed ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                      <Text style={{ color: mutedText, fontSize: 13, textAlign: 'center' }}>
                        This didn&rsquo;t generate successfully.
                      </Text>
                    </View>
                  ) : !selected.url ? null : selected.kind === 'image' ? (
                    <View style={{ flex: 1 }}>
                      <View style={[styles.toolbar, { borderBottomColor: cardBorder }]}>
                        <Pressable
                          onPress={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                          disabled={zoom <= 0.5}
                          style={[styles.toolbarButton, { borderColor: cardBorder, opacity: zoom <= 0.5 ? 0.35 : 1 }]}
                        >
                          <Ionicons name="remove" size={16} color={colors.textPrimary} />
                        </Pressable>
                        <Text style={{ color: colors.textPrimary, fontSize: 12, width: 44, textAlign: 'center' }}>
                          {Math.round(zoom * 100)}%
                        </Text>
                        <Pressable
                          onPress={() => setZoom((z) => Math.min(3, z + 0.25))}
                          disabled={zoom >= 3}
                          style={[styles.toolbarButton, { borderColor: cardBorder, opacity: zoom >= 3 ? 0.35 : 1 }]}
                        >
                          <Ionicons name="add" size={16} color={colors.textPrimary} />
                        </Pressable>
                        {onSelect ? (
                          <Pressable
                            onPress={() => onSelect(selected)}
                            style={[styles.toolbarButton, { borderColor: cardBorder, marginLeft: 'auto' }]}
                          >
                            <Ionicons name="checkmark-circle-outline" size={16} color="#7C3AED" />
                          </Pressable>
                        ) : null}
                        <Pressable
                          onPress={() => onDownload(selected)}
                          style={[styles.toolbarButton, { borderColor: cardBorder, marginLeft: onSelect ? 0 : 'auto' }]}
                        >
                          <Ionicons name="download-outline" size={16} color={colors.textPrimary} />
                        </Pressable>
                        <Pressable
                          onPress={() => confirmDelete(selected)}
                          disabled={deleting}
                          style={[styles.toolbarButton, { borderColor: cardBorder }]}
                        >
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </Pressable>
                      </View>
                      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                        {selected.sourceUrl && selected.sourceUrl !== selected.url ? (
                          <BeforeAfterSlider beforeUrl={selected.sourceUrl} afterUrl={selected.url} />
                        ) : (
                          <ExpoImage
                            source={{ uri: selected.url }}
                            style={{ width: 300 * zoom, height: 300 * zoom }}
                            contentFit="contain"
                          />
                        )}
                        {selected.sourceUrl ? (
                          <Text style={{ color: mutedText, fontSize: 11, textAlign: 'center', marginTop: 8, maxWidth: 260 }}>
                            Your original image is never changed. Each edit creates a new, separate result you can delete on its own.
                          </Text>
                        ) : null}
                      </ScrollView>
                    </View>
                  ) : selected.kind === 'video' ? (
                    <View style={{ flex: 1 }}>
                      <View style={[styles.toolbar, { borderBottomColor: cardBorder, justifyContent: 'flex-end' }]}>
                        <Pressable onPress={() => onDownload(selected)} style={[styles.toolbarButton, { borderColor: cardBorder }]}>
                          <Ionicons name="download-outline" size={16} color={colors.textPrimary} />
                        </Pressable>
                        <Pressable
                          onPress={() => confirmDelete(selected)}
                          disabled={deleting}
                          style={[styles.toolbarButton, { borderColor: cardBorder }]}
                        >
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </Pressable>
                      </View>
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                        <ArtifactVideoView uri={selected.url} />
                        <Text style={{ color: mutedText, fontSize: 11, textAlign: 'center', marginTop: 12, maxWidth: 280 }}>
                          This screen can only animate a new image into a brand-new video — it can&rsquo;t edit or add to a video that already exists.
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
                      <Ionicons name="document-text-outline" size={40} color={mutedText} />
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
                        {selected.name || 'Generated file'}
                      </Text>
                      <Pressable
                        onPress={() => onDownload(selected)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}
                      >
                        <Ionicons name="download-outline" size={16} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>Download</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ) : null}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.thumbStrip, { borderTopColor: cardBorder }]}>
              {artifacts.map((artifact) => (
                <Pressable
                  key={artifact.id}
                  onPress={() => {
                    setSelectedId(artifact.id);
                    setZoom(1);
                  }}
                  style={[
                    styles.thumb,
                    { borderColor: artifact.id === selected?.id ? '#7C3AED' : 'transparent' },
                  ]}
                >
                  {artifact.generating ? (
                    <View style={[styles.thumbFallback, { backgroundColor: 'rgba(124,58,237,0.12)' }]}>
                      <Ionicons name="hourglass-outline" size={18} color="#7C3AED" />
                    </View>
                  ) : artifact.kind === 'image' && artifact.url ? (
                    <ExpoImage source={{ uri: artifact.url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  ) : artifact.kind === 'video' && artifact.url ? (
                    <View style={[styles.thumbFallback, { backgroundColor: isDark ? '#1A1A1E' : '#EEE' }]}>
                      <Ionicons name="videocam-outline" size={18} color={mutedText} />
                    </View>
                  ) : (
                    <View style={[styles.thumbFallback, { backgroundColor: isDark ? '#1A1A1E' : '#EEE' }]}>
                      <Ionicons name="document-outline" size={18} color={mutedText} />
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: 4,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbStrip: {
    maxHeight: 74,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 10,
  },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: 10,
    borderWidth: 2,
    overflow: 'hidden',
    marginRight: 10,
  },
  thumbFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  compareDivider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#FFFFFF',
  },
  compareLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    opacity: 0.6,
    color: '#888',
  },
});

export default ArtifactPanel;
