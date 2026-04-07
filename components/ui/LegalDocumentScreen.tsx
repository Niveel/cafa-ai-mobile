import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LegalDocument } from '@/types';
import { useAppTheme } from '@/hooks';
import { SecondaryNav } from './SecondaryNav';

type LegalDocumentScreenProps = {
  title: string;
  document: LegalDocument;
};

export function LegalDocumentScreen({ title, document }: LegalDocumentScreenProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background, paddingHorizontal: 10 }}>
      <SecondaryNav title={title} topOffset={Math.max(insets.top, 0)} />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 18, 28) }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          className="mt-3 rounded-2xl border p-4"
          style={{ borderColor: colors.border, backgroundColor: isDark ? '#0F0F12' : '#FFFFFF' }}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 21, fontWeight: '700' }}>{document.title}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
            Last updated: {document.lastUpdated}
          </Text>

          {(document.intro ?? []).map((paragraph, index) => (
            <Text key={`intro-${index}`} style={{ color: colors.textSecondary, fontSize: 13, marginTop: 10, lineHeight: 20 }}>
              {paragraph}
            </Text>
          ))}

          {document.sections.map((section, sectionIndex) => (
            <View key={section.id} style={{ marginTop: sectionIndex === 0 ? 16 : 18 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>{section.heading}</Text>

              {(section.paragraphs ?? []).map((paragraph, paragraphIndex) => (
                <Text
                  key={`${section.id}-paragraph-${paragraphIndex}`}
                  style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 8 }}
                >
                  {paragraph}
                </Text>
              ))}

              {(section.lists ?? []).map((list, listIndex) => (
                <View key={`${section.id}-list-${listIndex}`} style={{ marginTop: 8 }}>
                  {list.items.map((item, itemIndex) => (
                    <Text
                      key={`${section.id}-list-${listIndex}-item-${itemIndex}`}
                      style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 4 }}
                    >
                      {list.kind === 'ordered' ? `${itemIndex + 1}. ${item}` : `- ${item}`}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
