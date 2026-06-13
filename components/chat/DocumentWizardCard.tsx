import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';

import { generateDocumentFromWizard } from '@/services';
import type { DocumentWizardArtifact } from '@/types';

import { enhanceDocumentWizardHtml } from './document-wizard/enhanceDocumentWizardHtml';

type DocumentWizardCardProps = {
  html: string;
  documentType: string;
  format: string;
  conversationId?: string | null;
  assistantMessageId?: string;
  userMessageId?: string;
  collapsed?: boolean;
  isDark: boolean;
  colors: {
    primary: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
  };
  onExpand?: () => void;
  onComplete: (artifacts: DocumentWizardArtifact[]) => void;
};

const HEIGHT_MESSAGE_PREFIX = '__CAFA_WIZARD_HEIGHT__:';

export function DocumentWizardCard({
  html,
  documentType,
  format,
  conversationId,
  assistantMessageId,
  userMessageId,
  collapsed = false,
  isDark,
  colors,
  onExpand,
  onComplete,
}: DocumentWizardCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [formHeight, setFormHeight] = useState(440);

  const enhancedHtml = useMemo(
    () => enhanceDocumentWizardHtml(html, colors.primary, isDark),
    [colors.primary, html, isDark],
  );

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(
      `${documentType} form ready. Complete each required field and submit when you are done.`,
    );
  }, [documentType]);

  const handlePayload = useCallback(async (payload: string) => {
    if (payload.startsWith(HEIGHT_MESSAGE_PREFIX)) {
      const nextHeight = Number(payload.replace(HEIGHT_MESSAGE_PREFIX, ''));
      if (Number.isFinite(nextHeight) && nextHeight > 0) {
        setFormHeight(Math.max(360, Math.min(1040, Math.ceil(nextHeight))));
      }
      return;
    }

    let formData: Record<string, string>;
    try {
      formData = JSON.parse(payload);
    } catch {
      return;
    }

    if (!formData || typeof formData !== 'object' || Array.isArray(formData)) return;

    setLoading(true);
    setError(null);
    AccessibilityInfo.announceForAccessibility?.('Generating your document.');

    try {
      const artifacts = await generateDocumentFromWizard(formData, documentType, format, {
        conversationId: conversationId ?? undefined,
        assistantMessageId,
        userMessageId,
      });
      AccessibilityInfo.announceForAccessibility?.('Document generated successfully.');
      onComplete(artifacts);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'We could not generate the document. Please try again.';
      setError(message);
      AccessibilityInfo.announceForAccessibility?.(message);
    } finally {
      setLoading(false);
    }
  }, [assistantMessageId, conversationId, documentType, format, onComplete, userMessageId]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const listener = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      void handlePayload(event.data);
    };

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [handlePayload]);

  const embeddedForm = Platform.OS === 'web'
    ? (createElement('iframe', {
        key: `wizard-inline-iframe-${reloadKey}`,
        srcDoc: enhancedHtml,
        sandbox: 'allow-scripts allow-forms',
        title: `${documentType} form`,
        style: {
          border: '0',
          width: '100%',
          height: `${formHeight}px`,
          backgroundColor: isDark ? '#101821' : '#f8fafc',
        },
      }) as ReactElement)
    : (
        <WebView
          key={`wizard-inline-webview-${reloadKey}`}
          source={{ html: enhancedHtml }}
          onMessage={(event) => {
            void handlePayload(event.nativeEvent.data);
          }}
          javaScriptEnabled
          originWhitelist={['*']}
          scrollEnabled
          style={{ flex: 1, backgroundColor: isDark ? '#101821' : '#f8fafc' }}
        />
      );

  if (collapsed) {
    return (
      <LinearGradient
        colors={isDark ? ['#0f1826', '#0b111a'] : ['#ffffff', '#f6f9fc']}
        style={{
          width: '100%',
          borderRadius: 14,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(95,127,184,0.18)' : 'rgba(22,53,95,0.10)',
          overflow: 'hidden',
          paddingHorizontal: 9,
          paddingVertical: 8,
        }}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
          Unfinished {documentType} form
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 3, lineHeight: 14 }}>
          You can continue this form later and still generate the document.
        </Text>
        <Pressable
          onPress={onExpand}
          style={{
            alignSelf: 'flex-start',
            marginTop: 7,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 7,
            backgroundColor: isDark ? 'rgba(95,127,184,0.16)' : 'rgba(95,127,184,0.10)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(159,176,195,0.12)' : 'rgba(22,53,95,0.10)',
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800' }}>
            Continue form
          </Text>
        </Pressable>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={isDark ? ['#0f1826', '#0b111a'] : ['#ffffff', '#f6f9fc']}
      style={{
        width: '100%',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(95,127,184,0.18)' : 'rgba(22,53,95,0.10)',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          paddingHorizontal: 7,
          paddingVertical: 6,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? 'rgba(95,127,184,0.16)' : 'rgba(22,53,95,0.08)',
        }}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 10, fontWeight: '700' }}>
          Fill in the form below and submit when ready.
        </Text>
      </View>

      {error ? (
        <View
          accessibilityRole="alert"
          style={{
            marginHorizontal: 7,
            marginTop: 6,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: 'rgba(191,61,61,0.18)',
            backgroundColor: isDark ? 'rgba(92,20,20,0.24)' : '#fff6f6',
            paddingHorizontal: 8,
            paddingVertical: 7,
          }}
        >
          <Text style={{ color: isDark ? '#ffd7d7' : '#b43131', fontSize: 11, fontWeight: '700' }}>
            {error}
          </Text>
          <Pressable
            onPress={() => {
              setError(null);
              setReloadKey((current) => current + 1);
            }}
            style={{
              alignSelf: 'flex-start',
              marginTop: 6,
              borderRadius: 999,
              paddingHorizontal: 9,
              paddingVertical: 6,
              backgroundColor: colors.primary,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>Reload form</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={{ padding: 5 }}>
        <View
          style={{
            borderRadius: 12,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(95,127,184,0.16)' : 'rgba(22,53,95,0.08)',
            backgroundColor: isDark ? '#101821' : '#f8fafc',
            height: Platform.OS === 'web' ? formHeight : Math.max(420, Math.min(920, formHeight)),
          }}
        >
          {embeddedForm}
        </View>
      </View>

      {loading ? (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Generating your document"
          style={{
            marginHorizontal: 7,
            marginBottom: 7,
            borderRadius: 12,
            paddingHorizontal: 8,
            paddingVertical: 7,
            backgroundColor: isDark ? 'rgba(95,127,184,0.12)' : 'rgba(95,127,184,0.08)',
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <ActivityIndicator size="small" color={colors.primary} />
          <Ionicons name="document-text-outline" size={13} color={colors.primary} style={{ marginLeft: 6 }} />
          <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700', marginLeft: 6 }}>
            Generating your document...
          </Text>
        </View>
      ) : null}
    </LinearGradient>
  );
}
