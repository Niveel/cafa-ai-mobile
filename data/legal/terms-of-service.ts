import type { LegalDocument } from '@/types';

export const TERMS_OF_SERVICE_DOCUMENT: LegalDocument = {
  title: 'Terms of Service',
  lastUpdated: 'March 30, 2026',
  intro: [
    'These Terms of Service govern your access to and use of Cafa AI.',
    'By using the service, you agree to these terms. If you do not agree, do not use the service.',
  ],
  sections: [
    {
      id: 'eligibility',
      heading: 'Eligibility and Accounts',
      lists: [
        {
          kind: 'unordered',
          items: [
            'You must provide accurate account information.',
            'You are responsible for safeguarding your credentials.',
            'You are responsible for activity under your account.',
            'You must be at least the age required by applicable law in your jurisdiction.',
          ],
        },
      ],
    },
    {
      id: 'acceptable-use',
      heading: 'Acceptable Use',
      paragraphs: ['You agree not to misuse the service or attempt to disrupt platform operations.'],
      lists: [
        {
          kind: 'unordered',
          items: [
            'Do not use the service for unlawful, harmful, or abusive activities.',
            'Do not attempt unauthorized access to systems or data.',
            'Do not interfere with security, rate limits, or service integrity.',
            'Do not upload content you do not have rights to use.',
          ],
        },
      ],
    },
    {
      id: 'content',
      heading: 'User Content and Generated Output',
      paragraphs: [
        'You retain ownership of the content you submit, subject to rights needed for us to operate the service.',
        'You are responsible for reviewing generated output and verifying accuracy before relying on it.',
      ],
    },
    {
      id: 'subscriptions',
      heading: 'Subscriptions and Billing',
      lists: [
        {
          kind: 'unordered',
          items: [
            'Paid plans may renew automatically unless canceled.',
            'Fees are billed according to the plan selected at checkout.',
            'Usage limits and feature access vary by plan.',
            'Taxes and third-party payment terms may apply.',
          ],
        },
      ],
    },
    {
      id: 'service-availability',
      heading: 'Service Availability',
      paragraphs: [
        'We may modify, suspend, or discontinue features at any time.',
        'We do not guarantee uninterrupted or error-free service.',
      ],
    },
    {
      id: 'termination',
      heading: 'Suspension and Termination',
      paragraphs: [
        'We may suspend or terminate access if you violate these terms, create security risk, or misuse the platform.',
        'You may stop using the service at any time and may request account deletion where supported.',
      ],
    },
    {
      id: 'disclaimers',
      heading: 'Disclaimers',
      paragraphs: [
        'The service is provided on an "as is" and "as available" basis to the fullest extent permitted by law.',
        'We disclaim warranties including merchantability, fitness for a particular purpose, and non-infringement.',
      ],
    },
    {
      id: 'liability',
      heading: 'Limitation of Liability',
      paragraphs: [
        'To the maximum extent permitted by law, Cafa AI is not liable for indirect, incidental, special, consequential, or punitive damages.',
        'Our aggregate liability is limited to amounts paid by you for the service in the period allowed by applicable law.',
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to These Terms',
      paragraphs: [
        'We may update these terms from time to time. Continued use after updates means you accept the revised terms.',
      ],
    },
    {
      id: 'contact',
      heading: 'Contact',
      paragraphs: ['For questions about these terms, use the Help page contact form in the app.'],
    },
  ],
};

