import type { AvatarScriptTone, AvatarUseCaseTemplate } from '@/types';

export type AvatarRandomScriptPreset = {
  topic: string;
  title: string;
  userGoal: string;
  targetAudience: string;
  tone: AvatarScriptTone;
  useCaseTemplate: AvatarUseCaseTemplate;
  scriptText: string;
  keyPoints: string[];
};

type BusinessSeed = {
  business: string;
  location: string;
  offer: string;
  benefit: string;
  callToAction: string;
};

type EducationSeed = {
  lesson: string;
  outcome: string;
  tip: string;
  action: string;
};

type LifestyleSeed = {
  theme: string;
  result: string;
  routine: string;
  action: string;
};

type TechSeed = {
  product: string;
  category: string;
  wowFactor: string;
  action: string;
};

type DiscoverySeed = {
  highlight: string;
  audience: string;
  benefit: string;
  action: string;
};

function createBusinessPreset(seed: BusinessSeed): AvatarRandomScriptPreset {
  return {
    topic: 'Business promotion',
    title: `${seed.business} spotlight`,
    userGoal: `Promote ${seed.business} in ${seed.location}`,
    targetAudience: `People in ${seed.location} who want ${seed.benefit.toLowerCase()}`,
    tone: 'friendly',
    useCaseTemplate: 'product ad',
    scriptText: `Looking for ${seed.benefit.toLowerCase()} in ${seed.location}? ${seed.business} is here to help. We offer ${seed.offer.toLowerCase()} so you can enjoy a smoother, better experience without the usual stress. If you have been searching for a trusted option that feels personal and reliable, this is your sign to try us. ${seed.callToAction}`,
    keyPoints: [seed.business, seed.offer, seed.callToAction],
  };
}

function createEducationPreset(seed: EducationSeed): AvatarRandomScriptPreset {
  return {
    topic: 'Education',
    title: `${seed.lesson} explained simply`,
    userGoal: `Teach viewers about ${seed.lesson.toLowerCase()}`,
    targetAudience: 'Students, beginners, and curious learners',
    tone: 'educational',
    useCaseTemplate: 'explainer',
    scriptText: `Let us break down ${seed.lesson.toLowerCase()} in a simple way. The main goal is to help you ${seed.outcome.toLowerCase()} without feeling overwhelmed. One helpful tip is ${seed.tip.toLowerCase()}, because that makes the idea easier to remember and use. If you want to improve faster, start by ${seed.action.toLowerCase()} and build from there one step at a time.`,
    keyPoints: [seed.lesson, seed.tip, seed.action],
  };
}

function createLifestylePreset(seed: LifestyleSeed): AvatarRandomScriptPreset {
  return {
    topic: 'Lifestyle',
    title: `${seed.theme} routine`,
    userGoal: `Share a lifestyle video about ${seed.theme.toLowerCase()}`,
    targetAudience: 'Busy people who want simple daily improvements',
    tone: 'motivational',
    useCaseTemplate: 'general',
    scriptText: `If you want ${seed.result.toLowerCase()}, start with a simpler approach to ${seed.theme.toLowerCase()}. A practical routine is to ${seed.routine.toLowerCase()}, because small consistent habits usually work better than dramatic changes. You do not need a perfect plan to begin. Just focus on one steady action today by ${seed.action.toLowerCase()} and let the progress grow from there.`,
    keyPoints: [seed.theme, seed.routine, seed.action],
  };
}

function createTechPreset(seed: TechSeed): AvatarRandomScriptPreset {
  return {
    topic: 'Tech and gaming',
    title: `${seed.product} feature highlight`,
    userGoal: `Promote ${seed.product} to people interested in ${seed.category.toLowerCase()}`,
    targetAudience: `${seed.category} fans who want something fresh and exciting`,
    tone: 'motivational',
    useCaseTemplate: 'pitch',
    scriptText: `${seed.product} is bringing fresh energy to ${seed.category.toLowerCase()}. What makes it stand out is ${seed.wowFactor.toLowerCase()}, giving people more reasons to jump in, explore, and stay engaged. If you enjoy tools and experiences that feel modern, sharp, and fun to use, this is worth your attention. ${seed.action}`,
    keyPoints: [seed.product, seed.wowFactor, seed.action],
  };
}

function createDiscoveryPreset(seed: DiscoverySeed): AvatarRandomScriptPreset {
  return {
    topic: 'Travel and places',
    title: `${seed.highlight} feature`,
    userGoal: `Promote ${seed.highlight} to ${seed.audience.toLowerCase()}`,
    targetAudience: seed.audience,
    tone: 'friendly',
    useCaseTemplate: 'intro',
    scriptText: `If you are looking for a place that offers ${seed.benefit.toLowerCase()}, take a closer look at ${seed.highlight}. It stands out because it helps people enjoy more comfort, better moments, and a more memorable overall experience. Whether you are planning ahead or choosing your next stop soon, this is the kind of place worth adding to your list. ${seed.action}`,
    keyPoints: [seed.highlight, seed.benefit, seed.action],
  };
}

const businessSeeds: BusinessSeed[] = [
  { business: 'Sweet Crumbs Bakery', location: 'Accra', offer: 'fresh pastries and celebration cakes', benefit: 'fresh baked treats', callToAction: 'Visit Sweet Crumbs Bakery today and place your next order with confidence.' },
  { business: 'Glow Nest Spa', location: 'Lagos', offer: 'facials, body treatments, and calming massage sessions', benefit: 'self care that feels luxurious', callToAction: 'Book your next reset at Glow Nest Spa and treat yourself well this week.' },
  { business: 'PrimeFix Auto Care', location: 'Nairobi', offer: 'fast diagnostics, repairs, and routine maintenance', benefit: 'dependable car care', callToAction: 'Bring your car to PrimeFix Auto Care and drive with peace of mind.' },
  { business: 'Urban Bean Cafe', location: 'Cape Town', offer: 'specialty coffee, brunch, and cozy work friendly seating', benefit: 'great coffee and a calm atmosphere', callToAction: 'Stop by Urban Bean Cafe and make your next coffee break count.' },
  { business: 'Bella Stitch Fashion House', location: 'Kumasi', offer: 'custom outfits, fittings, and ready to wear styles', benefit: 'fashion that fits beautifully', callToAction: 'Message Bella Stitch Fashion House and get your next look started today.' },
  { business: 'ClearView Properties', location: 'Abuja', offer: 'rental listings, guided viewings, and trusted support', benefit: 'stress free house hunting', callToAction: 'Talk to ClearView Properties and find a place that truly feels right.' },
  { business: 'FreshKart Grocery', location: 'Ibadan', offer: 'quick delivery of produce, pantry items, and home essentials', benefit: 'easy grocery shopping', callToAction: 'Order from FreshKart Grocery and save time on your next shop.' },
  { business: 'MediCore Clinic', location: 'Tema', offer: 'friendly consultations, checkups, and preventive care', benefit: 'accessible everyday healthcare', callToAction: 'Schedule your visit with MediCore Clinic and stay ahead of your health goals.' },
  { business: 'BrightPath Tutors', location: 'Kigali', offer: 'private lessons, exam prep, and student coaching', benefit: 'better academic support', callToAction: 'Reach out to BrightPath Tutors and help your child learn with confidence.' },
  { business: 'HomeHue Interiors', location: 'Johannesburg', offer: 'space planning, decor styling, and furniture guidance', benefit: 'a home that feels polished', callToAction: 'Start your transformation with HomeHue Interiors and love your space again.' },
  { business: 'Crafted Cuts Barbershop', location: 'Enugu', offer: 'clean cuts, grooming, and modern styling', benefit: 'sharp grooming without the rush', callToAction: 'Walk into Crafted Cuts Barbershop and leave looking your best.' },
  { business: 'SwiftPay Solutions', location: 'Accra', offer: 'simple digital payment tools for growing businesses', benefit: 'faster business payments', callToAction: 'Try SwiftPay Solutions and make getting paid much easier.' },
  { business: 'Taste Trail Restaurant', location: 'Mombasa', offer: 'local favorites, family meals, and chef specials', benefit: 'flavorful dining experiences', callToAction: 'Reserve a table at Taste Trail Restaurant and enjoy a meal worth remembering.' },
  { business: 'Luna Lens Studio', location: 'Lusaka', offer: 'portraits, event shoots, and branding sessions', benefit: 'photos that feel professional and personal', callToAction: 'Book Luna Lens Studio and capture your next moment beautifully.' },
  { business: 'GreenSpark Solar', location: 'Tamale', offer: 'solar installation, maintenance, and power advice', benefit: 'more reliable energy', callToAction: 'Speak with GreenSpark Solar and take a smart step toward dependable power.' },
  { business: 'Kiddo Corner Store', location: 'Port Harcourt', offer: 'toys, books, and child friendly essentials', benefit: 'easy shopping for kids needs', callToAction: 'Visit Kiddo Corner Store and make family shopping simpler.' },
  { business: 'Apex Fitness Hub', location: 'Durban', offer: 'group classes, personal training, and recovery plans', benefit: 'fitness support that keeps you motivated', callToAction: 'Join Apex Fitness Hub and start moving toward your goals today.' },
  { business: 'SilverLine Laundry', location: 'Takoradi', offer: 'wash, dry, fold, and quick pickup service', benefit: 'clean clothes without the hassle', callToAction: 'Use SilverLine Laundry and free up more time every week.' },
  { business: 'StudyBridge Academy', location: 'Owerri', offer: 'exam strategy, revision bootcamps, and mentoring', benefit: 'stronger exam performance', callToAction: 'Enroll with StudyBridge Academy and prepare with clarity and focus.' },
  { business: 'Ocean Crest Hotel', location: 'Banjul', offer: 'comfortable rooms, warm service, and easy booking', benefit: 'a restful stay near the city and coast', callToAction: 'Choose Ocean Crest Hotel for your next stay and settle in with ease.' },
];

const educationSeeds: EducationSeed[] = [
  { lesson: 'time management for students', outcome: 'plan your week with less stress', tip: 'breaking study blocks into shorter focused sessions', action: 'writing down your top three tasks each morning' },
  { lesson: 'public speaking basics', outcome: 'speak with more confidence in front of people', tip: 'practicing your opening line until it feels natural', action: 'recording a one minute talk on your phone' },
  { lesson: 'budgeting for beginners', outcome: 'track your money more clearly', tip: 'separating needs from wants before you spend', action: 'setting a weekly spending limit' },
  { lesson: 'how photosynthesis works', outcome: 'understand how plants make food', tip: 'linking sunlight, water, and carbon dioxide in one simple chain', action: 'drawing the process in your own words' },
  { lesson: 'email writing skills', outcome: 'write clearer and more respectful messages', tip: 'starting with a purpose statement in the first sentence', action: 'rewriting one old email in a cleaner format' },
  { lesson: 'critical thinking', outcome: 'question information more effectively', tip: 'asking what evidence supports each claim', action: 'checking two sources before forming an opinion' },
  { lesson: 'fractions made easy', outcome: 'compare and simplify fractions faster', tip: 'using common denominators step by step', action: 'solving three small examples by hand' },
  { lesson: 'goal setting', outcome: 'turn ideas into realistic action plans', tip: 'making goals specific and measurable', action: 'turning one big goal into a seven day plan' },
  { lesson: 'basic grammar improvement', outcome: 'avoid common writing mistakes', tip: 'reading your sentence out loud before finalizing it', action: 'editing one paragraph with fresh eyes' },
  { lesson: 'study techniques that stick', outcome: 'remember information for longer', tip: 'testing yourself instead of only rereading notes', action: 'using flashcards for one difficult topic' },
  { lesson: 'intro to coding logic', outcome: 'understand how step by step instructions work', tip: 'thinking of every task like a clear sequence', action: 'writing a simple algorithm for your morning routine' },
  { lesson: 'research skills', outcome: 'find better sources for assignments', tip: 'starting with a clear question before searching', action: 'saving three trustworthy references for one topic' },
  { lesson: 'reading comprehension', outcome: 'pull the main idea from longer texts', tip: 'looking for repeated concepts and signal words', action: 'summarizing one paragraph in one sentence' },
  { lesson: 'healthy digital habits', outcome: 'use screens more intentionally', tip: 'creating short no phone periods during work time', action: 'turning off non essential notifications today' },
  { lesson: 'basic negotiation', outcome: 'ask for better outcomes respectfully', tip: 'focusing on shared value instead of pressure', action: 'practicing one confident ask this week' },
  { lesson: 'science revision tips', outcome: 'revise complex topics with more structure', tip: 'grouping concepts into simple diagrams', action: 'creating one visual summary sheet tonight' },
  { lesson: 'career planning', outcome: 'make smarter early career decisions', tip: 'matching your skills with real job paths', action: 'listing three roles you want to explore' },
  { lesson: 'memory improvement', outcome: 'recall details more consistently', tip: 'connecting new facts to familiar ideas', action: 'reviewing what you learned before bed' },
  { lesson: 'presentation slide design', outcome: 'make slides easier to follow', tip: 'keeping one clear idea on each slide', action: 'removing extra text from your next presentation' },
  { lesson: 'financial literacy for teens', outcome: 'build smarter money habits early', tip: 'saving a portion of every allowance or payment', action: 'opening a simple savings tracker today' },
];

const lifestyleSeeds: LifestyleSeed[] = [
  { theme: 'morning energy', result: 'more focused mornings', routine: 'drink water, stretch, and avoid your phone for the first few minutes', action: 'starting tomorrow with a calmer first ten minutes' },
  { theme: 'sleep quality', result: 'better rest at night', routine: 'dim lights and create a wind down routine before bed', action: 'setting a bedtime alarm tonight' },
  { theme: 'healthy eating', result: 'more balanced meals during the week', routine: 'prepare simple ingredients ahead of time so choices become easier', action: 'planning your next three meals today' },
  { theme: 'home organization', result: 'a tidier and calmer space', routine: 'reset one small area every evening before you sleep', action: 'starting with your desk or bedside table' },
  { theme: 'fitness consistency', result: 'steady progress without burnout', routine: 'choose shorter sessions you can repeat often', action: 'committing to one realistic workout this week' },
  { theme: 'skin care basics', result: 'healthier looking skin', routine: 'cleanse gently and stay consistent with a simple routine', action: 'using fewer products more regularly' },
  { theme: 'confidence building', result: 'stronger everyday self belief', routine: 'notice small wins instead of waiting for huge milestones', action: 'writing down one thing you handled well today' },
  { theme: 'stress management', result: 'a calmer mind during busy days', routine: 'pause for a few slow breaths before reacting', action: 'taking one mindful break this afternoon' },
  { theme: 'digital balance', result: 'more intentional screen time', routine: 'set boundaries around apps that drain your energy', action: 'moving distracting apps off your home screen' },
  { theme: 'personal style', result: 'outfits that feel more like you', routine: 'build around pieces that already make you feel confident', action: 'creating one go to outfit formula' },
  { theme: 'weekend reset', result: 'a smoother start to the new week', routine: 'prep your space, meals, and schedule before Monday arrives', action: 'doing a 20 minute reset this weekend' },
  { theme: 'hydration habits', result: 'better daily energy', routine: 'keep water nearby and attach drinking to existing habits', action: 'refilling your bottle before every task change' },
  { theme: 'simple meal prep', result: 'less food stress during the week', routine: 'cook a few basics that can mix into multiple meals', action: 'prep one protein and one side today' },
  { theme: 'mindset growth', result: 'better recovery from setbacks', routine: 'treat mistakes like feedback instead of failure', action: 'reframing one difficult moment this week' },
  { theme: 'cleaner living spaces', result: 'less clutter and more ease at home', routine: 'put things back immediately after use', action: 'clearing one surface before the day ends' },
  { theme: 'journaling', result: 'clearer thoughts and better reflection', routine: 'write a few honest lines without trying to be perfect', action: 'spend five minutes journaling tonight' },
  { theme: 'healthy routines for busy parents', result: 'more balance in full schedules', routine: 'choose small habits that fit real life instead of ideal plans', action: 'pick one habit the whole family can support' },
  { theme: 'self care on a budget', result: 'more peace without overspending', routine: 'focus on rest, quiet, and simple rituals that feel restoring', action: 'plan one low cost reset moment today' },
  { theme: 'motivation after a slow week', result: 'renewed momentum', routine: 'restart with one easy win instead of waiting for perfect energy', action: 'finish one small task right now' },
  { theme: 'decluttering your wardrobe', result: 'simpler daily dressing', routine: 'keep pieces that fit well and serve your real life', action: 'remove five items you never reach for' },
];

const techSeeds: TechSeed[] = [
  { product: 'NovaNote', category: 'productivity apps', wowFactor: 'smart note organization that keeps ideas easy to find', action: 'Try NovaNote now and see how much smoother your workflow can feel.' },
  { product: 'Arena Rush X', category: 'mobile gaming', wowFactor: 'fast matches, bold visuals, and competitive team play', action: 'Jump into Arena Rush X and experience the energy for yourself.' },
  { product: 'PixelForge', category: 'creative software', wowFactor: 'tools that make visual editing feel quick and intuitive', action: 'Explore PixelForge and create your next project with less friction.' },
  { product: 'ShopPilot AI', category: 'ecommerce tools', wowFactor: 'automation that helps stores respond faster and sell smarter', action: 'See what ShopPilot AI can do for your business today.' },
  { product: 'Quest Realm Online', category: 'open world gaming', wowFactor: 'huge maps, rich missions, and constant discovery', action: 'Enter Quest Realm Online and start building your story.' },
  { product: 'PulseBoard', category: 'team collaboration platforms', wowFactor: 'live updates that keep everyone aligned in real time', action: 'Move your team into PulseBoard and simplify how work moves.' },
  { product: 'DriveSense Pro', category: 'car tech', wowFactor: 'data insights that help drivers stay aware and efficient', action: 'Check out DriveSense Pro and upgrade your driving experience.' },
  { product: 'SnapCart Live', category: 'social commerce apps', wowFactor: 'shopping experiences built around live community engagement', action: 'Open SnapCart Live and discover a more interactive way to shop.' },
  { product: 'BattleGrid VR', category: 'immersive gaming', wowFactor: 'action that feels bigger, sharper, and more personal', action: 'Step into BattleGrid VR and see why players keep coming back.' },
  { product: 'TutorLoop', category: 'education apps', wowFactor: 'bite sized learning paths that keep progress simple', action: 'Download TutorLoop and make daily learning easier to maintain.' },
  { product: 'ClipWave Studio', category: 'video creation tools', wowFactor: 'editing features that help creators move from idea to publish faster', action: 'Test ClipWave Studio and speed up your content workflow.' },
  { product: 'City Drift 9', category: 'racing games', wowFactor: 'slick controls, dramatic tracks, and nonstop excitement', action: 'Start your engines in City Drift 9 and hit the road today.' },
  { product: 'SecureNest', category: 'home tech', wowFactor: 'smart monitoring that feels simple instead of complicated', action: 'Bring SecureNest into your home and stay more connected to what matters.' },
  { product: 'StreamForge', category: 'creator platforms', wowFactor: 'tools that help creators grow and engage their audience more easily', action: 'Join StreamForge and build your next stage of growth.' },
  { product: 'HealthSync Go', category: 'wellness tech', wowFactor: 'clear tracking that turns health data into useful action', action: 'Use HealthSync Go and make your progress easier to understand.' },
  { product: 'Mythic Runes', category: 'fantasy games', wowFactor: 'deep characters, layered strategy, and beautiful environments', action: 'Play Mythic Runes and discover a world worth exploring.' },
  { product: 'WalletSpring', category: 'fintech apps', wowFactor: 'money tools that feel clear, modern, and easy to trust', action: 'Open WalletSpring and take more control of your finances.' },
  { product: 'EchoDesk', category: 'customer support tools', wowFactor: 'faster responses without losing the human touch', action: 'Try EchoDesk and improve the support experience for your customers.' },
  { product: 'Galaxy Tactics Arena', category: 'strategy gaming', wowFactor: 'smart battles that reward planning and creativity', action: 'Join Galaxy Tactics Arena and test your strategy skills.' },
  { product: 'FramePilot', category: 'camera apps', wowFactor: 'beautiful controls that help anyone shoot better content', action: 'Download FramePilot and level up the way you capture moments.' },
];

const discoverySeeds: DiscoverySeed[] = [
  { highlight: 'Azure Coast Resort', audience: 'travelers looking for a relaxing getaway', benefit: 'comfort, beautiful views, and easy booking', action: 'Plan your next break with Azure Coast Resort and enjoy a stay that feels effortless.' },
  { highlight: 'Maple Grove Residences', audience: 'families searching for a new home', benefit: 'space, security, and a welcoming neighborhood', action: 'Explore Maple Grove Residences and imagine your next chapter there.' },
  { highlight: 'Riverside Food Market', audience: 'locals who love fresh food and new flavors', benefit: 'variety, freshness, and community energy', action: 'Visit Riverside Food Market this week and discover something delicious.' },
  { highlight: 'Skyline Event Center', audience: 'people planning weddings and celebrations', benefit: 'elegant spaces and a memorable guest experience', action: 'Book Skyline Event Center and bring your event vision to life.' },
  { highlight: 'Harbor View Apartments', audience: 'young professionals looking for city living', benefit: 'convenience, comfort, and smart design', action: 'Take a tour of Harbor View Apartments and see if it fits your lifestyle.' },
  { highlight: 'Golden Palm Hotel', audience: 'business and leisure visitors', benefit: 'warm hospitality and dependable comfort', action: 'Choose Golden Palm Hotel for a stay that keeps things easy from check in to checkout.' },
  { highlight: 'Cedar Trails Eco Lodge', audience: 'nature lovers and weekend explorers', benefit: 'quiet surroundings and restorative outdoor experiences', action: 'Add Cedar Trails Eco Lodge to your next travel plan and unplug well.' },
  { highlight: 'Sunset Marina Villas', audience: 'buyers looking for premium property options', benefit: 'beautiful scenery and a high end lifestyle feel', action: 'Discover Sunset Marina Villas and step into a more elevated way of living.' },
  { highlight: 'Old Town Art Walk', audience: 'visitors who enjoy culture and creativity', benefit: 'local stories, art, and unique experiences', action: 'Spend your next afternoon at the Old Town Art Walk and enjoy the atmosphere.' },
  { highlight: 'Grand Oak Conference Hall', audience: 'brands and teams hosting professional events', benefit: 'smooth planning and polished presentation space', action: 'Host your next event at Grand Oak Conference Hall and keep every detail on track.' },
  { highlight: 'Blue Horizon Suites', audience: 'couples planning a short escape', benefit: 'privacy, comfort, and scenic surroundings', action: 'Book Blue Horizon Suites and turn your next getaway into something special.' },
  { highlight: 'Parkside Family Homes', audience: 'home seekers who want community and comfort', benefit: 'family friendly design and everyday convenience', action: 'Visit Parkside Family Homes and picture daily life with more ease.' },
  { highlight: 'City Lantern Festival', audience: 'families and friends looking for memorable outings', benefit: 'music, lights, and shared moments', action: 'Make time for the City Lantern Festival and enjoy a night worth remembering.' },
  { highlight: 'Heritage Courtyard Hotel', audience: 'travelers who appreciate charm and comfort', benefit: 'character, service, and a welcoming atmosphere', action: 'Stay at Heritage Courtyard Hotel and enjoy a more distinctive travel experience.' },
  { highlight: 'Lakefront Business Park', audience: 'business owners seeking a strategic location', benefit: 'visibility, accessibility, and room to grow', action: 'Explore Lakefront Business Park and position your business with confidence.' },
  { highlight: 'Bloomfield Wedding Garden', audience: 'couples planning elegant outdoor ceremonies', benefit: 'beauty, flexibility, and romantic atmosphere', action: 'Tour Bloomfield Wedding Garden and see how easily your dream day can come together.' },
  { highlight: 'Coral Bay Adventure Tours', audience: 'travelers who want active experiences', benefit: 'guided fun and memorable local discovery', action: 'Book Coral Bay Adventure Tours and make your next trip more exciting.' },
  { highlight: 'Summit Peak Cabins', audience: 'people craving a peaceful mountain break', benefit: 'fresh air, privacy, and calm surroundings', action: 'Escape to Summit Peak Cabins and recharge in a more natural setting.' },
  { highlight: 'Metro Loft Residences', audience: 'city renters who value modern living', benefit: 'style, convenience, and connected urban life', action: 'Check out Metro Loft Residences and upgrade your everyday environment.' },
  { highlight: 'Riverbend Cultural Center', audience: 'students, families, and curious visitors', benefit: 'learning, creativity, and community connection', action: 'Visit Riverbend Cultural Center and enjoy an experience that inspires and informs.' },
];

const businessPresets = businessSeeds.map(createBusinessPreset);
const educationPresets = educationSeeds.map(createEducationPreset);
const lifestylePresets = lifestyleSeeds.map(createLifestylePreset);
const techPresets = techSeeds.map(createTechPreset);
const discoveryPresets = discoverySeeds.map(createDiscoveryPreset);

export const avatarRandomScriptPool: AvatarRandomScriptPreset[] = [
  ...businessPresets,
  ...educationPresets,
  ...lifestylePresets,
  ...techPresets,
  ...discoveryPresets,
];

export function pickRandomAvatarScriptPreset() {
  const index = Math.floor(Math.random() * avatarRandomScriptPool.length);
  return avatarRandomScriptPool[index];
}
