import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  onOpenDocument: (artifact: UiArtifactItem) => void;
  onDelete: (artifact: UiArtifactItem) => Promise<void>;
  // Real parity port of web's handleSelectArtifact (ChatShell.tsx:651-668):
  // on the dedicated Edit Image / Image-to-Video screens, tapping an
  // artifact sets it as the active composerMediaReference (the source image
  // for the next edit/animate request). Only passed on those screens.
  onSelect?: (artifact: UiArtifactItem) => void;
};

function documentIcon(artifact: UiArtifactItem): keyof typeof Ionicons.glyphMap {
  const value = `${artifact.name ?? ''} ${artifact.mimeType ?? ''} ${artifact.url ?? ''}`.toLowerCase();
  if (value.includes('.pdf') || value.includes('application/pdf')) return 'document-attach-outline';
  if (
    value.includes('.doc')
    || value.includes('msword')
    || value.includes('wordprocessingml')
  ) return 'document-text-outline';
  return 'document-outline';
}

function artifactDisplayName(artifact: UiArtifactItem) {
  const explicitName = artifact.name?.trim();
  if (explicitName) return explicitName;

  if (artifact.url) {
    try {
      const pathName = artifact.url.split(/[?#]/, 1)[0];
      const fileName = decodeURIComponent(pathName.split('/').pop() ?? '').trim();
      if (fileName && /\.[a-z0-9]{2,8}$/i.test(fileName)) return fileName;
    } catch {
      // Fall through to a friendly type-based label for malformed URLs.
    }
  }

  const value = `${artifact.mimeType ?? ''} ${artifact.url ?? ''}`.toLowerCase();
  if (value.includes('pdf')) return 'Generated PDF';
  if (value.includes('docx') || value.includes('wordprocessingml')) return 'Generated DOCX';
  if (value.includes('.doc') || value.includes('msword')) return 'Generated DOC';
  return artifact.kind === 'document' ? 'Generated document' : `Generated ${artifact.kind}`;
}

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

export function ArtifactPanel({ visible, artifacts, onClose, onDownload, onOpenDocument, onDelete, onSelect }: ArtifactPanelProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [deleting, setDeleting] = useState(false);
  const [failedPreviews, setFailedPreviews] = useState<Record<string, boolean>>({});

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
        <View
          style={[
            styles.header,
            {
              minHeight: 56 + insets.top,
              paddingTop: insets.top,
              borderBottomColor: cardBorder,
            },
          ]}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>Artifacts</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close artifacts panel"
            hitSlop={10}
            style={styles.closeButton}
          >
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
                  ) : selected.kind === 'document' ? (
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
                      <Pressable
                        onPress={() => onOpenDocument(selected)}
                        disabled={!selected.url}
                        accessibilityRole="link"
                        accessibilityLabel={`Open ${artifactDisplayName(selected)}`}
                        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}
                      >
                        {selected.thumbnailUrl && !failedPreviews[selected.thumbnailUrl] ? (
                          <ExpoImage
                            source={{ uri: selected.thumbnailUrl }}
                            style={{ width: 220, height: 280, borderRadius: 12, backgroundColor: isDark ? '#1A1A1E' : '#EEE' }}
                            contentFit="contain"
                            onError={() => setFailedPreviews((previous) => ({ ...previous, [selected.thumbnailUrl!]: true }))}
                          />
                        ) : (
                          <View style={[styles.documentFallback, { backgroundColor: isDark ? '#1A1A1E' : '#F1F3F6', borderColor: cardBorder }]}>
                            <Ionicons name={documentIcon(selected)} size={54} color={colors.primary} />
                          </View>
                        )}
                        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700', textAlign: 'center' }}>
                          {artifactDisplayName(selected)}
                        </Text>
                        <Text style={{ color: selected.url ? colors.primary : mutedText, fontSize: 12, fontWeight: '600' }}>
                          {selected.url ? 'Tap to open document' : 'Document unavailable'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : !selected.url ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 }}>
                      <Ionicons name="alert-circle-outline" size={40} color={mutedText} />
                      <Text style={{ color: mutedText, fontSize: 13, textAlign: 'center' }}>Preview unavailable.</Text>
                    </View>
                  ) : selected.kind === 'image' ? (
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
                  ) : null}
                </View>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[
                styles.thumbStrip,
                {
                  maxHeight: 94 + insets.bottom,
                  borderTopColor: cardBorder,
                },
              ]}
              contentContainerStyle={{
                paddingHorizontal: 10,
                paddingTop: 10,
                paddingBottom: 10 + insets.bottom,
              }}
            >
              {artifacts.map((artifact) => (
                <Pressable
                  key={artifact.id}
                  onPress={() => {
                    setSelectedId(artifact.id);
                    if (artifact.kind === 'document') {
                      if (artifact.generating || artifact.failed || !artifact.url) return;
                      onOpenDocument(artifact);
                      return;
                    }
                    setSelectedId(artifact.id);
                    setZoom(1);
                  }}
                  accessibilityRole={artifact.kind === 'document' ? 'link' : 'button'}
                  accessibilityLabel={artifact.kind === 'document' ? `Open ${artifactDisplayName(artifact)}` : `View ${artifact.kind}`}
                  style={[
                    styles.thumbTile,
                  ]}
                >
                  <View
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
                    ) : artifact.kind === 'document' && artifact.thumbnailUrl && !failedPreviews[artifact.thumbnailUrl] ? (
                      <ExpoImage
                        source={{ uri: artifact.thumbnailUrl }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                        onError={() => setFailedPreviews((previous) => ({ ...previous, [artifact.thumbnailUrl!]: true }))}
                      />
                    ) : (
                      <View style={[styles.thumbFallback, { backgroundColor: isDark ? '#1A1A1E' : '#EEE' }]}>
                        <Ionicons name={documentIcon(artifact)} size={20} color={colors.primary} />
                      </View>
                    )}
                  </View>
                  {artifact.kind === 'document' ? (
                    <Text
                      numberOfLines={1}
                      style={{ width: 78, marginTop: 4, color: colors.textSecondary, fontSize: 10, textAlign: 'center' }}
                    >
                      {artifactDisplayName(artifact)}
                    </Text>
                  ) : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: 4,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: 10,
    borderWidth: 2,
    overflow: 'hidden',
  },
  thumbTile: {
    width: 84,
    alignItems: 'center',
    marginRight: 6,
  },
  thumbFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentFallback: {
    width: 180,
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
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
