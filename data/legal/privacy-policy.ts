import type { LegalDocument } from '@/types';

export const PRIVACY_POLICY_DOCUMENT: LegalDocument = {
  title: 'Privacy Policy',
  lastUpdated: 'April 26, 2026',
  intro: [
    'At Cafa AI, we are committed to respecting your privacy and protecting the personal information you share with us. This Privacy Policy describes what information we collect, how we use it, when we share it, and the choices you have, when you use our mobile application and its features (collectively, the "Service").',
    'By creating an account or using the Service, you agree to the data practices described in this policy.',
  ],
  sections: [
    {
      id: 'information-we-collect',
      heading: 'Information We Collect',
      paragraphs: [
        'We collect information you provide to us directly as well as information generated automatically through your use of the Service.',
        'Information you provide directly:',
      ],
      lists: [
        {
          kind: 'unordered',
          items: [
            'Account information: your name, email address, password, and other details you provide when registering.',
            'Profile and preferences: your chosen language, display theme, selected AI voice, and other personalization settings.',
            'Content you submit: text prompts, messages, uploaded images, uploaded documents, and voice recordings you provide to use our chat, image, video, or voice features.',
            'Support communications: the name, email, subject, and message content you submit when contacting us through the Help form.',
            'Payment information: billing details and transaction records collected by our payment processors on our behalf when you subscribe to a paid plan.',
          ],
        },
      ],
    },
    {
      id: 'information-from-use',
      heading: 'Information We Collect Automatically',
      paragraphs: [
        'When you access or interact with the Service, we and our service providers automatically collect certain technical information:',
      ],
      lists: [
        {
          kind: 'unordered',
          items: [
            'Log data: your IP address, the date and time of requests, error reports, and how you interact with the Service.',
            'Device information: device type, operating system, device identifiers, and app version.',
            'Usage data: features you access, actions you take (such as sending messages, generating images or videos, using voice), and feedback you submit on AI responses.',
            'Approximate location: we infer a general geographic region from your IP address for security purposes, such as detecting unusual account activity. We do not collect precise GPS location.',
            'Session and authentication data: tokens and session identifiers used to keep you securely signed in.',
          ],
        },
      ],
    },
    {
      id: 'how-we-use-information',
      heading: 'How We Use Your Information',
      paragraphs: [
        'We use the information we collect for the following purposes:',
      ],
      lists: [
        {
          kind: 'unordered',
          items: [
            'To provide, operate, and maintain the Service, including processing your prompts and delivering AI-generated responses, images, videos, and voice output.',
            'To personalize your experience, such as remembering your preferred AI model, language, and voice settings.',
            'To improve and develop the Service, including analyzing usage patterns and developing new features.',
            'To process your subscription, manage billing, and communicate with you about your account and plan.',
            'To respond to your support requests submitted through the Help page.',
            'To detect, prevent, and address fraud, abuse, security threats, and violations of our Terms of Service.',
            'To comply with applicable legal obligations and protect the rights, safety, and property of our users and Cafa AI.',
            'To send you service-related notices, such as updates to these policies or important changes to the Service.',
          ],
        },
      ],
    },
    {
      id: 'sharing',
      heading: 'How We Share Your Information',
      paragraphs: [
        'We do not sell your personal information. We share information only in the limited circumstances described below.',
      ],
      lists: [
        {
          kind: 'unordered',
          items: [
            'Service providers: We share information with trusted third-party vendors who help us operate the Service, including cloud infrastructure providers, AI model providers, payment processors (such as Stripe and Apple), customer support tools, and analytics services. These parties access your data only as necessary to perform their services for us.',
            'Business transfers: If Cafa AI is involved in a merger, acquisition, reorganization, or sale of assets, your information may be transferred as part of that transaction. We will provide notice before your information becomes subject to a different privacy policy.',
            'Legal requirements: We may disclose your information when required by law, a court order, or governmental authority, or when we have a good-faith belief that disclosure is necessary to protect the rights, property, or safety of Cafa AI, our users, or the public.',
            'Enforcement: We may share information with third parties when necessary to investigate or address suspected violations of our Terms of Service, fraud, or other illegal activity.',
            'With your consent: We may share information for other purposes with your explicit consent.',
          ],
        },
      ],
    },
    {
      id: 'retention',
      heading: 'Data Retention',
      paragraphs: [
        'We retain your personal information for as long as necessary to provide the Service and for other legitimate business purposes. Here is how that works in practice:',
      ],
      lists: [
        {
          kind: 'unordered',
          items: [
            'Information you control: You can delete individual chat conversations, generated images, and generated videos directly in the app. When you delete this content, it is removed from our systems promptly, subject to the exceptions below.',
            'Account deletion: If you request deletion of your account, we will remove your personal information within a reasonable period, except where retention is required as described below.',
            'Retention for safety and legal reasons: We may retain certain information for longer if your account was suspended for policy violations, if we are legally required to do so (for example, in response to a lawful legal process), or to resolve disputes and enforce our agreements.',
            'Billing records: We retain payment and transaction records as required for accounting, dispute resolution, and regulatory compliance, even after account deletion.',
            'Audit records: When you request deletion of personal data, we retain a record of that request to verify compliance.',
            'In determining how long to retain data, we consider the purpose of processing, the sensitivity of the information, the potential risk of harm from unauthorized use, and any applicable legal requirements.',
          ],
        },
      ],
    },
    {
      id: 'data-controls',
      heading: 'Your Controls and Choices',
      paragraphs: [
        'We give you meaningful control over your personal data. The following controls are available within the app:',
      ],
      lists: [
        {
          kind: 'unordered',
          items: [
            'Update your profile information, display name, and account email at any time in your account settings.',
            'Change your language, theme, and AI voice preferences in settings.',
            'Delete individual chat conversations, generated images, or generated videos directly from the relevant screens.',
            'Delete all saved images or all saved videos at once using the bulk-delete option on the Images and Videos screens.',
            'Request full account deletion by contacting us through the Help page.',
            'Opt out of non-essential communications by following the unsubscribe instructions in any email we send.',
          ],
        },
      ],
    },
    {
      id: 'your-rights',
      heading: 'Your Privacy Rights',
      paragraphs: [
        'Depending on where you live, you may have certain rights regarding your personal information. These may include:',
      ],
      lists: [
        {
          kind: 'unordered',
          items: [
            'The right to access the personal information we hold about you and to receive it in a portable format.',
            'The right to correct or update inaccurate personal information.',
            'The right to request deletion of your personal information.',
            'The right to restrict or object to certain types of processing.',
            'The right to withdraw consent where we rely on consent as the legal basis for processing.',
            'The right to lodge a complaint with your local data protection authority.',
          ],
        },
      ],
    },
    {
      id: 'rights-accuracy-note',
      heading: 'A Note on AI Output Accuracy',
      paragraphs: [
        'Cafa AI generates responses by predicting likely continuations based on your input. In some cases, AI-generated content may not be factually accurate, including content that references real people or events. If you believe AI-generated output within our Service contains inaccurate information about you and you would like to request a correction or removal, please contact us through the Help page in the app. We will consider your request based on applicable law and the technical capabilities of the Service.',
        'We do not sell your personal information and we do not use your data for targeted advertising or cross-contextual behavioral advertising.',
        'To exercise any of the rights listed above, please contact us through the Help page in the app. We may need to verify your identity before processing certain requests.',
      ],
    },
    {
      id: 'children',
      heading: "Children's Privacy",
      paragraphs: [
        'Cafa AI is not directed to children under 13, and we do not knowingly collect personal information from children under 13. If you are between 13 and 18, you must have a parent or guardian\'s permission to use the Service.',
        'If you believe a child under 13 has provided us with personal information without appropriate consent, please contact us through the Help page. We will investigate the matter and, where appropriate, delete the information from our systems.',
      ],
    },
    {
      id: 'security',
      heading: 'Security',
      paragraphs: [
        'We implement commercially reasonable technical, administrative, and organizational safeguards designed to protect your personal information from unauthorized access, disclosure, alteration, loss, or destruction.',
        'These measures include encrypted data transmission, authenticated API access, and secure credential storage. However, no system is completely secure, and we cannot guarantee the absolute security of your information. You should take care to protect your account credentials and notify us promptly if you suspect unauthorized access.',
      ],
    },
    {
      id: 'international',
      heading: 'International Data Processing',
      paragraphs: [
        'Cafa AI operates globally, and your personal information may be processed and stored on servers located in countries other than your own, including the United States. Data protection laws vary by country. Regardless of where your data is processed, we apply the protections described in this Privacy Policy and transfer data only through legally recognized mechanisms.',
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to This Policy',
      paragraphs: [
        'We may update this Privacy Policy from time to time to reflect changes in our practices, the Service, or applicable law. When we make material changes, we will update the effective date shown at the top of this policy and, where appropriate, notify you through the app or by email.',
        'Your continued use of the Service after any update constitutes your acceptance of the revised policy.',
      ],
    },
    {
      id: 'contact',
      heading: 'Contact Us',
      paragraphs: [
        'If you have questions, concerns, or requests related to this Privacy Policy or your personal information, please reach out through the Help page contact form in the app. We will do our best to respond promptly.',
      ],
    },
  ],
};

