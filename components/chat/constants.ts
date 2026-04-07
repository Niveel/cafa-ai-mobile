import { Platform } from 'react-native';
import { ChatModelKey } from './types';

export const IMAGE_MODE_PROMPTS = [
  'Generate image of a futuristic government operations center.',
  'Generate image of an underwater research city with glowing coral.',
  'Generate image of a cinematic aerial view of a neon megacity.',
  'Generate image of a modern courtroom with holographic evidence displays.',
  'Generate image of a serene mountain village at sunrise with misty valleys.',
  'Generate image of a cyberpunk train station in heavy rain at night.',
  'Generate image of a luxury eco-resort built into a tropical cliff.',
  'Generate image of an AI-powered hospital command room with transparent dashboards.',
  'Generate image of a museum of ancient artifacts lit by warm skylights.',
  'Generate image of a floating market city above the clouds.',
  'Generate image of a minimalist Japanese tea house in a bamboo forest.',
  'Generate image of a modern startup office with sunset light and plants.',
  'Generate image of a desert research outpost under a dramatic storm sky.',
  'Generate image of a Victorian library with towering shelves and candlelight.',
  'Generate image of a hyperreal astronaut portrait with Earth reflection in visor.',
  'Generate image of a bioluminescent cave with underground river.',
  'Generate image of a futuristic classroom with interactive hologram lessons.',
  'Generate image of a high-end fashion editorial on a rooftop helipad.',
  'Generate image of a fantasy castle bridge over lava at dusk.',
  'Generate image of a peaceful city park redesigned for autonomous mobility.',
  'Generate image of a spacecraft hangar with maintenance drones.',
  'Generate image of a bustling African night market with vibrant textiles.',
  'Generate image of a Scandinavian cabin interior with cozy lighting.',
  'Generate image of a deep-sea exploration lab with panoramic glass walls.',
  'Generate image of a smart farm with autonomous tractors and drone swarms.',
  'Generate image of a modern data center corridor with neon accents.',
  'Generate image of a cinematic portrait of a scientist in a lab coat.',
  'Generate image of a moon base greenhouse filled with tropical plants.',
  'Generate image of a financial trading floor with giant digital displays.',
  'Generate image of an airport terminal of the year 2050.',
  'Generate image of a rainforest canopy city connected by hanging bridges.',
  'Generate image of a courtroom scene with AI evidence assistant on display.',
  'Generate image of a renaissance painting style portrait of a software engineer.',
  'Generate image of a luxury electric yacht interior at golden hour.',
  'Generate image of a war-room map table visualizing global climate risk.',
  'Generate image of a fantasy forest shrine with glowing runes.',
  'Generate image of an industrial robot assembly line in a clean factory.',
  'Generate image of a modern penthouse living room with skyline view.',
  'Generate image of a hidden waterfall temple in dense jungle.',
  'Generate image of a vivid macro shot of a mechanical watch movement.',
  'Generate image of a team brainstorming in a glass innovation lab.',
  'Generate image of a Martian colony street with red dust atmosphere.',
  'Generate image of an art deco city boulevard at night.',
  'Generate image of a cozy cafe where humans and robots work together.',
  'Generate image of a supercomputer room with liquid cooling pipes.',
  'Generate image of an enchanted snow village under aurora lights.',
  'Generate image of a precision surgery room with robotic assistants.',
  'Generate image of a cinematic aerial shot of a coastal fortress.',
  'Generate image of a futuristic parliamentary chamber with smart desks.',
  'Generate image of a digital twin city dashboard projected in 3D.',
];

export const VIDEO_MODE_PROMPTS = [
  'Generate video of drones coordinating disaster relief over a coastal city.',
  'Generate video of a smart city skyline transitioning from sunset to neon night.',
  'Generate video of a national emergency war room during a cyber incident.',
  'Generate video of a futuristic parliament session with transparent voting screens.',
  'Generate video of ocean waves crashing against black volcanic cliffs at sunrise.',
  'Generate video of a cinematic fly-through of a futuristic hospital corridor.',
  'Generate video of a high-speed train entering a neon-lit megacity.',
  'Generate video of a startup team collaborating around holographic dashboards.',
  'Generate video of a calm forest path with particles floating in golden light.',
  'Generate video of a bustling marketplace in a floating city above clouds.',
  'Generate video of autonomous tractors working across a smart farm at dawn.',
  'Generate video of rain falling over a cyberpunk downtown street.',
  'Generate video of a satellite launch countdown and liftoff sequence.',
  'Generate video of an AI courtroom presenting evidence on interactive screens.',
  'Generate video of a mountain time-lapse from sunrise to starry night.',
  'Generate video of a spacecraft docking at a rotating orbital station.',
  'Generate video of a modern command center monitoring global emergencies.',
  'Generate video of a robot chef preparing food in a futuristic kitchen.',
  'Generate video of a cinematic desert convoy under a sandstorm.',
  'Generate video of a fantasy castle gate opening at twilight.',
  'Generate video of a close-up macro journey through electronic circuits.',
  'Generate video of a city intersection managed by autonomous traffic systems.',
  'Generate video of a museum hall where exhibits come alive with AR overlays.',
  'Generate video of snowfall over a cozy alpine village with warm windows.',
  'Generate video of a product launch stage with synchronized drone lights.',
  'Generate video of a medical robot assisting a surgeon in an operating room.',
  'Generate video of a storm rolling over a futuristic offshore wind farm.',
  'Generate video of a moon base crew tending crops in a dome greenhouse.',
  'Generate video of firefighters and drones controlling a wildfire edge.',
  'Generate video of a cinematic reveal of a luxury electric vehicle interior.',
  'Generate video of a data center wake-up sequence with power flowing lights.',
  'Generate video of a coastal rescue helicopter mission at golden hour.',
  'Generate video of a deep-sea submersible exploring glowing coral reefs.',
  'Generate video of a conference hall with multilingual AI live captions.',
  'Generate video of a city festival with projection mapping on skyscrapers.',
  'Generate video of a sunrise drone shot over a giant solar power plant.',
  'Generate video of an archaeology team scanning ruins with lidar drones.',
  'Generate video of a cinematic walk through a futuristic airport terminal.',
  'Generate video of a biotech lab where AI models animate on transparent glass.',
  'Generate video of a luxury hotel lobby with robots guiding guests.',
  'Generate video of a rapid weather map evolution over a continent.',
  'Generate video of autonomous delivery bots navigating a dense urban district.',
  'Generate video of an art gallery where paintings morph in real time.',
  'Generate video of a security operations center during a major live incident.',
  'Generate video of a cliffside road trip with cinematic camera movements.',
  'Generate video of a courtroom verdict moment with dramatic lighting.',
  'Generate video of a smart classroom where lessons transform into 3D scenes.',
  'Generate video of a wildfire recovery landscape blooming over seasons.',
  'Generate video of a futuristic city viewed from a flying taxi at dusk.',
  'Generate video of a national innovation summit opening sequence.',
];

export const QUICK_PROMPTS = [
  'Draft a strategic memo for national AI adoption in education.',
  'Summarize top risks in government chatbot deployment.',
  'Generate image of a modern smart city command center at sunset.',
];

export const CHAT_MODEL_OPTIONS: { key: ChatModelKey; label: string; description: string }[] = [
  { key: 'ultra', label: 'Cafa Ultra', description: 'Best quality (uses more compute)' },
  { key: 'smart', label: 'Cafa Smart', description: 'Balanced quality' },
  { key: 'swift', label: 'Cafa Swift', description: 'Light tasks and fast' },
];

export const CAFA_MODEL_LABELS: Record<ChatModelKey, string> = {
  ultra: 'Cafa Ultra',
  smart: 'Cafa Smart',
  swift: 'Cafa Swift',
};

export function mapUiModelToBackendModel(model: ChatModelKey) {
  if (model === 'ultra') return 'gpt-4o';
  return 'gpt-4o-mini';
}

export function resolveModelBadgeLabel(backendModel: string | undefined, requestedModel: ChatModelKey) {
  if (backendModel === 'gpt-4o') return CAFA_MODEL_LABELS.ultra;
  if (backendModel === 'gpt-4o-mini') return CAFA_MODEL_LABELS[requestedModel] ?? CAFA_MODEL_LABELS.smart;
  if (backendModel === 'cafa_ultra') return CAFA_MODEL_LABELS.ultra;
  if (backendModel === 'cafa_smart') return CAFA_MODEL_LABELS.smart;
  if (backendModel === 'cafa_swift') return CAFA_MODEL_LABELS.swift;
  return CAFA_MODEL_LABELS[requestedModel] ?? CAFA_MODEL_LABELS.smart;
}

export const GUEST_TTS_RATE = Platform.select({
  ios: 0.52,
  android: 0.86,
  default: 0.86,
});

export function getPromptTitle(prompt: string, fallbackTitle = 'New guest chat') {
  const trimmed = prompt.trim();
  if (!trimmed) return fallbackTitle;
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}...` : trimmed;
}

export function createIdempotencyKey(conversationId: string) {
  return `${conversationId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function extractImagePrompt(prompt: string) {
  const normalized = prompt.trim();
  if (!normalized) return null;

  const cleaned = normalized
    .replace(/^[\s,.:;!?-]+/, '')
    .replace(/[\s,.:;!?-]+$/, '');

  const imageNouns = '(?:image|picture|photo|illustration|artwork|render(?:ing)?|visual|wallpaper|poster)';
  const generationVerbs = '(?:generate|create|make|draw|design|produce|craft|render)';
  const politePrefix = '(?:(?:please|kindly)\\s+)?(?:(?:can|could|would)\\s+you\\s+)?';

  const patterns = [
    new RegExp(`^${politePrefix}${generationVerbs}\\s+(?:(?:me|us)\\s+)?(?:(?:an?|the)\\s+)?${imageNouns}\\s*(?:of|for|showing|that\\s+shows)?\\s+(.+)$`, 'i'),
    new RegExp(`^${politePrefix}(?:draw|render|illustrate|sketch)\\s+(.+)$`, 'i'),
    new RegExp(`^${politePrefix}(?:give\\s+me|show\\s+me|i\\s+want|i\\s+need|can\\s+i\\s+get|could\\s+i\\s+get)\\s+(?:(?:an?|the)\\s+)?${imageNouns}\\s*(?:of|for|showing)?\\s+(.+)$`, 'i'),
    new RegExp(`^(?:(?:an?|the)\\s+)?${imageNouns}\\s*(?:of|for|showing)?\\s+(.+)$`, 'i'),
    new RegExp(`^${politePrefix}(?:turn|convert|make)\\s+(?:this|that|it)\\s+(?:into|as)\\s+(?:(?:an?|the)\\s+)?${imageNouns}\\s*:?\\s+(.+)$`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1]
        .trim()
        .replace(/^["'`]+/, '')
        .replace(/["'`]+$/, '');
    }
  }

  return null;
}

export function extractVideoPrompt(prompt: string) {
  const normalized = prompt.trim();
  if (!normalized) return null;

  const cleaned = normalized
    .replace(/^[\s,.:;!?-]+/, '')
    .replace(/[\s,.:;!?-]+$/, '');

  const videoNouns = '(?:video|clip|animation|movie|footage|reel|short)';
  const generationVerbs = '(?:generate|create|make|produce|craft|render)';
  const politePrefix = '(?:(?:please|kindly)\\s+)?(?:(?:can|could|would)\\s+you\\s+)?';

  const patterns = [
    new RegExp(`^${politePrefix}${generationVerbs}\\s+(?:(?:me|us)\\s+)?(?:(?:an?|the)\\s+)?${videoNouns}\\s*(?:of|for|showing|that\\s+shows)?\\s+(.+)$`, 'i'),
    new RegExp(`^${politePrefix}(?:give\\s+me|show\\s+me|i\\s+want|i\\s+need|can\\s+i\\s+get|could\\s+i\\s+get)\\s+(?:(?:an?|the)\\s+)?${videoNouns}\\s*(?:of|for|showing)?\\s+(.+)$`, 'i'),
    new RegExp(`^(?:(?:an?|the)\\s+)?${videoNouns}\\s*(?:of|for|showing)?\\s+(.+)$`, 'i'),
    new RegExp(`^${politePrefix}(?:animate|turn|convert|make)\\s+(?:this|that|it)\\s+(?:into|as)\\s+(?:(?:a|the)\\s+)?${videoNouns}\\s*:?\\s+(.+)$`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1]
        .trim()
        .replace(/^["'`]+/, '')
        .replace(/["'`]+$/, '');
    }
  }

  return null;
}

export function isMediaGenerationPrompt(value: string) {
  return Boolean(extractImagePrompt(value) || extractVideoPrompt(value));
}
