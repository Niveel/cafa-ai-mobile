import type { LegalDocument } from '@/types';

export const PRIVACY_POLICY_DOCUMENT: LegalDocument = {
  title: 'Privacy Policy',
  lastUpdated: 'March 30, 2026',
  intro: [
    'This Privacy Policy explains how Cafa AI collects, uses, and protects personal information when you use our services.',
    'By using the product, you agree to the data practices described in this policy.',
  ],
  sections: [
    {
      id: 'information-we-collect',
      heading: 'Information We Collect',
      paragraphs: ['We collect information you provide directly and information generated through your use of the platform.'],
      lists: [
        {
          kind: 'unordered',
          items: [
            'Account data such as name, email, and authentication details.',
            'Profile preferences such as language, personalization, and voice settings.',
            'Content data including prompts, messages, generated outputs, and uploaded files.',
            'Billing and subscription metadata provided by payment providers.',
            'Technical usage data such as device, browser, logs, and feature usage events.',
          ],
        },
      ],
    },
    {
      id: 'how-we-use-information',
      heading: 'How We Use Information',
      lists: [
        {
          kind: 'unordered',
          items: [
            'To operate, maintain, and improve the service.',
            'To authenticate users and protect account security.',
            'To provide support and respond to inquiries.',
            'To process subscriptions, billing, and service communications.',
            'To monitor reliability, prevent abuse, and enforce platform policies.',
          ],
        },
      ],
    },
    {
      id: 'sharing',
      heading: 'How We Share Information',
      paragraphs: [
        'We do not sell personal information. We may share limited data with trusted service providers that help us run the platform.',
      ],
      lists: [
        {
          kind: 'unordered',
          items: [
            'Infrastructure and hosting providers.',
            'Payment and billing processors.',
            'Customer support and operational tools.',
            'Legal authorities when required by law or to protect rights and safety.',
          ],
        },
      ],
    },
    {
      id: 'retention',
      heading: 'Data Retention',
      paragraphs: [
        'We retain personal data for as long as needed to provide services, comply with legal obligations, resolve disputes, and enforce agreements.',
        'You may request deletion of your account. Deletion requests are processed subject to legal and operational requirements.',
      ],
    },
    {
      id: 'security',
      heading: 'Security',
      paragraphs: [
        'We use reasonable administrative, technical, and organizational safeguards to protect personal information.',
        'No method of transmission or storage is fully secure, so we cannot guarantee absolute security.',
      ],
    },
    {
      id: 'your-rights',
      heading: 'Your Rights and Choices',
      lists: [
        {
          kind: 'unordered',
          items: [
            'Access and update your profile information.',
            'Manage personalization and communication preferences.',
            'Request account deletion where available.',
            'Contact us to request information about your data.',
          ],
        },
      ],
    },
    {
      id: 'children',
      heading: "Children's Privacy",
      paragraphs: [
        'Our services are not directed to children under 13, and we do not knowingly collect personal information from children under 13.',
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to This Policy',
      paragraphs: [
        'We may update this Privacy Policy from time to time. If we make material changes, we will update the effective date and provide notice where appropriate.',
      ],
    },
    {
      id: 'contact',
      heading: 'Contact',
      paragraphs: [
        'For privacy-related requests or questions, please use the Help page contact form in the app.',
      ],
    },
  ],
};

