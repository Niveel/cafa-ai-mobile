import { Fragment, type ReactNode, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, type TextStyle, View, type ViewStyle } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import remend from 'remend';
import { Renderer, type MarkedStyles, useMarkdown } from 'react-native-marked';

import { useAppTheme } from '@/hooks';
import { hapticSuccess } from '@/utils/motion';

type StreamingMarkdownProps = {
  content: string;
  isUser: boolean;
  isStreaming?: boolean;
  onOpenLink: (url: string) => void | Promise<void>;
};

type CodeBlockProps = {
  code: string;
  language?: string;
  isDark: boolean;
  containerStyle?: ViewStyle;
  textStyle?: TextStyle;
};

function CodeBlock({ code, language, isDark, containerStyle, textStyle }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const label = language?.trim() ? language.trim().toUpperCase() : 'CODE';

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    hapticSuccess();
    setCopied(true);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setCopied(false), 1300);
  };

  return (
    <View
      style={{
        marginVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isDark ? '#23232B' : '#D7D9E2',
        backgroundColor: isDark ? '#0E0E12' : '#ECECF4',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? '#23232B' : '#D7D9E2',
          backgroundColor: isDark ? '#11151E' : '#E6EBF5',
        }}
      >
        <Text style={{ color: isDark ? '#B7C0D1' : '#3A4864', fontSize: 12, fontWeight: '700' }}>
          {label}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copied ? 'Code copied' : 'Copy code'}
          onPress={() => void copy()}
          hitSlop={8}
          style={{
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 4,
            backgroundColor: isDark ? '#1C2331' : '#D7E2F5',
          }}
        >
          <Text style={{ color: isDark ? '#D8E2F7' : '#29406A', fontSize: 12, fontWeight: '700' }}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={containerStyle}>
        <View style={{ minWidth: '100%', paddingHorizontal: 12, paddingVertical: 10 }}>
          <Text
            selectable
            style={[
              {
                color: isDark ? '#D4D4D4' : '#24292F',
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                fontSize: 13,
                lineHeight: 20,
              },
              textStyle,
            ]}
          >
            {code}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

class ChatMarkdownRenderer extends Renderer {
  constructor(
    private readonly isDark: boolean,
    private readonly openLink: (url: string) => void | Promise<void>,
  ) {
    super();
  }

  override link(children: string | ReactNode[], href: string, styles?: TextStyle, title?: string): ReactNode {
    if (!/^https?:\/\//i.test(href)) {
      return <Text key={this.getKey()} style={styles}>{children}</Text>;
    }

    return (
      <Text
        selectable
        accessibilityRole="link"
        accessibilityHint="Opens in the in-app browser"
        accessibilityLabel={title || (typeof children === 'string' ? children : 'Link')}
        key={this.getKey()}
        onPress={() => void this.openLink(href)}
        style={styles}
      >
        {children}
      </Text>
    );
  }

  override code(
    text: string,
    language?: string,
    containerStyle?: ViewStyle,
    textStyle?: TextStyle,
  ): ReactNode {
    return (
      <CodeBlock
        key={this.getKey()}
        code={text}
        language={language}
        isDark={this.isDark}
        containerStyle={containerStyle}
        textStyle={textStyle}
      />
    );
  }
}

function normalizeAssistantSearchResponse(content: string) {
  if (!content.includes('](')) return content;

  const normalizedNewlines = content.replace(/\r\n/g, '\n');
  const sourceSectionMatch = /\nSources:\n([\s\S]+)$/i.exec(normalizedNewlines);
  const sourceLines = sourceSectionMatch?.[1]
    ?.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /^\d+\.\s+\[.+\]\(https?:\/\/.+\)$/.test(line)) ?? [];
  const body = (sourceSectionMatch
    ? normalizedNewlines.slice(0, sourceSectionMatch.index)
    : normalizedNewlines)
    .trim()
    .split('\n')
    .filter((line, index, lines) => {
      if (!/^\[.+\]\(https?:\/\/.+\)$/.test(line.trim())) return true;
      const next = lines.slice(index + 1).find((candidate) => candidate.trim())?.trim() ?? '';
      return !next.startsWith('**');
    })
    .map((line) => line.replace(/\(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)\)/g, 'Source: [$1]($2)'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!sourceLines.length) return body;
  const sources = sourceLines.map((line, index) => line.replace(/^\d+\./, `${index + 1}.`));
  return `${body}\n\n**Sources**\n${sources.join('\n')}`;
}

export function StreamingMarkdown({ content, isUser, isStreaming = false, onOpenLink }: StreamingMarkdownProps) {
  const { colors, isDark } = useAppTheme();
  const renderer = useMemo(
    () => new ChatMarkdownRenderer(isDark, onOpenLink),
    [isDark, onOpenLink],
  );
  const styles = useMemo<MarkedStyles>(() => ({
    text: { color: colors.textPrimary, fontSize: 16, lineHeight: 24 },
    paragraph: { paddingVertical: 3 },
    link: { color: isDark ? '#8FD3FF' : '#0E5DA8', fontWeight: '700', fontStyle: 'normal' },
    strong: { color: colors.textPrimary, fontSize: 16, lineHeight: 24, fontWeight: '700' },
    em: { color: colors.textPrimary, fontSize: 16, lineHeight: 24 },
    codespan: {
      color: colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      backgroundColor: isDark ? '#1A1A1F' : '#E3E5EC',
      fontStyle: 'normal',
    },
    blockquote: {
      borderLeftColor: colors.primary,
      borderLeftWidth: 3,
      paddingLeft: 10,
      marginVertical: 5,
      opacity: 1,
    },
    h1: { color: colors.textPrimary, fontSize: 20, lineHeight: 26, marginVertical: 6, paddingBottom: 0, borderBottomWidth: 0 },
    h2: { color: colors.textPrimary, fontSize: 18, lineHeight: 24, marginVertical: 6, paddingBottom: 0, borderBottomWidth: 0, fontWeight: '700' },
    h3: { color: colors.textPrimary, fontSize: 17, lineHeight: 23, marginVertical: 5, fontWeight: '700' },
    h4: { color: colors.textPrimary, fontSize: 16, lineHeight: 22, marginVertical: 4, fontWeight: '700' },
    h5: { color: colors.textPrimary, fontSize: 16, lineHeight: 22, marginVertical: 3, fontWeight: '700' },
    h6: { color: colors.textSecondary, fontSize: 15, lineHeight: 21, marginVertical: 3, fontWeight: '700' },
    list: { marginVertical: 3 },
    li: { color: colors.textPrimary, fontSize: 16, lineHeight: 24 },
    table: { borderColor: colors.border, marginVertical: 6 },
    tableCell: { padding: 7 },
    hr: { borderBottomColor: colors.border, marginVertical: 8 },
  }), [colors.border, colors.primary, colors.textPrimary, colors.textSecondary, isDark]);

  const markdown = useMemo(() => {
    const normalized = normalizeAssistantSearchResponse(content);
    return isStreaming ? remend(normalized, { linkMode: 'text-only' }) : normalized;
  }, [content, isStreaming]);
  const nodes = useMarkdown(markdown, {
    colorScheme: isDark ? 'dark' : 'light',
    renderer,
    styles,
  });

  if (isUser) {
    return <Text style={{ color: '#FFFFFF', lineHeight: 20 }}>{content}</Text>;
  }

  return <View>{nodes.map((node, index) => <Fragment key={index}>{node}</Fragment>)}</View>;
}
