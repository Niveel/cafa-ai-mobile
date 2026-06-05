import type { LegalDocument, LegalSection } from '@/types';

const LAST_UPDATED = 'May 25, 2026';

const COMMON_SECTIONS: LegalSection[] = [
  {
    id: 'acceptance-and-scope',
    heading: 'Acceptance and scope',
    paragraphs: [
      'Cafa AI provides AI-assisted digital services, which may include conversational assistance, research support, document and file workflows, generated text, images, video, charts, and other productivity or creative outputs.',
      'Features may change over time and may vary by plan, device, platform, region, or release status.',
    ],
  },
  {
    id: 'eligibility-and-children',
    heading: 'Eligibility and children',
    paragraphs: [
      'You must be at least thirteen years old, and at least the minimum age required under the laws of your country to consent to digital services, to use the Services.',
      'If you are under the age of majority where you live, you may use the Services only with the permission and supervision of a parent or legal guardian who agrees to these Terms on your behalf.',
      'The Services are not directed to children under thirteen, and you may not use the Services if applicable law prohibits your access or use.',
      'If you create an account, make a purchase, or submit content, you represent that you meet these eligibility requirements.',
    ],
  },
  {
    id: 'accounts-registration-and-security',
    heading: 'Accounts, registration, and security',
    paragraphs: [
      'Some features may be available in guest mode, while other features require an account.',
      'If you create an account, you must provide accurate, current, and complete information and keep that information up to date.',
      'You are responsible for safeguarding your login credentials and for all activity that occurs under your account.',
      'You may not share your account with another person, lend access to another user, or allow another person to use your credentials.',
      'You must notify Cafa AI promptly at Cafaai@niveel.com if you believe your account has been accessed without authorization or that the security of your account has been compromised.',
      'Cafa AI may offer account settings, history controls, and deletion tools.',
      'If you request deletion of your account, Cafa AI will process the request in accordance with applicable law, its Privacy Policy, operational needs, fraud-prevention needs, and legitimate retention obligations.',
      'Some information may be retained after deletion where necessary for legal compliance, security, accounting, dispute resolution, or enforcement purposes.',
    ],
  },
  {
    id: 'license-and-permitted-use',
    heading: 'License and permitted use',
    paragraphs: [
      'Subject to your compliance with these Terms, Cafa AI grants you a limited, non-exclusive, revocable, non-transferable, non-sublicensable right to access and use the Services for your lawful personal use and lawful internal business use.',
      'You may not copy, sell, lease, sublicense, redistribute, publicly exploit, or otherwise make the Services available to third parties except as expressly permitted by Cafa AI in writing.',
      'You may not use the Services to build, train, improve, benchmark, or validate a competing model, dataset, product, or service, except where a restriction of that kind is prohibited by applicable law and cannot lawfully be excluded.',
      'If you download the mobile app through a third-party app store or marketplace, your use is also subject to that store\'s applicable terms, rules, and policies.',
      'App stores, marketplaces, and payment platforms are not parties to these Terms and are not responsible for the content, operation, maintenance, or support of the Services except as required under their own terms or applicable law.',
    ],
  },
  {
    id: 'prohibited-uses',
    heading: 'Prohibited uses',
    paragraphs: [
      'You may not use the Services, or permit anyone else to use the Services, in any way that is unlawful, harmful, abusive, deceptive, or infringes the rights of any person or entity.',
      'Without limiting the general rule above, you may not:',
    ],
    lists: [
      {
        kind: 'unordered',
        items: [
          'use the Services to violate any law, regulation, court order, sanctions program, or third-party right;',
          'upload, submit, generate, store, distribute, or promote content that is unlawful, fraudulent, defamatory, invasive of privacy, obscene, sexually exploitative, hateful, discriminatory, abusive, threatening, or otherwise harmful;',
          'use the Services to create, distribute, or facilitate scams, phishing, impersonation, fraud, identity theft, social engineering, extortion, blackmail, or dishonest behavior;',
          'use the Services to create, distribute, or facilitate non-consensual intimate imagery, non-consensual synthetic sexual content, child sexual abuse material, sexual exploitation, or content that exploits or endangers minors;',
          'use the Services to impersonate a real person, company, government body, brand, or other entity, or to falsely suggest sponsorship, endorsement, affiliation, or authenticity;',
          'use the Services to create or distribute deceptive media, false official documents, false emergency information, false election-related information, or manipulated voice, image, or video content designed to mislead, defraud, harass, or injure others;',
          'use the Services to create malware, harmful code, exploit instructions, credential theft tools, or content intended to interfere with devices, networks, services, APIs, or security controls;',
          'reverse engineer, decompile, disassemble, model-extract, scrape, or otherwise attempt to discover source code, model weights, training data, prompts, hidden features, or underlying components of the Services, except to the extent such restriction is not permitted by applicable law;',
          'circumvent usage limits, rate limits, safety systems, moderation controls, access controls, or technical protections;',
          'use bots, scripts, or automated means to access the Services in a manner that imposes excessive burden, harvests output at scale without permission, or interferes with other users;',
          'upload content that you do not own or do not have the rights, permissions, licenses, and consents necessary to submit and use in connection with the Services;',
          'use the Services as the sole basis for decisions involving health care, legal advice, financial advice, employment, housing, education, insurance, credit, immigration, child welfare, public benefits, law enforcement, emergency response, or other high-stakes matters that could affect a person\'s rights, safety, opportunities, or well-being.',
        ],
      },
    ],
  },
  {
    id: 'prohibited-uses-additional-rules',
    heading: '',
    paragraphs: [
      'Cafa AI may define additional usage rules for specific features from time to time, and those rules are incorporated into these Terms when presented to you.',
    ],
  },
  {
    id: 'user-content-and-ai-generated-output',
    heading: 'User content and AI-generated output',
    paragraphs: [
      'You may submit prompts, instructions, text, files, documents, images, audio, video, metadata, or other materials to the Services.',
      'Those materials are referred to in these Terms as your "Input."',
      'The Services may generate text, images, video, audio, data, structured documents, or other results in response to your Input.',
      'Those results are referred to in these Terms as "Output."',
      'Input and Output together are referred to as "Content."',
      'As between you and Cafa AI, and to the extent permitted by applicable law, you retain any rights you have in your Input, and Cafa AI assigns to you any rights Cafa AI may have in Output that is generated for you.',
      'This assignment does not transfer any rights in the Services themselves, any models, any software, any templates, any branding, any pre-existing materials, or any underlying technology or know-how.',
      'Because of the nature of artificial intelligence and machine learning, Output may not be unique.',
      'Other users may receive the same or similar output, and similar output delivered to other users is not your property merely because your Output resembles it.',
      'You are solely responsible for your Content, including ensuring that you have all required rights, licenses, consents, and permissions to submit Input and to use, publish, share, commercialize, or rely on Output.',
      'You grant Cafa AI a worldwide, non-exclusive, royalty-free, transferable license to host, store, reproduce, process, transmit, display, analyze, modify, create derivative works from, and otherwise use your Content to operate, secure, moderate, maintain, personalize, improve, train, evaluate, and develop the Services and related systems; to provide support; to investigate abuse; to enforce these Terms and Cafa AI policies; and to comply with legal obligations.',
      'Cafa AI will exercise this license subject to its Privacy Policy and any settings or controls it makes available to you.',
      'Cafa AI does not guarantee that Output is accurate, complete, current, lawful, non-infringing, suitable for any purpose, or eligible for copyright protection.',
      'You are responsible for reviewing and evaluating Output before using it, sharing it, or relying on it.',
      'If your use of Output involves a real person\'s likeness, voice, image, personal data, proprietary material, or another party\'s rights, you are responsible for obtaining all required permissions and giving all legally required notices.',
    ],
  },
  {
    id: 'moderation-safety-and-reporting',
    heading: 'Moderation, safety, and reporting',
    paragraphs: [
      'Cafa AI may use automated tools, human review, or a combination of both to detect, review, block, filter, refuse, remove, or restrict Content or activity that may violate these Terms, applicable law, or the rights or safety of users or third parties.',
      'Cafa AI may, but is not obligated to, monitor all Content or all use of the Services.',
      'The failure to detect or remove content does not waive any of Cafa AI\'s rights.',
      'If the Services provide in-app reporting, blocking, or flagging tools, you agree to use them responsibly.',
      'You may also report suspected violations, harmful outputs, abusive activity, or intellectual-property complaints by contacting Cafaai@niveel.com.',
      'Cafa AI may investigate suspected violations and may cooperate with law enforcement, regulators, rights holders, or other appropriate bodies where required or appropriate.',
    ],
  },
  {
    id: 'intellectual-property',
    heading: 'Intellectual property',
    paragraphs: [
      'The Services, including all software, models, interfaces, workflows, prompts, designs, logos, trademarks, service marks, text, graphics, compilations, audiovisual elements, and all related intellectual property rights, are and remain the property of Cafa AI or its licensors.',
      'Except for the limited rights expressly granted in these Terms, no right, title, or interest in the Services or any Cafa AI intellectual property is transferred to you.',
      'You may not use Cafa AI\'s name, logo, trade dress, or branding without its prior written permission.',
      'If you believe that any content available through the Services infringes your copyright, trademark, or other intellectual property rights, you may send a notice to Cafaai@niveel.com that includes enough detail for Cafa AI to identify the allegedly infringing material, the rights claimed, and your authority to act.',
    ],
  },
  {
    id: 'privacy-and-data-processing',
    heading: 'Privacy and data processing',
    paragraphs: [
      'Cafa AI\'s Privacy Policy explains how Cafa AI collects, uses, processes, stores, shares, retains, and protects personal data and other information in connection with the Services.',
      'By using the Services, you acknowledge that your information may be handled as described there.',
      'Depending on how you use the Services, Cafa AI may process account information, profile and preference data, prompts, messages, uploaded files, outputs, billing and subscription information, device and browser information, logs, diagnostics, usage events, and related technical or operational information.',
      'Cafa AI may process and store information in countries and jurisdictions where it or its service providers operate, subject to applicable law and the safeguards described in the Privacy Policy.',
      'Where the Services offer deletion controls, history controls, personalization settings, or similar privacy choices, you are responsible for using those controls if you want to limit certain uses or retention practices.',
    ],
  },
  {
    id: 'security',
    heading: 'Security',
    paragraphs: [
      'Cafa AI uses reasonable administrative, technical, and organizational measures designed to protect the Services and user data.',
      'However, no system, transmission method, or storage method is fully secure, and Cafa AI cannot guarantee absolute security.',
      'You are responsible for using appropriate security practices on your own devices and accounts, including safeguarding credentials, maintaining updates, and keeping backups of any important Content.',
      'You may not test, scan, probe, or bypass the security of the Services except with Cafa AI\'s prior written authorization.',
    ],
  },
  {
    id: 'third-party-services-apis-and-external-platforms',
    heading: 'Third-party services, APIs, and external platforms',
    paragraphs: [
      'The Services may rely on or interoperate with third-party infrastructure, hosting providers, payment services, analytics tools, communications vendors, identity services, app stores, APIs, model providers, or other third-party services.',
      'Your access to or use of third-party services may be subject to separate terms, privacy policies, and rules imposed by those third parties.',
      'Cafa AI is not responsible for the acts, omissions, content, features, availability, or security of third-party services except to the extent required by law.',
      'The Services may also include links, references, integrations, or outputs that point to third-party websites, materials, or services.',
      'Cafa AI does not endorse or guarantee them merely by making them available.',
      'The Services may include advertising, sponsorships, or promotional content.',
      'Your dealings with third parties are between you and those third parties unless expressly stated otherwise.',
    ],
  },
  {
    id: 'fees-subscriptions-billing-and-refunds',
    heading: 'Fees, subscriptions, billing, and refunds',
    paragraphs: [
      'Certain features of the Services may require payment, including recurring subscription plans.',
      'The prices, features, usage limits, billing intervals, taxes, and other commercial terms for paid offerings will be shown to you at or before the time of purchase.',
      'If you purchase a subscription, you authorize Cafa AI, the relevant app store, and/or the applicable payment processor to charge the payment method you provide for the recurring fees, taxes, and other applicable charges associated with your plan.',
      'Unless otherwise stated at the time of purchase, subscriptions renew automatically at the end of each billing period until canceled.',
      'If you purchase through an app store or platform such as Google Play or the Apple App Store, billing, cancellation, and refunds may be handled by that store under its own policies, platform tools, and applicable law.',
      'You must manage store-billed subscriptions through the store account settings or other store-provided management tools unless the platform provides another process.',
      'If you purchase directly through the Cafa AI website, you may manage or cancel your subscription through your account settings where available or by contacting Cafaai@niveel.com.',
      'A cancellation request takes effect at the end of the current billing period unless applicable law requires earlier effect.',
      'Except where required by applicable law, expressly stated by Cafa AI, or provided under an app-store or payment-platform policy that applies to your purchase, fees are non-refundable.',
      'If Cafa AI offers a free trial, introductory price, promotional credit, coupon, or other temporary offer, the offer is subject to the specific terms shown at sign-up.',
      'Unless explicitly stated otherwise, a trial or discount may convert into a paid subscription at the end of the promotional period unless canceled before renewal.',
      'Cafa AI may change subscription pricing, plan structure, features, and usage limits from time to time.',
      'If a material price change affects a recurring subscription, Cafa AI will provide notice before the change takes effect for your next renewal, and you may cancel before that renewal if you do not agree.',
      'If a payment fails or is reversed, Cafa AI may suspend paid features, downgrade your account, or terminate access to paid services until the issue is resolved.',
      'If Cafa AI permanently discontinues a paid service for which you prepaid and for which no substantially equivalent replacement is provided, Cafa AI may provide a refund, credit, or prorated adjustment where required by law or where Cafa AI chooses to do so.',
    ],
  },
  {
    id: 'beta-preview-and-experimental-features',
    heading: 'Beta, preview, and experimental features',
    paragraphs: [
      'Cafa AI may label certain features as beta, preview, alpha, early access, experimental, or similar.',
      'Those features are provided on an "as is" and "as available" basis for testing and evaluation.',
      'Beta or experimental features may be incomplete, unstable, inaccurate, interrupted, unavailable in all regions, or removed at any time without notice.',
      'Cafa AI is not obligated to continue, support, correct, or commercially release those features.',
      'To the fullest extent permitted by law, beta and experimental features are excluded from any service-level commitments, uptime expectations, or special indemnification obligations unless Cafa AI expressly states otherwise in writing.',
    ],
  },
  {
    id: 'feedback',
    heading: 'Feedback',
    paragraphs: [
      'If you provide feedback, ideas, suggestions, comments, ratings, reactions, or proposed improvements about the Services, you grant Cafa AI a worldwide, perpetual, irrevocable, royalty-free, transferable right to use, reproduce, modify, adapt, publish, translate, distribute, perform, display, and otherwise exploit that feedback for any lawful purpose without compensation, notice, or attribution to you.',
    ],
  },
  {
    id: 'accessibility',
    heading: 'Accessibility',
    paragraphs: [
      'Cafa AI aims to make the Services reasonably accessible and to improve compatibility with commonly used assistive technologies over time.',
      'Accessibility may vary depending on device, browser, operating system, feature set, and third-party dependencies.',
      'If you experience an accessibility barrier or need support using the Services, you may contact Cafaai@niveel.com, and Cafa AI will use reasonable efforts to review the issue and consider appropriate improvements.',
    ],
  },
  {
    id: 'disclaimers-of-warranties',
    heading: 'Disclaimers of warranties',
    paragraphs: [
      'THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE."',
      'TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, CAFA AI AND ITS AFFILIATES, LICENSORS, CONTRACTORS, AND SERVICE PROVIDERS DISCLAIM ALL WARRANTIES AND REPRESENTATIONS, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, TITLE, QUIET ENJOYMENT, QUALITY, AVAILABILITY, SECURITY, OR ACCURACY.',
      'CAFA AI DOES NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, TIMELY, SECURE, OR FREE OF HARMFUL COMPONENTS, OR THAT CONTENT OR OUTPUT WILL BE ACCURATE, COMPLETE, CURRENT, ORIGINAL, LAWFUL, OR SUITABLE FOR YOUR PURPOSES.',
      'AI OUTPUT IS PROBABILISTIC AND MAY BE INCORRECT, INCOMPLETE, BIASED, OFFENSIVE, OR MISLEADING.',
      'YOU MUST EXERCISE YOUR OWN JUDGMENT AND USE HUMAN REVIEW BEFORE USING OR RELYING ON OUTPUT.',
      'THE SERVICES ARE NOT A SUBSTITUTE FOR PROFESSIONAL ADVICE OR PROFESSIONAL SERVICES.',
      'THE SERVICES ARE NOT MEDICAL, LEGAL, FINANCIAL, TAX, ACCOUNTING, MENTAL-HEALTH, EMERGENCY, OR OTHER REGULATED PROFESSIONAL SERVICES, AND THEY ARE NOT DESIGNED OR LICENSED TO SATISFY REGULATORY OR SAFETY OBLIGATIONS.',
    ],
  },
  {
    id: 'limitation-of-liability',
    heading: 'Limitation of liability',
    paragraphs: [
      'TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, CAFA AI AND ITS AFFILIATES, LICENSORS, CONTRACTORS, AND SERVICE PROVIDERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, BUSINESS, OPPORTUNITY, GOODWILL, DATA, OR CONTENT, ARISING OUT OF OR RELATED TO THE SERVICES OR THESE TERMS, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.',
      'TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, THE TOTAL AGGREGATE LIABILITY OF CAFA AI AND ITS AFFILIATES, LICENSORS, CONTRACTORS, AND SERVICE PROVIDERS FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THE SERVICES OR THESE TERMS WILL NOT EXCEED THE GREATER OF: (A) THE TOTAL AMOUNT YOU PAID TO CAFA AI FOR THE SERVICES DURING THE TWELVE MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM; OR (B) FIFTY U.S. DOLLARS (US$50).',
      'THE LIMITATIONS IN THIS SECTION APPLY REGARDLESS OF THE FORM OF ACTION AND EVEN IF ANY LIMITED REMEDY FAILS OF ITS ESSENTIAL PURPOSE.',
      'Nothing in these Terms limits liability that cannot lawfully be excluded or limited, and nothing in these Terms limits any non-waivable rights or remedies you may have under applicable consumer law.',
    ],
  },
  {
    id: 'indemnification',
    heading: 'Indemnification',
    paragraphs: [
      'If you use the Services for a business, commercial, or organizational purpose, or if applicable law otherwise permits this obligation to apply to you, you agree to defend, indemnify, and hold harmless Cafa AI and its affiliates, officers, directors, employees, contractors, licensors, and service providers from and against all third-party claims, demands, proceedings, damages, losses, liabilities, judgments, costs, and expenses, including reasonable legal fees, arising out of or related to:',
    ],
    lists: [
      {
        kind: 'unordered',
        items: [
          'your Content;',
          'your use or misuse of the Services;',
          'your violation of these Terms or applicable law; or',
          'your infringement or misappropriation of any right of another person or entity.',
        ],
      },
    ],
  },
  {
    id: 'indemnification-defense-control',
    heading: '',
    paragraphs: ['Cafa AI may assume exclusive control of the defense of any matter subject to indemnification, and you agree to cooperate with that defense.'],
  },
  {
    id: 'suspension-and-termination',
    heading: 'Suspension and termination',
    paragraphs: [
      'You may stop using the Services at any time.',
      'You may also cancel your subscription and request account deletion using the tools and contact routes that Cafa AI makes available.',
      'Cafa AI may suspend, restrict, disable, remove, or terminate your access to some or all of the Services, with or without notice, if Cafa AI reasonably believes that:',
    ],
    lists: [
      {
        kind: 'unordered',
        items: [
          'you violated these Terms or other applicable policies;',
          'your use creates legal, reputational, security, financial, or safety risk for Cafa AI, users, or third parties;',
          'your account or Content is connected with fraud, abuse, deception, harmful conduct, or unlawful activity;',
          'payment for paid services is overdue, reversed, or cannot be processed;',
          'Cafa AI is required to do so by law, court order, governmental request, or platform requirement; or',
          'Cafa AI discontinues the relevant Service or feature.',
        ],
      },
    ],
  },
  {
    id: 'termination-effects',
    heading: '',
    paragraphs: [
      'Upon termination, the license granted to you under these Terms ends immediately.',
      'Sections that by their nature should survive termination will survive, including sections on intellectual property, payment obligations accrued before termination, disclaimers, limitation of liability, indemnification, dispute resolution, export controls, and miscellaneous terms.',
    ],
  },
  {
    id: 'governing-law-and-dispute-resolution',
    heading: 'Governing law and dispute resolution',
    paragraphs: [
      'Before filing a formal claim, you and Cafa AI agree to try to resolve any dispute informally by written notice sent to Cafaai@niveel.com and, if provided by you, to your account email or other written contact details.',
      'Each party will use reasonable efforts to resolve the dispute informally within thirty days after notice is received.',
      'Unless a supplemental regional term or mandatory law says otherwise, these Terms and any dispute, claim, or controversy arising out of or relating to the Services or these Terms are governed by the laws of the State of Delaware, United States.',
      'Nivee LLC is the operating company of Cafa AI, without regard to conflict-of-law rules.',
      'Unless mandatory law gives you the right to bring a claim elsewhere, any dispute that is not resolved informally will be brought exclusively in the state or federal courts located in the State of Delaware, United States, and you and Cafa AI consent to personal jurisdiction and venue there.',
      'Nothing in this section limits any rights you may have under mandatory consumer-protection laws or other non-waivable laws that apply in your place of residence.',
    ],
  },
  {
    id: 'export-controls-and-sanctions',
    heading: 'Export controls and sanctions',
    paragraphs: [
      'You may not use, access, export, re-export, transfer, or otherwise deal with the Services or any related software, technology, or output in violation of applicable export-control, sanctions, trade, or embargo laws and regulations.',
      'You represent and warrant that you are not located in, ordinarily resident in, organized under the laws of, or acting on behalf of a person or entity located in or subject to restrictions under any jurisdiction or sanctions program where access to the Services would be prohibited by applicable law.',
    ],
  },
  {
    id: 'changes-to-the-services-and-these-terms',
    heading: 'Changes to the Services and these Terms',
    paragraphs: [
      'Cafa AI may modify, suspend, or discontinue any part of the Services at any time.',
      'Cafa AI may also update these Terms from time to time to reflect changes in the Services, the law, platform requirements, or business operations.',
      'If Cafa AI makes a material change to these Terms, it will provide notice by reasonable means, such as through the Services, by email, or by updating the effective date.',
      'The revised Terms become effective on the stated effective date.',
      'If you continue to use the Services after revised Terms become effective, you agree to the revised Terms.',
      'If you do not agree, you must stop using the Services and, if applicable, cancel your subscription.',
    ],
  },
  {
    id: 'miscellaneous',
    heading: 'Miscellaneous',
    paragraphs: [
      'These Terms, together with the Privacy Policy and any additional terms that apply to specific features or transactions, form the complete agreement between you and Cafa AI regarding the Services and supersede prior understandings relating to the same subject matter.',
      'If any provision of these Terms is held to be invalid, unlawful, or unenforceable, the remaining provisions remain in full force and effect to the fullest extent permitted by law.',
      'Cafa AI\'s failure to enforce any provision of these Terms is not a waiver of its right to do so later.',
      'You may not assign or transfer these Terms or your rights under them without Cafa AI\'s prior written consent.',
      'Cafa AI may assign or transfer these Terms, in whole or in part, as part of a corporate reorganization, merger, sale of assets, financing, or similar transaction.',
      'Headings are for convenience only and do not affect interpretation.',
    ],
  },
  {
    id: 'contact-and-support',
    heading: 'Contact and support',
    paragraphs: [
      'If you have questions about these Terms, the Services, accessibility, billing, account deletion, or legal notices, you may contact Cafa AI at:',
      'Cafaai@niveel.com',
    ],
  },
];

const IOS_ONLY_SECTION: LegalSection = {
  id: 'apple-app-store-and-ios-terms',
  heading: 'Apple App Store and iOS terms',
  paragraphs: [
    'For the iOS version of the Services, Nivee LLC is the operating company responsible for the Cafa AI app and these Terms.',
    'Apple Inc. and its subsidiaries are not parties to these Terms and are not responsible for the Services, the content of the Services, maintenance, support, warranties, claims, or legal compliance, except as required by Apple\'s applicable App Store terms or applicable law.',
    'Your use of the iOS app must comply with Apple\'s App Store rules, Apple Media Services Terms and Conditions, and any other Apple terms that apply to your device, Apple ID, subscriptions, or in-app purchases.',
    'If you purchase a subscription or paid feature through Apple, billing, renewal, cancellation, and refund requests are handled by Apple through your Apple ID account settings and Apple\'s applicable policies.',
    'Cafa AI may not be able to cancel, refund, or modify Apple-billed purchases directly.',
    'To the extent permitted by applicable law, Apple has no warranty obligation with respect to the iOS app.',
    'If the app fails to conform to any applicable warranty that cannot lawfully be excluded, you may notify Apple, and Apple may refund the purchase price for the app, if any, as required by Apple\'s applicable terms.',
    'Any other claims, losses, liabilities, damages, costs, or expenses relating to the iOS app remain subject to these Terms.',
    'Apple and its subsidiaries are intended third-party beneficiaries of this section.',
    'Once you accept these Terms, Apple has the right to enforce this section against you as a third-party beneficiary.',
  ],
};

export const ANDROID_AND_WEB_TERMS_OF_SERVICE_DOCUMENT: LegalDocument = {
  title: 'CAFA AI TERMS AND CONDITIONS',
  lastUpdated: LAST_UPDATED,
  intro: [
    'These Terms and Conditions, together with the Privacy Policy and any additional terms that apply to specific features, purchases, or promotions, govern your access to and use of the Cafa AI website, mobile applications, and any related tools, features, content, media, software, or services that Cafa AI makes available (collectively, the "Services").',
    'By accessing or using the Services, creating an account, clicking to accept these Terms, submitting content, or purchasing a subscription or other paid feature, you agree to be bound by these Terms.',
    'If you do not agree, do not use the Services.',
    'If you use the Services on behalf of a company, organization, or other legal entity, you represent and warrant that you have authority to bind that entity to these Terms, and in that case "you" includes that entity.',
  ],
  sections: [
    {
      ...COMMON_SECTIONS[0],
      paragraphs: [
        ...(COMMON_SECTIONS[0].paragraphs ?? []),
        'These Terms apply to your use of the Services through the website, through Android and iOS mobile applications, and through any other official Cafa AI access point that links to or references these Terms.',
      ],
    },
    ...COMMON_SECTIONS.slice(1),
  ],
};

export const IOS_TERMS_OF_SERVICE_DOCUMENT: LegalDocument = {
  title: 'CAFA AI TERMS AND CONDITIONS - iOS VERSION',
  lastUpdated: LAST_UPDATED,
  intro: [
    'These Terms and Conditions, together with the Privacy Policy and any additional terms that apply to specific features, purchases, or promotions, govern your access to and use of the Cafa AI website, mobile applications, and any related tools, features, content, media, software, or services that Cafa AI makes available (collectively, the "Services").',
    'By accessing or using the Services, creating an account, clicking to accept these Terms, submitting content, or purchasing a subscription or other paid feature, you agree to be bound by these Terms.',
    'If you do not agree, do not use the Services.',
    'If you use the Services on behalf of a company, organization, or other legal entity, you represent and warrant that you have authority to bind that entity to these Terms, and in that case "you" includes that entity.',
  ],
  sections: [
    {
      ...COMMON_SECTIONS[0],
      paragraphs: [
        ...(COMMON_SECTIONS[0].paragraphs ?? []),
        'These Terms apply to your use of the Services through the Cafa AI iOS mobile application, the Cafa AI website, and any other official Cafa AI access point that links to or references these Terms.',
      ],
    },
    ...COMMON_SECTIONS.slice(1, 4),
    IOS_ONLY_SECTION,
    ...COMMON_SECTIONS.slice(4),
  ],
};

export const TERMS_OF_SERVICE_DOCUMENT = ANDROID_AND_WEB_TERMS_OF_SERVICE_DOCUMENT;

export function getTermsOfServiceDocument(platform: 'ios' | 'android' | 'web' | string): LegalDocument {
  return platform === 'ios' ? IOS_TERMS_OF_SERVICE_DOCUMENT : ANDROID_AND_WEB_TERMS_OF_SERVICE_DOCUMENT;
}
