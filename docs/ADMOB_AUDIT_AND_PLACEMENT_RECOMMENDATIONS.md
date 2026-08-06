# Cafa AI AdMob Audit & Placement Recommendations

**Date:** 2026-08-06  
**Audited By:** Kilo  
**Project:** Cafa AI React Native / Expo Mobile App  
**Version:** 2.4.2

---

## Executive Summary

**Google AdMob is NOT currently installed in this project.** There is no AdMob SDK dependency in `package.json`, no ad-unit configuration in `app.json`, and no ad-related code anywhere in the codebase. Before any ads can be shown, you will need to install `react-native-google-mobile-ads` (or the Expo-compatible equivalent) and configure AdMob app IDs for both Android and iOS.

---

## 1. App Screen Inventory

### Auth Flow (Onboarding / Login / Sign-up)
| Route | File | Purpose | Ads |
|-------|------|---------|-----|
| `/(auth)/onboarding` | `app/(auth)/onboarding.tsx` | 9-slide intro carousel | **Prohibited** |
| `/(auth)/login` | `app/(auth)/login.tsx` | Email/password login form | **Prohibited** |
| `/(auth)/signup` | `app/(auth)/signup.tsx` | Registration form | **Prohibited** |
| `/(auth)/forgot-password` | `app/(auth)/forgot-password.tsx` | Password reset request | **Prohibited** |
| `/(auth)/verify-otp` | `app/(auth)/verify-otp.tsx` | OTP verification (multi-flow) | **Prohibited** |
| `/(auth)/reset-password` | `app/(auth)/reset-password.tsx` | New password entry | **Prohibited** |

### Billing / Subscription Flow
| Route | File | Purpose | Ads |
|-------|------|---------|-----|
| `/(drawer)/plans` | `app/(drawer)/plans.tsx` | Upgrade hub, pricing, usage stats | **Prohibited** |
| `/billing/success` | `app/billing/success.tsx` | Post-checkout confirmation | **Prohibited** |
| `/billing/cancel` | `app/billing/cancel.tsx` | Checkout cancellation / abandonment | **Prohibited** |

### Core AI Screens (Content Generation & Chat)
| Route | File | Purpose | Auth Req | Tier Limits |
|-------|------|---------|----------|-------------|
| `/(drawer)/index` | `app/(drawer)/index.tsx` | Main chat composer + conversation | Guest allowed | Guest: 25 msgs; Free: 500/day |
| `/(drawer)/image-to-video` | `app/(drawer)/image-to-video.tsx` | Image -> video generation chat | Guest allowed | Free: 1 video/day |
| `/(drawer)/edit-image` | `app/(drawer)/edit-image.tsx` | Image editing chat | Guest allowed | Free: 5 images/day |
| `/(drawer)/avatar-video` | `app/(drawer)/avatar-video.tsx` | Avatar video creator | Auth only | Backend-enforced |
| `/(drawer)/voice` | `app/(drawer)/voice.tsx` | Text-to-speech + voice clone | Auth only | Free: 5/mo; Smart: 50; Pro: 200; Max: unlimited |
| `/(drawer)/writing-tools` | `app/(drawer)/writing-tools.tsx` | AI detection + humanize | Auth only | Backend quota (403 on limit) |
| `/(drawer)/cafa-life` | `app/(drawer)/cafa-life.tsx` | Real-time voice AI session | Auth only | Backend-enforced |

### Content Libraries & History (Non-Generation)
| Route | File | Purpose | Auth Req |
|-------|------|---------|----------|
| `/(drawer)/repo` | `app/(drawer)/repo.tsx` | Hub linking to images/videos/artifacts | Auth only |
| `/(drawer)/images` | `app/(drawer)/images.tsx` | Generated image gallery + download | Auth only |
| `/(drawer)/videos` | `app/(drawer)/videos.tsx` | Generated video gallery + download | Auth only |
| `/(drawer)/artifacts` | `app/(drawer)/artifacts.tsx` | File artifacts + documents list | Auth only |
| `/(drawer)/avatar-history` | `app/(drawer)/avatar-history.tsx` | Avatar video history list | Auth only |
| `/(drawer)/tools` | `app/(drawer)/tools.tsx` | Tools hub grid (avatar, image-to-video, edit, voice) | Auth only |

### Informational / Static Screens
| Route | File | Purpose | Auth Req |
|-------|------|---------|----------|
| `/(drawer)/help` | `app/(drawer)/help.tsx` | Contact support form | Open (no auth) |
| `/(drawer)/privacy-policy` | `app/(drawer)/privacy-policy.tsx` | Static legal text | Open (no auth) |
| `/(drawer)/terms-of-service` | `app/(drawer)/terms-of-service.tsx` | Static legal text | Open (no auth) |

### Global Modals / Overlays (not routes)
| Component | File | Purpose |
|-----------|------|---------|
| `SettingsModal` | `components/ui/SettingsModal.tsx` | Account, personalization, security, data controls |
| `AppPromptModal` | `components/ui/AppPromptModal.tsx` | Generic confirm/deny dialogs |
| `AppInputPromptModal` | `components/ui/AppInputPromptModal.tsx` | Text-input dialogs (rename chat, etc.) |
| `ImageLightbox` | `components/chat/ImageLightbox.tsx` | Fullscreen image preview |
| `PromptSuggestionsModal` | `components/ui/PromptSuggestionsModal.tsx` | Starter prompt picker |
| `VoiceCloneRecorderModal` | `components/ui/VoiceCloneRecorderModal.tsx` | Voice sample recorder |

---

## 2. Safe Ad-Placement Recommendations

### Placement A -- Tools Hub Bottom Banner
- **Screen:** Tools Hub (`/(drawer)/tools`)
- **File:** `app/(drawer)/tools.tsx`
- **Location:** Bottom of the `ScrollView`, below the tool cards grid, above safe-area inset.
- **Format:** Anchored adaptive banner
- **Safety:** Safe
- **Why:** No sensitive inputs, no generation happening, no action buttons near the bottom. The grid ends well above the safe area on most phones.
- **Trigger:** Load on mount.
- **Frequency:** Persistent while on screen.
- **Free-only:** Yes
- **Accidental click risk:** Very low (below all interactive cards).
- **Interrupt risk:** None.
- **Layout change:** Add bottom padding to the `ScrollView` content container equal to banner height + safe area.

### Placement B -- Repo Hub Bottom Banner
- **Screen:** Repo Hub (`/(drawer)/repo`)
- **File:** `app/(drawer)/repo.tsx`
- **Location:** Bottom of the `ScrollView`, below the hub cards grid.
- **Format:** Anchored adaptive banner
- **Safety:** Safe
- **Why:** Same reasoning as Tools Hub. Non-interactive navigation landing page.
- **Trigger:** Load on mount.
- **Frequency:** Persistent while on screen.
- **Free-only:** Yes
- **Accidental click risk:** Very low.
- **Interrupt risk:** None.
- **Layout change:** Add bottom padding to the `ScrollView` content container.

### Placement C -- Image Gallery Inline Banner
- **Screen:** Image History (`/(drawer)/images`)
- **File:** `app/(drawer)/images.tsx`
- **Location:** Inside the `FlatList`, rendered as a `ListFooterComponent` or every N rows (e.g., after every 6 image cards).
- **Format:** Inline adaptive banner
- **Safety:** Safe
- **Why:** The screen is a read-only gallery. No typing, no uploading, no generation. The user is browsing past results.
- **Trigger:** Load when the list item becomes visible.
- **Frequency:** Persistent per viewport.
- **Free-only:** Yes
- **Accidental click risk:** Low (between non-interactive image thumbnails).
- **Interrupt risk:** None.
- **Layout change:** Increase `FlatList` `contentContainerStyle` bottom padding so the banner does not float over the last row.

### Placement D -- Video Gallery Inline Banner
- **Screen:** Video History (`/(drawer)/videos`)
- **File:** `app/(drawer)/videos.tsx`
- **Location:** Inside the `FlatList`, rendered as a `ListFooterComponent` or between video cards.
- **Format:** Inline adaptive banner
- **Safety:** Safe
- **Why:** Read-only gallery. Videos auto-play when viewable, but ads do not interfere with playback controls (which are per-card overlays).
- **Trigger:** Load when visible.
- **Frequency:** Persistent per viewport.
- **Free-only:** Yes
- **Accidental click risk:** Low.
- **Interrupt risk:** None.
- **Layout change:** Add `ListFooterComponent` spacer equal to banner height + safe area.

### Placement E -- Artifacts List Inline Banner
- **Screen:** Artifacts (`/(drawer)/artifacts`)
- **File:** `app/(drawer)/artifacts.tsx`
- **Location:** Inside the `FlatList`, rendered as a `ListFooterComponent`.
- **Format:** Inline adaptive banner
- **Safety:** Safe
- **Why:** Read-only document/artifact list. No uploads or generation on this screen.
- **Trigger:** Load when visible.
- **Frequency:** Persistent per viewport.
- **Free-only:** Yes
- **Accidental click risk:** Low.
- **Interrupt risk:** None.
- **Layout change:** Add footer spacer equal to banner height + safe area.

### Placement F -- Avatar History Inline Banner
- **Screen:** Avatar History (`/(drawer)/avatar-history`)
- **File:** `app/(drawer)/avatar-history.tsx`
- **Location:** Inside the `FlatList` as a `ListFooterComponent`.
- **Format:** Inline adaptive banner
- **Safety:** Safe
- **Why:** Read-only history of avatar videos.
- **Trigger:** Load when visible.
- **Frequency:** Persistent per viewport.
- **Free-only:** Yes
- **Accidental click risk:** Low.
- **Interrupt risk:** None.
- **Layout change:** Add footer spacer.

---

## 3. Risky Placements That Should Be Avoided

### Risky 1 -- Main Chat Screen (`/(drawer)/index`)
- **Why risky:** The entire screen is a high-density interactive surface.
  - A bottom banner would compete with the **Send button**, **mic button**, **attachment button**, and the composer `TextInput`.
  - An inline banner inside the `FlashList` would appear **between user prompts and AI responses** -- a direct policy violation.
  - The screen has real-time streaming text, placeholder cards during generation, and guest upsell modals.
- **Verdict:** Avoid. Do **not** place any ad inside the chat thread or above the composer.

### Risky 2 -- Image-to-Video / Edit-Image Screens
- **Why risky:** These are wrappers around the same `ChatScreen` component (`index.tsx`) with `screenMode` set to `image-to-video` or `edit-image`.
  - Same composer, Send button, attachment trigger, and message list.
  - Real-time generation placeholders animate while the job runs.
- **Verdict:** Avoid. Treat exactly like the main chat screen.

### Risky 3 -- Avatar Video Creator (`/(drawer)/avatar-video`)
- **Why risky:** Long scrolling form with many interactive sections (avatar picker, script input, voice picker, Generate Video button). During generation, an `AvatarGenerationLoader` overlays the screen. After generation, a result video appears. A banner placed mid-scroll could sit directly above the **Generate Video** or **Download** buttons, causing accidental clicks.
- **Verdict:** Risky. Not recommended for MVP.

### Risky 4 -- Text-to-Speech (`/(drawer)/voice`)
- **Why risky:** The screen has a large text input, a **Convert to Speech** button, play/download buttons on results, and voice library modals. A bottom banner would sit immediately below the Convert button. The screen also shows processing states.
- **Verdict:** Risky. Not recommended for MVP.

### Risky 5 -- Writing Tools (`/(drawer)/writing-tools`)
- **Why risky:** Contains a large multiline input, **Run Detection / Humanize Text** buttons, and inline result cards that appear dynamically. A banner below the input would be too close to the action buttons. A banner below results would shift as new results render.
- **Verdict:** Risky. Not recommended for MVP.

### Risky 6 -- Cafa Life (`/(drawer)/cafa-life`)
- **Why risky:** Real-time voice AI session with an animated orb, mute toggle, session status chip, and elapsed timer. This is an active, time-sensitive experience. Any ad would be highly intrusive.
- **Verdict:** Avoid.

### Risky 7 -- Help Screen (`/(drawer)/help`)
- **Why risky:** Contains a contact form with 4 text inputs (name, email, subject, message) and a **Submit** button. A banner near the bottom could overlap the Submit button or keyboard.
- **Verdict:** Risky. Not recommended for MVP.

---

## 4. Screens Where No Ads Should Appear

| Screen / Route | Reason |
|----------------|--------|
| `/(auth)/onboarding` | Onboarding flow -- policy prohibits ads |
| `/(auth)/login` | Login screen -- policy prohibits ads |
| `/(auth)/signup` | Sign-up screen -- policy prohibits ads |
| `/(auth)/forgot-password` | Password reset -- policy prohibits ads |
| `/(auth)/verify-otp` | Authentication step -- policy prohibits ads |
| `/(auth)/reset-password` | Password reset -- policy prohibits ads |
| `/(drawer)/plans` | Subscription / pricing screen -- policy prohibits ads |
| `/billing/success` | Post-checkout confirmation -- policy prohibits ads |
| `/billing/cancel` | Checkout abandonment -- policy prohibits ads |
| `/(drawer)/index` (Chat) | AI conversation -- high interaction density; ad would violate "no ads beside Send / between prompt and response" |
| `/(drawer)/image-to-video` | Active generation chat -- same as main chat |
| `/(drawer)/edit-image` | Active generation chat -- same as main chat |
| `/(drawer)/cafa-life` | Real-time voice session -- too intrusive |
| `SettingsModal` (Account section) | Contains subscription management, delete account -- sensitive |
| `RevenueCatPaywall` | Paywall component -- policy prohibits ads |
| `AppPromptModal` / `AppInputPromptModal` | Overlays and dialogs -- ads inside modals are poor UX and policy risky |

---

## 5. Recommended Minimum Viable Ad Strategy

### Phase 1 -- Banners Only (MVP)
Start with the **lowest-risk, highest-confidence** placements:

1. **Tools Hub** (`/(drawer)/tools`) -- anchored adaptive banner at bottom.
2. **Repo Hub** (`/(drawer)/repo`) -- anchored adaptive banner at bottom.
3. **Image History** (`/(drawer)/images`) -- inline adaptive banner in `FlatList` footer.
4. **Video History** (`/(drawer)/videos`) -- inline adaptive banner in `FlatList` footer.
5. **Artifacts** (`/(drawer)/artifacts`) -- inline adaptive banner in `FlatList` footer.

**Why this is the MVP:**
- These are all **read-only, non-generation, non-interactive** landing pages or galleries.
- No risk of interrupting AI generation, payment, upload, or conversation.
- No risk of accidental clicks on primary action buttons.
- Easy to implement with `ListFooterComponent` or `ScrollView` bottom padding.

### Phase 2 -- Optional Rewarded Ads (Future)
After Phase 1 is stable and revenue data is collected, consider ONE rewarded ad placement:

- **Placement:** A small "Watch ad for bonus" button on the **Plans / Usage** screen or inside a free-user limit notice.
- **Reward examples:**
  - `+1 image generation` for free users who have hit their 5/day limit.
  - `+5 chat messages` for free users near their 500/day limit.
- **Requirements:** Must show the exact reward before the user watches. Grant reward only on the AdMob completion event. Never offer permanent premium access.

### Phase 3 -- Interstitials (Future, Very Conservative)
Only consider after 30+ days of banner data:

- **Allowed trigger:** After a free user successfully completes a generation task (e.g., an image finishes generating) **and then navigates away** from the generation screen to a gallery or hub.
- **Frequency cap:** Max **1 interstitial per 8-10 free-user completed actions**, and never more than 1 per 5 minutes.
- **Never show:** To paid users, during active generation, immediately after app launch, or on any billing/auth screen.

**For now, skip interstitials entirely in the MVP.**

---

## 6. Recommended Ad-Unit Names

Use consistent naming so you can track iOS vs Android separately in AdMob.

| Ad Unit | Android ID Suffix | iOS ID Suffix |
|---------|-------------------|---------------|
| Tools Hub Banner | `ca-app-pub-xxx/yyyyyyyyyy` | `ca-app-pub-xxx/zzzzzzzzzz` |
| Repo Hub Banner | `ca-app-pub-xxx/yyyyyyyyyy` | `ca-app-pub-xxx/zzzzzzzzzz` |
| Image Gallery Banner | `ca-app-pub-xxx/yyyyyyyyyy` | `ca-app-pub-xxx/zzzzzzzzzz` |
| Video Gallery Banner | `ca-app-pub-xxx/yyyyyyyyyy` | `ca-app-pub-xxx/zzzzzzzzzz` |
| Artifacts Gallery Banner | `ca-app-pub-xxx/yyyyyyyyyy` | `ca-app-pub-xxx/zzzzzzzzzz` |
| Rewarded Bonus (future) | `ca-app-pub-xxx/yyyyyyyyyy` | `ca-app-pub-xxx/zzzzzzzzzz` |

**Suggested Expo `app.json` plugin config** (to be added later during implementation):
```json
[
  "react-native-google-mobile-ads",
  {
    "androidAppId": "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy",
    "iosAppId": "ca-app-pub-zzzzzzzzzzzzzzzz~wwwwwwwwww"
  }
]
```

---

## 7. Files That Would Need Modification During Implementation

| File | What Would Change |
|------|-------------------|
| `package.json` | Add `react-native-google-mobile-ads` dependency |
| `app.json` | Add AdMob app IDs and plugin configuration |
| `app/(drawer)/tools.tsx` | Add banner component at bottom of `ScrollView` |
| `app/(drawer)/repo.tsx` | Add banner component at bottom of `ScrollView` |
| `app/(drawer)/images.tsx` | Add banner as `ListFooterComponent` in `FlatList`; adjust `contentContainerStyle` padding |
| `app/(drawer)/videos.tsx` | Add banner as `ListFooterComponent` in `FlatList`; adjust `contentContainerStyle` padding |
| `app/(drawer)/artifacts.tsx` | Add banner as `ListFooterComponent` in `FlatList`; adjust `contentContainerStyle` padding |
| `components/ui/AppScreen.tsx` | Potentially add a `showAdBanner` prop or wrapper to reserve safe-area + banner height |
| `context/AppContext.tsx` or `context/RevenueCatContext.tsx` | Add an `isAdFree` boolean derived from `activeTier !== 'free'` to conditionally render ads |
| `components/ui/RequireAuthRoute.tsx` | Optionally wrap with ad-free check for auth-gated screens |
| New file: `components/ads/AdaptiveBanner.tsx` | Reusable banner component that handles safe-area insets, free-user gating, and platform sizing |
| New file: `components/ads/useAdVisibility.ts` | Hook that returns `showAds: boolean` based on `isPro`, `isAuthenticated`, and screen allow-list |

---

## 8. AdMob Policy Risks Found in the Current UI

1. **Paid-user detection must be rock-solid.**
   - The app already has `activeTier`, `isPro`, and `authUser.subscriptionTier`. You must ensure ads are **never** rendered when `activeTier !== 'free'`. A single ad shown to a Max subscriber is a policy violation.

2. **Guest mode complicates ad targeting.**
   - Unauthenticated guests see the chat screen with 25-message limit and upsell prompts. If you ever add ads for guests, you must be careful not to show them on auth screens. The safest path is: **only show ads to authenticated free users** (`isAuthenticated && activeTier === 'free'`).

3. **Real-time generation overlays.**
   - The chat screen shows `ImageGenerationPlaceholder`, `VideoGenerationPlaceholder`, and `FileGenerationPlaceholder` while jobs run. Any ad accidentally rendered during this window would violate "no ads while content is being generated." Ensure ad containers are hidden or unmounted during `isGenerating` states on any future risky screens.

4. **Composer bottom sheet / attachment menu.**
   - The chat screen has a modal bottom sheet for uploads (`attachmentMenuOpen`). A bottom banner that persists behind this sheet could be partially visible and clickable through the overlay -- an accidental-click risk. Always unmount or hide banners when modals are open.

5. **Keyboard overlap.**
   - Many screens have text inputs that bring up the keyboard. Banners must be placed with `useSafeAreaInsets()` and must not sit on top of the keyboard. Use `KeyboardAvoidingView` or keyboard event listeners to dismiss/hide banners when the keyboard opens.

6. **No "ad wall" or forced interaction.**
   - Never require users to watch an ad to log in, sign up, or reach the chat screen. The current auth flow is clean; keep it that way.

---

## Next Step

**Do not edit any files yet.** Review the recommendations above. Once you approve:
1. Install `react-native-google-mobile-ads` and configure `app.json`.
2. Create a reusable `AdaptiveBanner` component and a `useAdVisibility` hook.
3. Implement the 5 Phase-1 banner placements with free-user-only gating and safe-area handling.
