import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks';
import { resolveProductLink } from '@/features/chat';
import type { UiMessageProduct } from './types';

/**
 * Real, structured shopping cards for search_products. Ports web's
 * ProductCards.tsx concept (not code) to React Native -- same card-list +
 * detail-view shape, same on-demand direct-link resolution (resolveProductLink,
 * ~1.5s, best-effort, only paid for the one product someone actually opens).
 * Client-side price/rating filter and sort are left out of this pass (web
 * has them; a real, scoped follow-up, not an oversight) -- the core
 * card-list + detail view is what's ported here.
 */
type ProductCardsProps = {
  query: string;
  items: UiMessageProduct[];
  isDark: boolean;
};

export function ProductCards({ query, items, isDark }: ProductCardsProps) {
  const { colors } = useAppTheme();
  const [selected, setSelected] = useState<UiMessageProduct | null>(null);
  const [resolvedLink, setResolvedLink] = useState<{ url: string; confidence: 'exact' | 'fallback' } | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  if (!items.length) return null;

  const mutedText = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)';
  const cardBorder = isDark ? '#2A2A31' : '#D4D4DC';
  const cardBg = isDark ? '#0F1016' : '#F6F7FB';

  const openDetails = (item: UiMessageProduct) => {
    setSelected(item);
    setResolvedLink(null);
  };

  const findDirectLink = async () => {
    if (!selected) return;
    setIsResolving(true);
    try {
      const result = await resolveProductLink(selected.title, selected.source, selected.link);
      setResolvedLink(result);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <View className="mt-2 mb-1">
      <Text style={{ color: mutedText, fontSize: 11, marginBottom: 6 }}>
        Shopping results for &ldquo;{query}&rdquo;
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {items.map((item, index) => (
          <Pressable
            key={`${item.link}-${index}`}
            onPress={() => openDetails(item)}
            style={[styles.card, { borderColor: cardBorder, backgroundColor: cardBg }]}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${item.price || 'price unknown'}`}
          >
            <View style={[styles.cardImage, { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#FFFFFF' }]}>
              {item.imageUrl ? (
                <ExpoImage source={{ uri: item.imageUrl }} style={styles.cardImageInner} contentFit="contain" />
              ) : (
                <Text style={{ color: mutedText, fontSize: 11 }}>No image</Text>
              )}
            </View>
            <View style={{ padding: 10, gap: 2 }}>
              <Text numberOfLines={2} style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>
                {item.title}
              </Text>
              <Text style={{ color: '#A855F7', fontSize: 13, fontWeight: '700' }}>
                {item.price || 'Price unknown'}
              </Text>
              {item.source ? (
                <Text numberOfLines={1} style={{ color: mutedText, fontSize: 11 }}>{item.source}</Text>
              ) : null}
              {typeof item.rating === 'number' ? (
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <Ionicons name="star" size={11} color="#FBBF24" />
                  <Text style={{ color: mutedText, fontSize: 11 }}>
                    {item.rating.toFixed(1)}
                    {item.ratingCount ? ` (${item.ratingCount.toLocaleString()})` : ''}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSelected(null)} />
          <View style={[styles.sheet, { backgroundColor: isDark ? '#0B0B0D' : '#FFFFFF' }]}>
            {selected ? (
              <>
                <View style={[styles.detailImage, { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#F6F7FB' }]}>
                  {selected.imageUrl ? (
                    <ExpoImage source={{ uri: selected.imageUrl }} style={styles.cardImageInner} contentFit="contain" />
                  ) : (
                    <Text style={{ color: mutedText, fontSize: 13 }}>No image</Text>
                  )}
                </View>
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginTop: 12 }}>
                  {selected.title}
                </Text>
                <Text style={{ color: '#A855F7', fontSize: 18, fontWeight: '700', marginTop: 4 }}>
                  {selected.price || 'Price unknown'}
                </Text>
                {selected.source ? (
                  <Text style={{ color: mutedText, fontSize: 13, marginTop: 2 }}>{selected.source}</Text>
                ) : null}
                {typeof selected.rating === 'number' ? (
                  <View className="flex-row items-center" style={{ gap: 4, marginTop: 4 }}>
                    <Ionicons name="star" size={14} color="#FBBF24" />
                    <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                      {selected.rating.toFixed(1)}
                      {selected.ratingCount ? ` (${selected.ratingCount.toLocaleString()} reviews)` : ''}
                    </Text>
                  </View>
                ) : null}

                <View style={{ marginTop: 16, gap: 8 }}>
                  {resolvedLink ? (
                    <Pressable
                      onPress={() => void Linking.openURL(resolvedLink.url)}
                      style={[styles.primaryButton, { backgroundColor: '#7C3AED' }]}
                    >
                      <Ionicons name="open-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.primaryButtonText}>
                        {resolvedLink.confidence === 'exact' ? 'Open retailer page' : 'Open Google Shopping'}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => void findDirectLink()}
                      disabled={isResolving}
                      style={[styles.primaryButton, { backgroundColor: '#7C3AED', opacity: isResolving ? 0.6 : 1 }]}
                    >
                      <Text style={styles.primaryButtonText}>
                        {isResolving ? 'Finding direct link...' : 'Find direct link'}
                      </Text>
                    </Pressable>
                  )}
                  {resolvedLink?.confidence === 'fallback' ? (
                    <Text style={{ color: mutedText, fontSize: 11, textAlign: 'center' }}>
                      Couldn&rsquo;t confirm the exact retailer page — showing Google Shopping instead.
                    </Text>
                  ) : null}
                  <Pressable onPress={() => void Linking.openURL(selected.link)}>
                    <Text style={{ color: mutedText, fontSize: 11, textAlign: 'center', textDecorationLine: 'underline' }}>
                      View on Google Shopping
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSelected(null)}
                    style={[styles.secondaryButton, { borderColor: cardBorder }]}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>Close</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 150,
    marginRight: 10,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardImage: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImageInner: {
    width: '100%',
    height: '100%',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  detailImage: {
    height: 180,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
  },
});

export default ProductCards;
