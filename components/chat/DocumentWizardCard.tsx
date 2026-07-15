import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const SUBMIT_MESSAGE = '__CAFA_WIZARD_SUBMIT__';
const NATIVE_DOCUMENT_WIZARD_BRIDGE = `
  (function () {
    var form = document.querySelector('form');
    if (!form || form.getAttribute('data-cafa-native-bridge') === 'true') return true;
    form.setAttribute('data-cafa-native-bridge', 'true');
    form.setAttribute('novalidate', 'novalidate');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      window.ReactNativeWebView.postMessage('__CAFA_WIZARD_SUBMIT__');

      var requiredControls = Array.prototype.slice.call(
        form.querySelectorAll('input[required], textarea[required], select[required], [aria-required="true"]')
      );
      var firstEmpty = requiredControls.find(function (control) {
        var type = ((control.getAttribute('type') || '') + '').toLowerCase();
        if (type === 'radio' || type === 'checkbox') {
          var name = control.getAttribute('name');
          if (!name) return !control.checked;
          return !form.querySelector('[name="' + name.replace(/"/g, '\\"') + '"]:checked');
        }
        return !String(control.value || '').trim();
      });
      if (firstEmpty) {
        firstEmpty.setAttribute('aria-invalid', 'true');
        if (typeof firstEmpty.scrollIntoView === 'function') firstEmpty.scrollIntoView({ block: 'center' });
        if (typeof firstEmpty.focus === 'function') firstEmpty.focus();
        return false;
      }

      var submittedData = {};
      new FormData(form).forEach(function (value, key) {
        var normalizedValue = typeof value === 'string' ? value : value.name;
        if (Object.prototype.hasOwnProperty.call(submittedData, key) && submittedData[key]) {
          submittedData[key] += ', ' + normalizedValue;
        } else {
          submittedData[key] = normalizedValue;
        }
      });
      window.ReactNativeWebView.postMessage(JSON.stringify(submittedData));
      return false;
    }, true);
    return true;
  })();
`;

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
  const submissionInFlightRef = useRef(false);

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
    if (Object.keys(formData).length === 0) {
      setError('The form fields could not be read. Please reload the form and try again.');
      AccessibilityInfo.announceForAccessibility?.('The form fields could not be read. Please reload the form and try again.');
      return;
    }

    if (payload === SUBMIT_MESSAGE) {
      console.log('submitting form...');
      return;
    }
    if (submissionInFlightRef.current) return;
    submissionInFlightRef.current = true;

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
      submissionInFlightRef.current = false;
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
          injectedJavaScript={NATIVE_DOCUMENT_WIZARD_BRIDGE}
          originWhitelist={['*']}
          nestedScrollEnabled
          showsVerticalScrollIndicator
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

      {loading ? (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Form submitted. Generating your document."
          style={{
            margin: 7,
            minHeight: 150,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18,
            backgroundColor: isDark ? 'rgba(95,127,184,0.10)' : 'rgba(95,127,184,0.07)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(95,127,184,0.18)' : 'rgba(22,53,95,0.10)',
          }}
        >
          <ActivityIndicator size="small" color={colors.primary} />
          <Ionicons name="document-text-outline" size={22} color={colors.primary} style={{ marginTop: 12 }} />
          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800', marginTop: 8 }}>
            Form submitted
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
            Generating your document now.
          </Text>
        </View>
      ) : null}

      <View
        pointerEvents={loading ? 'none' : 'auto'}
        accessibilityElementsHidden={loading}
        importantForAccessibility={loading ? 'no-hide-descendants' : 'auto'}
        style={{ padding: loading ? 0 : 5, height: loading ? 0 : undefined, opacity: loading ? 0 : 1, overflow: 'hidden' }}
      >
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
    </LinearGradient>
  );
}
