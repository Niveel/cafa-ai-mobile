import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { FileKind } from '@/utils';

/**
 * Flat file icons drawn natively (react-native-svg), in the style of the Office
 * product icons: a page with a folded corner and the file type on it. PDF, Word,
 * Excel and PowerPoint use the familiar solid colours; other types use a neutral
 * page with a coloured label band. No background tile or padding around them.
 */
type IconSpec = {
  label: string;
  color: string;
  /** Solid page in the type colour, or a neutral page with a coloured band. */
  solid: boolean;
};

export const FILE_KIND_STYLE: Record<FileKind, IconSpec> = {
  pdf: { label: 'PDF', color: '#E5252A', solid: true },
  word: { label: 'DOC', color: '#2B579A', solid: true },
  excel: { label: 'XLS', color: '#1D7A45', solid: true },
  powerpoint: { label: 'PPT', color: '#D24726', solid: true },
  markdown: { label: 'MD', color: '#475569', solid: false },
  text: { label: 'TXT', color: '#64748B', solid: false },
  csv: { label: 'CSV', color: '#1D7A45', solid: false },
  json: { label: 'JSON', color: '#CA8A04', solid: false },
  html: { label: 'HTML', color: '#E34F26', solid: false },
  zip: { label: 'ZIP', color: '#CA8A04', solid: false },
  image: { label: 'IMG', color: '#8B5CF6', solid: false },
  video: { label: 'VID', color: '#EC4899', solid: false },
  audio: { label: 'AUD', color: '#14B8A6', solid: false },
  other: { label: 'FILE', color: '#5B7DB1', solid: false },
};

// Page with a folded top-right corner, drawn in a 32 x 40 box.
const PAGE_PATH = 'M2 0 H22 L32 10 V38 A2 2 0 0 1 30 40 H2 A2 2 0 0 1 0 38 V2 A2 2 0 0 1 2 0 Z';
const FOLD_PATH = 'M22 0 V8 A2 2 0 0 0 24 10 H32 Z';
// Coloured band across the bottom of a neutral page.
const BAND_PATH = 'M0 26 H32 V38 A2 2 0 0 1 30 40 H2 A2 2 0 0 1 0 38 Z';

type FileTypeIconProps = {
  kind: FileKind;
  size?: number;
};

export function FileTypeIcon({ kind, size = 44 }: FileTypeIconProps) {
  const spec = FILE_KIND_STYLE[kind] ?? FILE_KIND_STYLE.other;
  const width = Math.round(size * 0.8);
  const fontSize = Math.max(8, Math.round(size * (spec.label.length > 3 ? 0.2 : 0.25)));

  return (
    <View accessible={false} style={{ width, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={width} height={size} viewBox="0 0 32 40">
        <Path d={PAGE_PATH} fill={spec.solid ? spec.color : '#E8ECF1'} />
        {spec.solid ? null : <Path d={BAND_PATH} fill={spec.color} />}
        <Path d={FOLD_PATH} fill={spec.solid ? 'rgba(255,255,255,0.35)' : '#C5CCD6'} />
      </Svg>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          textAlign: 'center',
          // Centred on the lower part of the page (the coloured band on neutral pages).
          top: Math.round(size * (spec.solid ? 0.46 : 0.7)) - fontSize / 2,
          color: spec.solid ? '#FFFFFF' : '#FFFFFF',
          fontSize,
          lineHeight: Math.round(fontSize * 1.15),
          fontWeight: '800',
          letterSpacing: 0.3,
        }}
      >
        {spec.label}
      </Text>
    </View>
  );
}

export default FileTypeIcon;
