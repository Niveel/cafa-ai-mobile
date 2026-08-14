import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PRIVACY_HEADINGS = new Set([
  'Information We Collect', 'How We Collect Information', 'How We Use Information',
  'AI Features, Model Use, Moderation, and Automated Processing', 'Live AI Voice Conversations',
  'AI Avatars and Video Generation', 'Voice Cloning',
  'AI-Content Detection, Similarity Checks, and Humanization',
  'Consent, Rights, and Misuse Prevention for Voice and Avatar Content', 'iOS and iPadOS Data Practices',
  'Apple Device Permissions', 'Microphone, Speech Recognition, Camera, and Photos',
  'Apple Sign-In and Private Relay', 'Apple App Store Purchases and Subscriptions',
  'Tracking, Advertising, and Apple Identifiers', 'On-Device Processing and Apple Services',
  'App Privacy Information and Third-Party SDKs', 'iOS Privacy Choices and Account Deletion',
  'How We Disclose Information', 'Cookies, SDKs, and Similar Technologies',
  'International Data Transfers', 'Data Retention', 'Security', 'Your Rights and Choices',
  'Children’s Privacy', 'Third-Party Services, APIs, and Links', 'Changes to This Privacy Policy', 'Contact Us',
]);

const TERMS_HEADINGS = new Set([
  'Acceptance and scope', 'Apple App Store and iOS application terms', 'Agreement with Cafa AI, not Apple',
  'iOS licence', 'Maintenance and support', 'Product claims and warranties', 'Intellectual-property claims',
  'Apple in-app purchases and subscriptions', 'Device permissions and iOS features', 'Third-party terms',
  'Legal compliance', 'Apple as third-party beneficiary', 'iOS support contact', 'Eligibility and children',
  'Accounts, registration, and security', 'License and permitted use', 'Prohibited uses',
  'User content and AI-generated output', 'Consent, likeness, and disclosure obligations',
  'AI-content detection, plagiarism checks, and humanization', 'Voice cloning and synthetic voices',
  'AI avatars and avatar video generation', 'Live AI voice interactions', 'Moderation, safety, and reporting',
  'Intellectual property', 'Privacy and data processing', 'Security',
  'Third-party services, APIs, and external platforms', 'Fees, subscriptions, billing, and refunds',
  'Beta, preview, and experimental features', 'Feedback', 'Accessibility', 'Disclaimers of warranties',
  'Feature-specific disclaimers', 'Limitation of liability', 'Indemnification', 'Suspension and termination',
  'Governing law and dispute resolution', 'Export controls and sanctions',
  'Changes to the Services and these Terms', 'Miscellaneous', 'Contact and support',
]);

function readLegalFile(fileName) {
  const raw = readFileSync(resolve(root, 'docs', 'legal', fileName), 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .trim();
  const lines = raw.split('\n');
  const title = lines.shift()?.trim() ?? '';
  const effectiveDateIndex = lines.findIndex((line) => /^Effective Date:/i.test(line.trim()));
  const dateBlock = effectiveDateIndex >= 0 ? lines[effectiveDateIndex].trim().match(/^Effective Date:\s*(.+)$/i) : null;
  const lastUpdated = dateBlock ? dateBlock[1] : '';
  if (effectiveDateIndex >= 0) lines.splice(0, effectiveDateIndex + 1);

  const headings = fileName.includes('Privacy Policy') ? PRIVACY_HEADINGS : TERMS_HEADINGS;
  const intro = [];
  const sections = [];
  let currentSection = null;
  let paragraphLines = [];
  const flushParagraph = () => {
    const paragraph = paragraphLines.join('\n').trim();
    paragraphLines = [];
    if (!paragraph) return;
    if (currentSection) currentSection.paragraphs.push(paragraph);
    else intro.push(paragraph);
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (headings.has(line)) {
      flushParagraph();
      currentSection = {
        id: `section-${sections.length + 1}`,
        heading: line,
        paragraphs: [],
      };
      sections.push(currentSection);
    } else if (!line) {
      flushParagraph();
    } else {
      paragraphLines.push(line);
    }
  }
  flushParagraph();

  return {
    title,
    lastUpdated,
    intro,
    sections,
  };
}

function serialize(name, document) {
  return `export const ${name}: LegalDocument = ${JSON.stringify(document, null, 2)};\n`;
}

const androidPrivacy = readLegalFile('Cafa AI Privacy Policy updated.txt');
const iosPrivacy = readLegalFile('Cafa AI Privacy Policy for ios.txt');
const androidTerms = readLegalFile('Cafa AI Terms and Conditions - Updated.txt');
const iosTerms = readLegalFile('Cafa AI Terms and Conditions for ios.txt');

writeFileSync(
  resolve(root, 'data', 'legal', 'privacy-policy.ts'),
  `// Generated from docs/legal by npm run generate:legal. Do not edit manually.\n\nimport type { LegalDocument } from '@/types';\n\n${serialize('ANDROID_AND_WEB_PRIVACY_POLICY_DOCUMENT', androidPrivacy)}\n${serialize('IOS_PRIVACY_POLICY_DOCUMENT', iosPrivacy)}\nexport const PRIVACY_POLICY_DOCUMENT = ANDROID_AND_WEB_PRIVACY_POLICY_DOCUMENT;\n\nexport function getPrivacyPolicyDocument(platform: 'ios' | 'android' | 'web' | string): LegalDocument {\n  return platform === 'ios' ? IOS_PRIVACY_POLICY_DOCUMENT : ANDROID_AND_WEB_PRIVACY_POLICY_DOCUMENT;\n}\n`,
);

writeFileSync(
  resolve(root, 'data', 'legal', 'terms-of-service.ts'),
  `// Generated from docs/legal by npm run generate:legal. Do not edit manually.\n\nimport type { LegalDocument } from '@/types';\n\n${serialize('ANDROID_AND_WEB_TERMS_OF_SERVICE_DOCUMENT', androidTerms)}\n${serialize('IOS_TERMS_OF_SERVICE_DOCUMENT', iosTerms)}\nexport const TERMS_OF_SERVICE_DOCUMENT = ANDROID_AND_WEB_TERMS_OF_SERVICE_DOCUMENT;\n\nexport function getTermsOfServiceDocument(platform: 'ios' | 'android' | 'web' | string): LegalDocument {\n  return platform === 'ios' ? IOS_TERMS_OF_SERVICE_DOCUMENT : ANDROID_AND_WEB_TERMS_OF_SERVICE_DOCUMENT;\n}\n`,
);

console.log('Generated Android/web and iOS legal documents from docs/legal.');
