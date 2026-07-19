import { Platform } from 'react-native';
import type { AppLanguage } from '@/config';
import { ChatModelKey } from './types';

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

export const STARTER_PROMPTS_PER_CHAT = 3;

export const STARTER_PROMPT_POOL = [
  'Plan a productive day for me in 30-minute blocks.',
  'Rewrite this message to sound confident but friendly.',
  'Give me a 10-minute workout with no equipment.',
  'Summarize this topic like I am a beginner.',
  'Create a weekly meal plan on a budget.',
  'Help me brainstorm 20 business name ideas.',
  'Turn my notes into a polished email.',
  'Explain this concept using a real-life analogy.',
  'Give me a step-by-step study plan for this week.',
  'Draft a professional follow-up message after an interview.',
  'Suggest a simple evening routine for better sleep.',
  'Create a packing checklist for a 5-day trip.',
  'Help me set SMART goals for this month.',
  'Write a short social post about my new project.',
  'Generate 5 hooks for a YouTube video idea.',
  'Turn this rough outline into a presentation structure.',
  'Help me practice for a difficult conversation.',
  'Create a beginner-friendly budget tracker template.',
  'Suggest 10 healthy snacks I can prep quickly.',
  'Rewrite this paragraph to be more concise.',
  'Give me a one-week plan to improve my speaking skills.',
  'Help me break this big task into smaller steps.',
  'Create a checklist for launching a side project.',
  'Teach me the basics of investing in plain language.',
  'Write a polite way to decline a request.',
  'Generate interview questions for this role.',
  'Help me choose between two options with pros and cons.',
  'Create a travel itinerary for a weekend city trip.',
  'Give me a quick daily journal template.',
  'Make this resume bullet stronger and measurable.',
  'Suggest a simple skincare routine for busy mornings.',
  'Help me prepare talking points for a team meeting.',
  'Create a content calendar for 2 weeks.',
  'Give me 15 creative ideas for Instagram reels.',
  'Turn this long text into key bullet points.',
  'Help me write a clear project status update.',
  'Create a study guide from this chapter summary.',
  'Suggest ways to reduce screen time at night.',
  'Draft a kind apology message that sounds sincere.',
  'Give me a minimalist morning routine.',
  'Help me create a portfolio project idea.',
  'Write a short product description for this item.',
  'Plan a no-stress weekend reset routine.',
  'Suggest 10 prompts for practicing English conversation.',
  'Create a simple habit tracker I can use daily.',
  'Help me improve this caption for higher engagement.',
  'Give me questions to ask before accepting a job offer.',
  'Turn this goal into a 7-day action plan.',
  'Create a structured plan to learn a new skill fast.',
  'Help me write a clear and respectful boundary message.',
] as const;

const LOCALIZED_STARTER_PROMPT_POOLS: Partial<Record<AppLanguage, readonly string[]>> = {
  es: [
    'Planifica un dia productivo para mi en bloques de 30 minutos.',
    'Reescribe este mensaje para que suene seguro pero amable.',
    'Dame una rutina de ejercicio de 10 minutos sin equipo.',
    'Resume este tema como si fuera principiante.',
    'Crea un plan semanal de comidas economico.',
    'Ayudame a generar 20 ideas de nombres para un negocio.',
    'Convierte mis notas en un correo profesional.',
    'Explica este concepto con una analogia de la vida real.',
    'Dame un plan de estudio paso a paso para esta semana.',
    'Crea una lista de equipaje para un viaje de 5 dias.',
    'Ayudame a dividir esta gran tarea en pasos pequenos.',
    'Convierte este objetivo en un plan de accion de 7 dias.',
  ],
  fr: [
    'Planifie-moi une journee productive par tranches de 30 minutes.',
    'Reecris ce message avec un ton assure mais aimable.',
    'Propose-moi un entrainement de 10 minutes sans materiel.',
    'Resume ce sujet comme si je debutais.',
    'Cree un menu hebdomadaire economique.',
    'Aide-moi a trouver 20 idees de noms pour une entreprise.',
    'Transforme mes notes en un e-mail professionnel.',
    'Explique ce concept avec une analogie de la vie quotidienne.',
    'Donne-moi un programme de revision etape par etape pour cette semaine.',
    'Cree une liste de bagages pour un voyage de 5 jours.',
    'Aide-moi a diviser cette grande tache en petites etapes.',
    'Transforme cet objectif en plan d action sur 7 jours.',
  ],
  pt: [
    'Planeje um dia produtivo para mim em blocos de 30 minutos.',
    'Reescreva esta mensagem para soar confiante, mas amigavel.',
    'Crie um treino de 10 minutos sem equipamentos.',
    'Resuma este assunto como se eu fosse iniciante.',
    'Crie um plano semanal de refeicoes economico.',
    'Ajude-me a pensar em 20 nomes para um negocio.',
    'Transforme minhas anotacoes em um e-mail profissional.',
    'Explique este conceito usando uma analogia da vida real.',
    'Crie um plano de estudos passo a passo para esta semana.',
    'Crie uma lista de bagagem para uma viagem de 5 dias.',
    'Ajude-me a dividir esta tarefa grande em etapas menores.',
    'Transforme este objetivo em um plano de acao de 7 dias.',
  ],
};

export function getStarterPromptPool(language: AppLanguage) {
  return LOCALIZED_STARTER_PROMPT_POOLS[language] ?? STARTER_PROMPT_POOL;
}

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

  if (/\b(?:turn|convert|make|transform|animate)\b[\s\S]*\b(?:into|as)\s+(?:a\s+|the\s+)?(?:video|clip|animation|movie|footage|reel|short)\b/i.test(cleaned)) {
    return null;
  }

  const imageNouns = '(?:image|picture|photo|illustration|artwork|render(?:ing)?|visual|wallpaper|poster)';
  const generationVerbs = '(?:generate|create|make|draw|design|produce|craft|render)';
  const descriptorWords = '(?:(?:[a-z0-9-]+\\s+){0,3})';
  const politePrefix = '(?:(?:please|kindly)\\s+)?(?:(?:can|could|would)\\s+you\\s+)?';

  const patterns = [
    new RegExp(`^${politePrefix}${generationVerbs}\\s+(?:(?:me|us)\\s+)?(?:(?:an?|the)\\s+)?${descriptorWords}${imageNouns}\\s*(?:of|for|showing|that\\s+shows)?\\s+(.+)$`, 'i'),
    new RegExp(`^${politePrefix}(?:draw|render|illustrate|sketch)\\s+(.+)$`, 'i'),
    new RegExp(`^${politePrefix}(?:give\\s+me|show\\s+me|i\\s+want|i\\s+need|can\\s+i\\s+get|could\\s+i\\s+get)\\s+(?:(?:an?|the)\\s+)?${descriptorWords}${imageNouns}\\s*(?:of|for|showing)?\\s+(.+)$`, 'i'),
    new RegExp(`^(?:(?:an?|the)\\s+)?${descriptorWords}${imageNouns}\\s*(?:of|for|showing)?\\s+(.+)$`, 'i'),
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

export function isLikelyImageGenerationIntent(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return false;

  const hasImageNoun =
    /\b(image|picture|photo|illustration|artwork|render|rendering|visual|wallpaper|poster|chart|graph|diagram|infographic)\b/.test(normalized);
  const hasGenerationVerb = /\b(generate|create|make|draw|design|produce|craft|render|illustrate|sketch)\b/.test(normalized);
  const hasQuestionLead = /^(what|why|how|when|where|who|which|can you|could you|would you|is|are|do|does|did)\b/.test(normalized);
  const startsLikeCreativePrompt =
    /^(a|an|the)\s+/.test(normalized)
    || /^(bar|line|pie|area|scatter)\s+chart\b/.test(normalized)
    || /^(graph|diagram|infographic)\b/.test(normalized);

  if (hasQuestionLead) return false;
  return hasImageNoun && (hasGenerationVerb || startsLikeCreativePrompt);
}

export function extractVideoPrompt(prompt: string) {
  const normalized = prompt.trim();
  if (!normalized) return null;

  const cleaned = normalized
    .replace(/^[\s,.:;!?-]+/, '')
    .replace(/[\s,.:;!?-]+$/, '');

  if (/^(?:(?:please|kindly)\s+)?(?:(?:can|could|would)\s+you\s+)?(?:turn|convert|make|transform|animate)\s+(?:this|that|it)(?:\s+(?:image|picture|photo))?\s+(?:into|as)\s+(?:(?:a|the)\s+)?(?:video|clip|animation|movie|footage|reel|short)\s*$/i.test(cleaned)) {
    return cleaned;
  }

  const videoNouns = '(?:video|clip|animation|movie|footage|reel|short)';
  const generationVerbs = '(?:generate|create|make|produce|craft|render|turn|convert|transform|animate)';
  const descriptorWords = '(?:(?:[a-z0-9-]+\\s+){0,3})';
  const politePrefix = '(?:(?:please|kindly)\\s+)?(?:(?:can|could|would)\\s+you\\s+)?';

  const patterns = [
    new RegExp(`^${politePrefix}${generationVerbs}\\s+(?:(?:me|us)\\s+)?(?:(?:an?|the)\\s+)?${descriptorWords}${videoNouns}\\s*(?:of|for|showing|that\\s+shows|from)?\\s+(.+)$`, 'i'),
    new RegExp(`^${politePrefix}(?:give\\s+me|show\\s+me|i\\s+want|i\\s+need|can\\s+i\\s+get|could\\s+i\\s+get)\\s+(?:(?:an?|the)\\s+)?${descriptorWords}${videoNouns}\\s*(?:of|for|showing|from)?\\s+(.+)$`, 'i'),
    new RegExp(`^(?:(?:an?|the)\\s+)?${descriptorWords}${videoNouns}\\s*(?:of|for|showing|from)?\\s+(.+)$`, 'i'),
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

export function isLikelyVideoGenerationIntent(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return false;
  const hasVideoNoun = /\b(video|clip|animation|movie|footage|reel|short)\b/.test(normalized);
  const hasGenerationVerb = /\b(generate|create|make|produce|craft|render|animate|turn|convert|transform)\b/.test(normalized);
  return hasVideoNoun && hasGenerationVerb;
}

export function isMediaGenerationPrompt(value: string) {
  return Boolean(extractImagePrompt(value) || extractVideoPrompt(value));
}
