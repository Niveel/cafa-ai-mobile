export type ChatSummary = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
};

export const mockChats: ChatSummary[] = [
  { id: 'chat-1', title: 'Growth Strategy Brainstorm', preview: 'Let us map a 30-day growth sprint.', updatedAt: '2m ago' },
  { id: 'chat-2', title: 'Landing Page Copy', preview: 'Write hero copy for Cafa AI mobile.', updatedAt: '9m ago' },
  { id: 'chat-3', title: 'Brand Tone Guide', preview: 'Define concise yet premium tone rules.', updatedAt: '21m ago' },
  { id: 'chat-4', title: 'Subscription Tier UX', preview: 'Compare free, smart, pro, and max moments.', updatedAt: '35m ago' },
  { id: 'chat-5', title: 'Onboarding Flow', preview: 'Design a 3-step onboarding experience.', updatedAt: '1h ago' },
  { id: 'chat-6', title: 'Image Generation Prompting', preview: 'Improve image prompt presets and tags.', updatedAt: '2h ago' },
  { id: 'chat-7', title: 'Voice Mode Interactions', preview: 'Tune transcription and playback controls.', updatedAt: '3h ago' },
  { id: 'chat-8', title: 'Bug Triage Session', preview: 'Prioritize regressions from QA report.', updatedAt: '5h ago' },
  { id: 'chat-9', title: 'Roadmap Planning Q2', preview: 'Sequence milestones for mobile parity.', updatedAt: 'Yesterday' },
  { id: 'chat-10', title: 'Investor Update Draft', preview: 'Summarize traction, product, and KPIs.', updatedAt: 'Yesterday' },
  { id: 'chat-11', title: 'Accessibility Audit Notes', preview: 'List high-priority WCAG fixes.', updatedAt: '2d ago' },
  { id: 'chat-12', title: 'Backend API Mapping', preview: 'Align endpoints across web and mobile.', updatedAt: '3d ago' },
];
