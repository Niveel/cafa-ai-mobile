import type { LegalDocument } from '@/types';

export const PRIVACY_POLICY_DOCUMENT: LegalDocument = {
  title: 'Privacy Policy for Cafa AI',
  lastUpdated: 'July 17, 2026',
  intro: [
    'Cafa AI respects your privacy.',
    'This Privacy Policy explains how Cafa AI collects, uses, stores, discloses, retains, and protects personal data and other information when you use the Cafa AI website, mobile applications, guest mode, accounts, subscriptions, chats, research features, image and video generation tools, voice features, artifacts, uploads, generated outputs, support channels, and related services (together, the "Services").',
    'This Privacy Policy applies to the official Cafa AI Services, including the website at https://www.cafaai.com/ and the official Cafa AI mobile apps.',
    'By accessing or using the Services, you acknowledge that your information may be handled as described in this Privacy Policy.',
  ],
  sections: [
    {
      id: 'information-we-collect',
      heading: 'Information We Collect',
      paragraphs: [
        'We collect information you provide directly to us, information collected automatically when you use the Services, information received from third parties, and information created or inferred through your use of AI features.',
        'Information you provide directly. Depending on how you use Cafa AI, we may collect information such as your full name, username, email address, password, phone number, profile information, preferences, billing or contact address if you provide one, support requests, feedback, survey responses, and communications with us. If you create an account, subscribe, contact support, answer prompts, or fill in forms, you may provide this information directly to us.',
        'Subscription, billing, and purchase information. If you subscribe to a paid plan or make a purchase, we may collect or receive payment-related and billing-related information such as your plan, transaction status, purchase history, renewal status, currency, country, app-store purchase confirmations, and other subscription metadata. Depending on how you purchase, payment processing may be handled by an app store or payment processor.',
        'AI inputs and outputs. Cafa AI is an AI assistant that may support chatting, researching, image and video generation, voice-related features, artifacts, files, charts, and other generated content. We may collect your prompts, instructions, chat history, messages, searches, files, documents, photos, images, videos, audio, voice recordings, metadata, and other content you upload or submit to the Services. We may also store outputs generated for you, including text, summaries, images, videos, audio, charts, structured documents, and related metadata.',
        'Usage, device, technical, and diagnostic information. We may collect information such as IP address, device identifiers, advertising or analytics identifiers where used, device model, operating system, browser type, app version, language, time zone, crash logs, performance data, diagnostics, session history, feature usage, app interactions, search history, cookie or local-storage identifiers, and similar technical information.',
        'Location information. Depending on the feature you use and your device settings, we may collect approximate location, locale, region, or time-zone-based information to help provide local or regional answers, real-time information, fraud prevention, personalization, or compliance.',
        'Information from third parties. We may receive information from app stores, payment processors, hosting and infrastructure providers, analytics and crash-reporting providers, communications vendors, identity or sign-in providers, security and fraud-prevention providers, ad or measurement providers if used, and other third-party services that help us operate the Services. We may also receive publicly available information or results from third-party websites, APIs, or data sources when you ask Cafa AI to retrieve, summarize, or work with that information.',
      ],
    },
    {
      id: 'how-we-collect-information',
      heading: 'How We Collect Information',
      paragraphs: [
        'We collect information in several ways:',
      ],
      lists: [
        {
          kind: 'unordered',
          items: [
            'Directly from you. We collect information when you create an account, use guest mode, subscribe, chat with the AI, upload content, contact support, change settings, or otherwise interact with the Services.',
            'Automatically. We collect certain technical and usage information automatically through the website, app, operating system tools, cookies, SDKs, logs, local storage, analytics tools, security tools, and similar technologies.',
            'From third parties. We collect certain information from app stores, payment processors, security providers, analytics providers, communications providers, identity providers, and other partners that support the Services.',
          ],
        },
      ],
    },
    {
      id: 'how-we-use-information',
      heading: 'How We Use Information',
      paragraphs: [
        'We may use the information we collect for the following purposes:',
      ],
      lists: [
        {
          kind: 'unordered',
          items: [
            'to provide, run, maintain, support, and improve the Services;',
            'to create and manage accounts;',
            'to authenticate users and secure accounts;',
            'to enable guest mode and session continuity;',
            'to process subscriptions, billing, renewals, and purchase confirmations;',
            'to provide AI outputs and related features such as chatting, researching, image and video generation, voice features, artifacts, charts, files, summaries, and structured documents;',
            'to personalize responses, recommendations, workflows, and user experience;',
            'to remember your history, preferences, and context where that functionality is offered;',
            'to process uploaded documents, images, audio, video, and other files;',
            'to respond to support requests, legal notices, and account requests;',
            'to communicate with you about updates, service information, security messages, billing, product changes, and, where permitted, marketing;',
            'to detect, prevent, investigate, and respond to abuse, fraud, harmful activity, policy violations, and security incidents;',
            'to moderate unlawful, harmful, inappropriate, abusive, or explicit content;',
            'to analyze usage, measure performance, diagnose errors, and improve reliability;',
            'to improve, evaluate, personalize, and, where applicable, train or refine AI systems, safety systems, and related features;',
            'to create aggregated or de-identified insights;',
            'and to comply with applicable law, enforce our terms and policies, protect rights and safety, and resolve disputes.',
          ],
        },
      ],
    },
    {
      id: 'ai-features-model-use-moderation-and-automated-processing',
      heading: 'AI Features, Model Use, Moderation, and Automated Processing',
      paragraphs: [
        'Cafa AI uses automated systems and AI models to process your inputs and generate outputs.',
        'This may include text generation, image generation, video generation, voice-related processing, document structuring, charts, summaries, and other responses.',
        'We may store and use prompts, chats, uploads, outputs, feedback, and related metadata to operate the Services, maintain chat history, provide continuity, personalize the user experience, moderate harmful content, improve safety, evaluate quality, support users, and improve or train AI-related systems.',
        'If we offer settings that let you limit retention, personalization, or model-improvement uses, those settings will apply as described in the product.',
        'If you do not see a setting and want to make a request, you may contact us at Cafaai@niveel.com.',
        'Because Cafa AI may be used for topics such as health, finance, legal, education, relationships, and other sensitive areas, your prompts and uploads may contain sensitive information.',
        'Please do not submit sensitive personal data, or another person\'s personal data, unless it is necessary and you have the right to do so.',
        'We may use automated tools and, where needed, human review to detect abuse, harmful content, policy violations, fraud, security threats, and system misuse.',
        'Cafa AI is not designed to make solely automated decisions that produce legal or similarly significant effects about users.',
        'If that changes, we will provide any additional notice, safeguards, and rights required by applicable law.',
      ],
    },
    {
      id: 'how-we-disclose-information',
      heading: 'How We Disclose Information',
      paragraphs: [
        'We may disclose information in the following situations:',
      ],
      lists: [
        {
          kind: 'unordered',
          items: [
            'Service providers and processors. We may disclose information to vendors and service providers that help us run the Services, such as providers of hosting, cloud infrastructure, storage, analytics, crash reporting, customer support, communications, payment processing, moderation, security, authentication, advertising or measurement, and related technical operations.',
            'Affiliates and corporate transactions. We may disclose information to affiliates, parents, subsidiaries, or related entities under common control, and in connection with a merger, acquisition, financing, reorganization, asset sale, or similar corporate transaction.',
            'App stores and payment platforms. If you subscribe or purchase through an app store or payment platform, we may receive and disclose information needed to verify purchases, manage subscriptions, process refunds, and comply with platform rules.',
            'Legal, safety, and rights protection. We may disclose information if we believe doing so is necessary to comply with law, court order, legal process, or lawful governmental request, or to investigate abuse, enforce our policies, protect users, protect our rights, or respond to security or fraud risks.',
            'At your direction or with your consent. We may disclose information when you choose to share outputs, publish content, collaborate with others, link third-party services, or otherwise instruct us to disclose data.',
            'Advertising and marketing providers where used. If Cafa AI displays ads, measures campaign performance, or uses advertising or marketing technologies, certain usage, device, approximate location, or identifier data may be processed by those providers, subject to your settings and applicable law.',
          ],
        },
      ],
    },
    {
      id: 'how-we-disclose-information-note',
      heading: '',
      paragraphs: [
        'We do not sell your personal content to third parties.',
      ],
    },
    {
      id: 'cookies-sdks-and-similar-technologies',
      heading: 'Cookies, SDKs, and Similar Technologies',
      paragraphs: [
        'Our website and apps may use cookies, pixels, local storage, log files, device identifiers, and similar technologies to operate the Services, remember settings, keep users signed in, secure sessions, measure performance, analyze traffic, troubleshoot errors, personalize features, and, where applicable, support advertising or marketing measurement.',
        'Some cookies or similar technologies are necessary to provide the Services and keep them secure.',
        'Other cookies or similar technologies, such as analytics or advertising technologies, may be optional under applicable law.',
        'Where required, we will ask for your consent before using non-essential cookies or similar technologies.',
        'You can also manage certain choices through your browser, operating-system settings, in-app settings, or any cookie banner or privacy settings page we provide.',
        'On Android, if you opt in, Cafa AI uses the TikTok App Events SDK to report limited advertising-measurement events such as registration and subscription. We do not include chats, prompts, generated media, email addresses, phone numbers, or payment details in those events. You can change this choice in Settings under Data controls.',
      ],
    },
    {
      id: 'international-data-transfers',
      heading: 'International Data Transfers',
      paragraphs: [
        'Cafa AI may process and store information in countries where we or our service providers operate.',
        'Because the Services are available online and may be used worldwide, your information may be transferred to, stored in, or accessed from countries outside your state, province, or country of residence.',
        'Where required by applicable law, we use appropriate safeguards for international data transfers, such as contractual protections, lawful transfer mechanisms, or reliance on adequacy decisions.',
      ],
    },
    {
      id: 'data-retention',
      heading: 'Data Retention',
      paragraphs: [
        'We retain personal data for as long as reasonably necessary to provide the Services, maintain accounts, deliver subscriptions, preserve chat history and saved outputs where that functionality is offered, complete requested transactions, secure the Services, investigate abuse, resolve disputes, keep required business and legal records, enforce agreements, and comply with applicable law.',
        'Retention periods vary by data type, feature, legal requirement, and whether you delete content, close your account, or submit a deletion request.',
        'When information is no longer needed, we will delete it, de-identify it, or anonymize it where reasonably possible.',
        'Copies may remain in backups for a limited time and may also be retained where necessary for legal, accounting, security, fraud-prevention, or dispute-resolution purposes.',
      ],
    },
    {
      id: 'security',
      heading: 'Security',
      paragraphs: [
        'We use reasonable administrative, technical, and organizational safeguards designed to protect personal data.',
        'These measures may include encryption in transit, access controls, authentication safeguards, logging, monitoring, vendor management, secure development practices, and other security measures appropriate to the nature of the data and the Services.',
        'No method of transmission, storage, or security control is perfect.',
        'For that reason, we cannot guarantee absolute security.',
        'You are also responsible for protecting your account credentials and using appropriate security on your own devices.',
      ],
    },
    {
      id: 'your-rights-and-choices',
      heading: 'Your Rights and Choices',
      paragraphs: [
        'Depending on where you live and subject to applicable law, you may have rights regarding your personal data, including the right to:',
      ],
      lists: [
        {
          kind: 'unordered',
          items: [
            'access or know what personal data we hold about you;',
            'correct or update inaccurate personal data;',
            'delete personal data;',
            'receive a portable copy of certain personal data;',
            'object to or restrict certain processing;',
            'withdraw consent where processing is based on consent;',
            'opt out of marketing communications;',
            'manage cookies and similar technologies;',
            'request deletion of chat history, saved content, or your account where those controls are available;',
            'and request information about or limits on certain automated processing where applicable law provides those rights.',
          ],
        },
      ],
    },
    {
      id: 'your-rights-and-choices-regional',
      heading: '',
      paragraphs: [
        'If you are in California or another jurisdiction with similar laws, you may also have rights to know categories and specific pieces of personal information, correct inaccurate information, delete personal information, opt out of certain sale or sharing practices, limit certain uses of sensitive personal information, and receive equal service and pricing even if you exercise privacy rights, subject to lawful exceptions.',
        'You may exercise privacy rights by using any in-app controls we make available or by contacting us at Cafaai@niveel.com.',
        'We may need to verify your identity before completing certain requests.',
        'We may deny or limit a request where the law allows or requires us to do so.',
      ],
    },
    {
      id: 'childrens-privacy',
      heading: "Children's Privacy",
      paragraphs: [
        'Cafa AI is not directed to children under 13.',
        'We do not knowingly collect personal information from children under 13 without appropriate legal authorization.',
        'If we learn that we have collected personal information from a child under 13 in a way not permitted by law, we will take reasonable steps to delete that information.',
        'If you believe that a child under 13 has provided personal information to us, please contact us at Cafaai@niveel.com.',
        'If you are under the age of majority in your jurisdiction, you should use the Services only with any consent, supervision, or authorization required by applicable law.',
      ],
    },
    {
      id: 'third-party-services-apis-and-links',
      heading: 'Third-Party Services, APIs, and Links',
      paragraphs: [
        'The Services may contain links to third-party websites, services, content, APIs, or integrations.',
        'The Services may also retrieve information from third-party sources when you ask for web-based, real-time, or external information.',
        'Third-party services operate under their own terms and privacy policies.',
        'We are not responsible for the privacy, security, or content practices of third-party services except as required by applicable law.',
        'We encourage you to review third-party privacy policies when you use those services.',
      ],
    },
    {
      id: 'changes-to-this-privacy-policy',
      heading: 'Changes to This Privacy Policy',
      paragraphs: [
        'We may update this Privacy Policy from time to time to reflect changes in the Services, legal requirements, platform rules, or our data practices.',
        'When we make changes, we will update the effective date.',
        'If changes are material, we may also provide additional notice through the Services, by email, or by other appropriate means.',
        'Your continued use of the Services after the updated Privacy Policy becomes effective means that the updated Privacy Policy applies to your use of the Services.',
      ],
    },
    {
      id: 'contact-us',
      heading: 'Contact Us',
      paragraphs: [
        'If you have questions, requests, or complaints about this Privacy Policy or our privacy practices, you can contact Cafa AI at:',
        'Operating Company: Nivee LLC',
        'Jurisdiction: State of Delaware, United States',
        'Email: Cafaai@niveel.com',
        'Website: https://www.cafaai.com/',
        'If you want to request account deletion, chat deletion, or another privacy-related action, please use any in-app controls we provide or contact us at the email above.',
      ],
    },
  ],
};
