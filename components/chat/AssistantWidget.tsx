import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Switch, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import type { UiWidgetSpec } from './types';
import { uploadWidgetFile, deleteUploadedWidgetFile } from '@/features/chat/services/widgets';

/**
 * render_widget form -- RN port of web's AssistantWidget.tsx (chat-shell/).
 * Same real behavior: fields build a `[Form response] name=value; ...` line
 * on submit, sent as the next turn exactly like a typed message
 * (see onSubmit wiring in the chat screen, mirroring web's handleWidgetSubmit
 * going through submitOrQueue). File fields upload eagerly so the value is a
 * real URL by the time submit runs; a still-uploading field blocks submit
 * rather than sending a silently-wrong empty value.
 */
export function AssistantWidget({
  spec,
  disabled,
  isDark,
  onSubmit,
}: {
  spec: UiWidgetSpec;
  disabled?: boolean;
  isDark: boolean;
  onSubmit: (line: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const field of spec.fields) {
      if (field.type === 'display') continue;
      if (field.type === 'checkbox') init[field.name] = String(field.default).toLowerCase() === 'true' ? 'yes' : 'no';
      else if (field.default !== undefined) init[field.name] = String(field.default);
      else if (field.type === 'select' || field.type === 'radio') init[field.name] = field.options?.[0] ?? '';
      else init[field.name] = '';
    }
    return init;
  });
  const [status, setStatus] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState(false);

  const uploadedUrlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    return () => {
      if (!sent) {
        Object.values(uploadedUrlsRef.current).forEach((url) => deleteUploadedWidgetFile(url));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only real on unmount
  }, []);

  const locked = disabled || sent;
  const isUploading = Object.values(uploading).some(Boolean);

  const pickAndUploadFile = async (fieldName: string) => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    const previousUrl = uploadedUrlsRef.current[fieldName];
    if (previousUrl) {
      delete uploadedUrlsRef.current[fieldName];
      deleteUploadedWidgetFile(previousUrl);
    }

    setStatus((s) => ({ ...s, [fieldName]: `Uploading ${asset.name}...` }));
    setUploading((u) => ({ ...u, [fieldName]: true }));
    try {
      const uploaded = await uploadWidgetFile(asset.uri, asset.name, asset.mimeType);
      uploadedUrlsRef.current[fieldName] = uploaded.url;
      setValues((v) => ({ ...v, [fieldName]: uploaded.url }));
      setStatus((s) => ({ ...s, [fieldName]: `✓ ${uploaded.name}` }));
    } catch (error) {
      setValues((v) => ({ ...v, [fieldName]: '' }));
      setStatus((s) => ({ ...s, [fieldName]: error instanceof Error ? error.message : 'Upload failed.' }));
    } finally {
      setUploading((u) => ({ ...u, [fieldName]: false }));
    }
  };

  const submit = () => {
    if (isUploading) return;
    const parts: string[] = [];
    for (const field of spec.fields) {
      if (field.type === 'display') continue;
      const value = values[field.name] ?? '';
      if (field.required && !value) {
        setStatus((s) => ({ ...s, [field.name]: 'Required' }));
        return;
      }
      if (value !== '') parts.push(`${field.name}=${value}`);
    }
    setSent(true);
    onSubmit(`[Form response] ${parts.join('; ')}`);
  };

  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const labelColor = isDark ? '#A3A3A3' : 'rgba(0,0,0,0.55)';
  const textColor = isDark ? '#F5F5F5' : '#000000';
  const inputBg = isDark ? '#0A0A0A' : '#FFFFFF';

  return (
    <View
      style={{
        marginVertical: 12,
        maxWidth: 480,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: cardBorder,
        backgroundColor: cardBg,
        padding: 16,
      }}
    >
      <Text style={{ marginBottom: 4, fontSize: 14, fontWeight: '600', color: textColor }}>{spec.title}</Text>
      {spec.description ? (
        <Text style={{ marginBottom: 12, fontSize: 12, color: labelColor }}>{spec.description}</Text>
      ) : null}

      {spec.fields.map((field) => {
        if (field.type === 'display') {
          return (
            <View key={field.name} style={{ marginBottom: 12 }}>
              <Text style={{ marginBottom: 4, fontSize: 12, color: labelColor }}>{field.label}</Text>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: cardBorder,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ fontSize: 14, color: isDark ? '#D4D4D4' : 'rgba(0,0,0,0.8)' }}>
                  {field.default ?? ''}
                </Text>
              </View>
            </View>
          );
        }

        return (
          <View key={field.name} style={{ marginBottom: 12, gap: 6 }}>
            <Text style={{ fontSize: 12, color: labelColor }}>
              {field.label}
              {field.required ? <Text style={{ color: '#F59E0B' }}> *</Text> : null}
            </Text>

            {field.type === 'select' || field.type === 'radio' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(field.options ?? []).map((option) => {
                  const selected = values[field.name] === option;
                  return (
                    <Pressable
                      key={option}
                      disabled={locked}
                      onPress={() => setValues((v) => ({ ...v, [field.name]: option }))}
                      style={{
                        borderWidth: 1,
                        borderColor: selected ? '#2563EB' : cardBorder,
                        backgroundColor: selected ? '#2563EB' : 'transparent',
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        opacity: locked ? 0.5 : 1,
                      }}
                    >
                      <Text style={{ fontSize: 13, color: selected ? '#FFFFFF' : textColor }}>{option}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : field.type === 'checkbox' ? (
              <Switch
                disabled={locked}
                value={values[field.name] === 'yes'}
                onValueChange={(next) => setValues((v) => ({ ...v, [field.name]: next ? 'yes' : 'no' }))}
              />
            ) : field.type === 'file' ? (
              <>
                <Pressable
                  disabled={locked}
                  onPress={() => void pickAndUploadFile(field.name)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    alignSelf: 'flex-start',
                    borderWidth: 1,
                    borderColor: cardBorder,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    opacity: locked ? 0.5 : 1,
                  }}
                >
                  {uploading[field.name] ? (
                    <ActivityIndicator size="small" color={textColor} />
                  ) : (
                    <Ionicons name="attach-outline" size={16} color={textColor} />
                  )}
                  <Text style={{ fontSize: 13, color: textColor }}>Choose file</Text>
                </Pressable>
                {status[field.name] ? (
                  <Text style={{ fontSize: 11, color: labelColor }}>{status[field.name]}</Text>
                ) : null}
              </>
            ) : (
              <TextInput
                editable={!locked}
                keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                value={values[field.name] ?? ''}
                onChangeText={(text) => setValues((v) => ({ ...v, [field.name]: text }))}
                style={{
                  borderWidth: 1,
                  borderColor: cardBorder,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  fontSize: 14,
                  color: textColor,
                  backgroundColor: inputBg,
                  opacity: locked ? 0.5 : 1,
                }}
              />
            )}
            {status[field.name] && field.type !== 'file' ? (
              <Text style={{ fontSize: 11, color: '#F59E0B' }}>{status[field.name]}</Text>
            ) : null}
          </View>
        );
      })}

      <Pressable
        disabled={locked || isUploading}
        onPress={submit}
        style={{
          alignSelf: 'flex-start',
          borderRadius: 8,
          backgroundColor: '#2563EB',
          paddingHorizontal: 16,
          paddingVertical: 10,
          opacity: locked || isUploading ? 0.5 : 1,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
          {sent ? 'Submitted' : isUploading ? 'Uploading...' : spec.submit_label || 'Submit'}
        </Text>
      </Pressable>
    </View>
  );
}

export default AssistantWidget;
