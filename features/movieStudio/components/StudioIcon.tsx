import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BellRing,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  CirclePlay,
  CircleX,
  Clapperboard,
  CloudUpload,
  Coins,
  Columns2,
  Crop,
  Dices,
  Download,
  Eraser,
  FileText,
  Film,
  FolderClock,
  History,
  House,
  Image as ImageGlyph,
  ImagePlus,
  Images,
  Layers,
  LoaderCircle,
  Maximize2,
  Megaphone,
  Menu,
  MessageSquare,
  MonitorPlay,
  Music,
  PanelLeft,
  PanelRight,
  PanelTop,
  PanelsTopLeft,
  Play,
  Plus,
  RectangleVertical,
  RefreshCw,
  RotateCcw,
  Route,
  Save,
  Scissors,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Square,
  SquarePlay,
  Trash2,
  TriangleAlert,
  Tv,
  UserRound,
  Users,
  Video,
  WandSparkles,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useReducedMotionPreference } from '@/hooks';

import type { StudioIconName } from '../studioIconNames';

const ICONS: Record<StudioIconName, LucideIcon> = {
  'arrow-down': ArrowDown,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'bell-ring': BellRing,
  'briefcase-business': BriefcaseBusiness,
  'calendar-days': CalendarDays,
  check: Check,
  'check-check': CheckCheck,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  'circle-check': CircleCheck,
  'circle-play': CirclePlay,
  'circle-x': CircleX,
  clapperboard: Clapperboard,
  'cloud-upload': CloudUpload,
  coins: Coins,
  'columns-2': Columns2,
  crop: Crop,
  dices: Dices,
  download: Download,
  eraser: Eraser,
  'file-text': FileText,
  film: Film,
  'folder-clock': FolderClock,
  history: History,
  house: House,
  image: ImageGlyph,
  'image-plus': ImagePlus,
  images: Images,
  layers: Layers,
  'loader-circle': LoaderCircle,
  'maximize-2': Maximize2,
  megaphone: Megaphone,
  menu: Menu,
  'message-square': MessageSquare,
  'monitor-play': MonitorPlay,
  music: Music,
  'panel-left': PanelLeft,
  'panel-right': PanelRight,
  'panel-top': PanelTop,
  'panels-top-left': PanelsTopLeft,
  play: Play,
  plus: Plus,
  'rectangle-vertical': RectangleVertical,
  'refresh-cw': RefreshCw,
  'rotate-ccw': RotateCcw,
  route: Route,
  save: Save,
  scissors: Scissors,
  shuffle: Shuffle,
  'sliders-horizontal': SlidersHorizontal,
  sparkles: Sparkles,
  square: Square,
  'square-play': SquarePlay,
  'trash-2': Trash2,
  'triangle-alert': TriangleAlert,
  tv: Tv,
  'user-round': UserRound,
  users: Users,
  video: Video,
  'wand-sparkles': WandSparkles,
  x: X,
  'zoom-in': ZoomIn,
  'zoom-out': ZoomOut,
};

type Props = {
  name: StudioIconName;
  /** Web sizes: 14, 16, 20, 24, 28, 32, 40, 48 dp. */
  size?: number;
  color?: string;
  /** Filled glyph (only `play` thumbnails and the Cancel render square use this on web). */
  fill?: string;
};

/**
 * The one place Movie Studio icons come from: Lucide, stroke width 2, round caps.
 * Icons are decorative; icon-only controls carry their own accessibilityLabel on the Pressable.
 * loader-circle spins (static under reduce-motion).
 */
export function StudioIcon({ name, size = 16, color = '#FFFFFF', fill }: Props) {
  const Glyph = ICONS[name];
  const spin = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotionPreference();
  const spinning = name === 'loader-circle' && !reduceMotion;

  useEffect(() => {
    if (!spinning) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin, spinning]);

  const glyph = <Glyph size={size} color={color} strokeWidth={2} fill={fill ?? 'none'} />;
  if (!spinning) return glyph;
  return (
    <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
      {glyph}
    </Animated.View>
  );
}
