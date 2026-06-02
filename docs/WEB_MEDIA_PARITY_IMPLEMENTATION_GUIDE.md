# Web Media Parity Implementation Guide

This guide documents the full set of product and frontend behaviors implemented on mobile so the same experience can be recreated on web.

The goal is parity, not approximation.

Implement the web version so that:
- the drawer CTA behavior matches mobile
- the two new dedicated media screens behave like mobile
- intent guards behave the same way before any backend request is sent
- direct media endpoints are used on the dedicated screens
- the image and video gallery pages are optimized for weaker devices
- accessibility is first-class

---

## 1. Features Added On Mobile

The mobile app now includes:

1. Two dedicated screens:
   - `Image-to-video`
   - `Edit image`
2. Drawer CTA overflow behavior:
   - top 3 CTA buttons always visible
   - `Show more` / `Show less` reveals extra CTA buttons
3. Dedicated-screen starter prompts:
   - prompts are tailored to the screen purpose
4. Dedicated-screen upload restrictions:
   - only image upload is allowed
   - document upload is removed
5. Frontend-only intent guards:
   - wrong-screen requests are blocked before backend send
   - user sees an in-chat handoff card to the correct screen
6. Frontend-only image-required guard:
   - if the prompt matches the current dedicated screen’s purpose but no image is attached, sending is blocked
   - user sees an in-chat prompt telling them to upload an image
7. Direct backend media integration:
   - `Edit image` uses `POST /media/image/edit`
   - `Image-to-video` uses `POST /media/video/image-to-video`
8. Dedicated-screen media actions are simplified:
   - no media reference feature on `Edit image` and `Image-to-video`
9. Search-result rendering cleanup:
   - links are visually cleaned up and less noisy
10. Gallery performance hardening:
   - `Videos` page no longer renders a full player in every list row
   - `Images` page uses lighter renderItem patterns and tighter virtualization

---

## 2. New Web Routes

Create these web routes/pages:

1. Main chat
   - existing route
2. `Image-to-video`
   - dedicated media route
3. `Edit image`
   - dedicated media route

Recommended route paths:

```txt
/chat
/image-to-video
/edit-image
```

If web already uses different route conventions, keep the existing convention but preserve the same behavior.

---

## 3. Drawer CTA Behavior

### Required CTA layout

Always show:
1. `New chat`
2. `Images`
3. `Videos`

Behind `Show more`:
1. `Image-to-video`
2. `Edit image`
3. `Artifacts`

### Behavior

- `Show more` expands hidden actions
- `Show less` collapses them again
- animation should be smooth, not abrupt
- use height + opacity transition, not mount/unmount snap

### Accessibility

The toggle button must:
- be a real `button`
- have an accessible label:
  - `Show more actions`
  - `Show fewer actions`
- expose expanded state:
  - `aria-expanded="true|false"`
- control a region:
  - `aria-controls="drawer-extra-actions"`

The hidden panel must:
- have an `id` matching `aria-controls`
- be focus-safe when collapsed
- not allow tab focus into hidden children when closed

Recommended implementation:

```tsx
<button
  type="button"
  aria-expanded={expanded}
  aria-controls="drawer-extra-actions"
  aria-label={expanded ? 'Show fewer actions' : 'Show more actions'}
>
  {expanded ? 'Show less' : 'Show more'}
</button>

<div
  id="drawer-extra-actions"
  hidden={!expanded}
>
  ...
</div>
```

For animation, prefer:
- `max-height`
- `opacity`
- `transform: translateY(...)`

Avoid:
- instant conditional rendering with no motion

---

## 4. Reuse The Main Chat Shell

Do not build separate UI systems for the two new pages.

Reuse the main chat page layout:
- conversation area
- message list
- starter prompt area
- composer
- attachment UI
- status notices
- loading placeholders

### Route-aware chat mode

Use a shared screen container with a route mode, for example:

```ts
type ChatScreenMode = 'chat' | 'image-to-video' | 'edit-image';
```

Then derive:
- welcome message
- starter prompts
- attachment menu options
- allowed actions
- guard logic

---

## 5. Dedicated Welcome Messages

### Image-to-video

Use a dedicated welcome/template message like:

`This section is for generating a video based on an image. Upload an image, then describe the motion, camera movement, or scene you want.`

### Edit image

Use:

`This section is for editing an image. Upload an image, then describe the changes, style updates, or fixes you want.`

---

## 6. Starter Prompts

### Image-to-video

Use prompts like:
- `Generate a video from this image with soft cinematic camera movement.`
- `Turn this image into a short product reveal video with subtle motion.`
- `Animate this image into a dramatic scene with slow zoom and drifting light.`

### Edit image

Use prompts like:
- `Edit this image by cleaning the background and improving the lighting.`
- `Retouch this image to look sharper, brighter, and more polished.`
- `Transform this image into a premium brand-style visual with better color balance.`

Behavior:
- clicking a starter prompt should fill or send the prompt the same way mobile does
- if no image is attached on a dedicated screen, sending must still be blocked by the image-required guard

---

## 7. Attachment Rules On Dedicated Screens

### Main chat

Allow:
- image upload
- document upload where applicable

### Image-to-video and Edit image

Allow:
- image upload only

Remove:
- document upload

Rename attachment UI label:
- use `Image upload`

Accessibility:
- upload button label should clearly communicate:
  - `Upload image`
  - or `Image upload`

---

## 8. Intent Guard System

All intent guard behavior must happen on the frontend before sending to backend.

There are two different guard classes:

1. `Wrong screen` guard
2. `Missing image` guard

They must not be mixed together.

---

## 9. Wrong-Screen Guard

### Purpose

If the user is on a screen meant for one flow but asks for another flow, do not send to backend.

Instead, show an in-chat helper card that tells them which screen to use and gives a CTA to open it.

### Required examples

1. On `Edit image`
   - user uploads image
   - asks to generate a video from it
   - show handoff card to `Image-to-video`

2. On `Image-to-video`
   - user uploads image
   - asks to edit it
   - show handoff card to `Edit image`

3. On `Image-to-video`
   - user asks a generic non-media question
   - show handoff card to main chat

4. On `Edit image`
   - user asks a generic non-media question
   - show handoff card to main chat

5. On main chat
   - user uploads an image and asks to edit it
   - show handoff card to `Edit image`

6. On main chat
   - user uploads an image and asks to generate a video from it
   - show handoff card to `Image-to-video`

### Handoff card requirements

Create a reusable card component.

Suggested fields:

```ts
type ScreenHandoffConfig = {
  target: 'chat' | 'image-to-video' | 'edit-image';
  title: string;
  description: string;
  ctaLabel: string;
  iconName: string;
};
```

Examples:

#### To main chat
- title: `Use main chat for this`
- description: `This screen is only for generating a video from an uploaded image. For anything else, continue in the main chat.`
- CTA: `Open main chat`

#### To edit image
- title: `Better in Edit image`
- description: `This request looks like editing an uploaded image. Use the Edit image screen for a cleaner workflow.`
- CTA: `Open Edit image`

#### To image-to-video
- title: `Better in Image-to-video`
- description: `This request looks like turning an uploaded image into a video. Use the dedicated Image-to-video screen for that flow.`
- CTA: `Open Image-to-video`

### Important

Blocked handoff attempts should still log the frontend request in development.

Use a mode like:

```json
{
  "mode": "frontend-intent-handoff-blocked"
}
```

---

## 10. Missing-Image Guard

### Purpose

If the prompt matches the current dedicated screen’s purpose, but the user has not attached an image, do not send to backend and do not redirect away.

Instead:
- keep user on same screen
- show an in-chat helper card telling them to upload an image
- CTA should trigger image picker

### Required examples

1. On `Image-to-video`
   - prompt: `Generate a video from this image with soft cinematic camera movement.`
   - no image attached
   - block send
   - show `Add an image first`

2. On `Edit image`
   - prompt: `Edit this image by cleaning the background and improving the lighting.`
   - no image attached
   - block send
   - show `Add an image first`

### Required card behavior

Create a second reusable component.

Suggested fields:

```ts
type ImageRequirementConfig = {
  title: string;
  description: string;
  ctaLabel: string;
  iconName: string;
};
```

Example copy:

#### Image-to-video
- title: `Add an image first`
- description: `Upload an image before sending this prompt so Cafa AI can generate a video from it.`
- CTA: `Upload image`

#### Edit image
- title: `Add an image first`
- description: `Upload an image before sending this prompt so Cafa AI can edit it for you.`
- CTA: `Upload image`

### Important behavior

- no backend request should be made
- the prompt should not silently disappear
- development logging should still happen

Use a mode like:

```json
{
  "mode": "frontend-image-required-blocked"
}
```

---

## 11. Intent Detection Rules

Use lightweight frontend heuristics.

### Video intent

Use either:
- existing `extractVideoPrompt(...)`
- or a heuristic like:
  - `generate a video`
  - `turn this image into a video`
  - `animate this image`
  - `add motion`

### Edit-image intent

Use a heuristic based on:
- edit verbs:
  - `edit`
  - `retouch`
  - `enhance`
  - `improve`
  - `fix`
  - `clean`
  - `remove`
  - `replace`
  - `erase`
  - `crop`
  - `upscale`
  - `sharpen`
  - `brighten`
  - `restore`
- plus image cues:
  - `image`
  - `photo`
  - `picture`
  - `background`
  - `lighting`
  - `color`
  - `face`
  - `skin`
  - `object`
  - `logo`

Normalize prompt first:
- lowercase
- strip punctuation
- compress spaces

---

## 12. Dedicated Media Backend Wiring

### Image edit endpoint

Use:

```txt
POST /media/image/edit
```

FormData fields:
- `image`
- `prompt`

### Image-to-video endpoint

Use:

```txt
POST /media/video/image-to-video
```

FormData fields:
- `image`
- `files`
- `prompt`
- `duration`
- `aspectRatio`

### Important multipart behavior

The dedicated media screens must send real multipart file uploads, not local `file:///...` strings in JSON.

#### Correct shape

```ts
const form = new FormData();
form.append('prompt', prompt);
form.append('duration', '5');
form.append('aspectRatio', '16:9');

const file = {
  uri: image.uri,
  name: image.fileName ?? 'source.jpg',
  type: image.mimeType ?? 'image/jpeg',
};

form.append('image', file as any);
form.append('files', file as any);
```

### Web note

On web, `File` / `Blob` is fine, but preserve the same field names:
- `image`
- `files`

### Do not

- do not send JSON with local client file paths
- do not skip multipart file upload
- do not accidentally set JSON headers for these requests

---

## 13. Frontend Validation Before Upload

Validate before sending to backend:

- allowed mime types:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
- max size:
  - `10MB`

Error messages:
- `Please upload an image to continue.`
- `Only JPEG, PNG, and WebP images are supported.`
- `Image must be 10MB or smaller.`
- `Please provide a prompt describing what you want.`

---

## 14. Dedicated-Screen Send Flow

### Image-to-video

When send is allowed:

1. create user message bubble
2. create assistant placeholder bubble with video-loading state
3. call direct media endpoint
4. replace placeholder with generated video card
5. keep existing download/share actions
6. do not create media references on these screens

### Edit image

When send is allowed:

1. create user message bubble
2. create assistant placeholder bubble with image-loading state
3. call direct media endpoint
4. replace placeholder with generated image card
5. keep existing download/share actions
6. do not create media references on these screens

### Reuse

Reuse the same:
- image loading placeholder
- video loading placeholder
- generated media card presentation
- haptics where applicable on web substitute with subtle visual affordance

On web:
- if haptics are unavailable, replace with micro-feedback like button pressed state or toast

---

## 15. Remove Reference Feature On Dedicated Media Screens

Main chat still supports media referencing.

Dedicated screens must not.

Remove on:
- generated image action row
- generated video action row
- composer reference chip

Keep on:
- main chat only

Suggested conditional:

```ts
const showReference = screenMode === 'chat';
```

---

## 16. Development Logging

In development, log:

1. request payload before send
2. final parsed response after completion
3. blocked intent / blocked image-required attempts

### Request log

```txt
[chat-send:payload]
```

Should include:
- endpoint
- mode
- prompt / message
- conversationId where applicable
- model
- attachments
- screenMode if helpful

### Final response log

```txt
[chat-send:response]
```

Should include:
- endpoint
- requestKind
- isAuthenticated
- conversationId
- idempotencyKey if applicable
- final response text or response object

### Blocked logs

Use modes like:
- `frontend-intent-handoff-blocked`
- `frontend-image-required-blocked`

---

## 17. Search-Style Response Rendering Cleanup

If web search-result responses currently look messy:

### Normalize responses before rendering

1. remove stray standalone links that appear above list items
2. convert noisy inline retailer/source links into cleaner source presentation
3. collapse a giant `Sources:` dump into one compact section

### Link styling

Avoid default bright blue links, especially on dark backgrounds.

Use:
- dark mode:
  - softer icy accent
  - subtle tinted background pill
- light mode:
  - deeper ink-blue

Avoid:
- flat bright browser default blue
- harsh underline-only treatment

Accessibility:
- maintain visible focus state
- maintain contrast ratio
- do not rely on color alone; keep clear affordance

---

## 18. Videos Gallery Performance Parity

### Problem on mobile

The original videos list created a real video player inside every list row.

That caused:
- slow `VirtualizedList` updates
- memory pressure
- crashes on weaker phones

### Web parity requirement

Do not autoplay or instantiate heavy playback infrastructure for every list item.

### Recommended pattern

In the grid/list row:
- show a lightweight poster-style preview shell
- show play CTA
- no active player per row

When opened:
- show one shared playback modal / sheet / route-level player
- only one active player instance at a time

### Required list optimizations

For long lists:
- memoized `renderItem`
- memoized `keyExtractor`
- tighter virtualization/windowing
- avoid rebuilding inline objects per row where possible

If using React:
- `React.memo` on card
- `useCallback` for render item
- `useMemo` for width calculations

If using virtualization library:
- small initial render batch
- small window size
- clipping/unmounting offscreen rows if available

### Result expected

The list should scroll without:
- long update stalls
- excessive memory growth
- too many active media elements

---

## 19. Images Gallery Performance Parity

Images are lighter than videos, but still need optimization.

### Required optimizations

1. memoized card component
2. memoized `renderItem`
3. memoized `keyExtractor`
4. tighter list virtualization/windowing
5. avoid heavy inline closures in `renderItem`
6. avoid rebuilding headers/derived URLs unnecessarily

### Keep

- lazy image loading
- loading placeholders
- secure/auth image headers where needed

### Recommended web behavior

Use:
- `loading="lazy"` where appropriate
- responsive image sizing
- constrained preview sizes
- virtualized grid if history can grow large

---

## 20. Accessibility Requirements For Web

Make web implementation fully accessible, not just visually similar.

### General

- all interactive elements must be real buttons or links
- visible focus styles are mandatory
- do not use div-onClick for critical actions
- support keyboard-only usage across drawer, chat, upload, modals, and galleries

### Drawer

- `Show more` / `Show less` must expose `aria-expanded`
- collapsed content must not be tabbable

### Chat helper cards

Both helper cards:
- must be keyboard focusable via their CTA only
- must have meaningful button labels
- must not trap focus

Suggested CTA labels:
- `Open main chat`
- `Open Edit image`
- `Open Image-to-video`
- `Upload image`

### Upload flow

- upload button must be reachable by keyboard
- error/helper message should be announced
- use `aria-live="polite"` for helper/status messages

### Generated image/video cards

- provide useful accessible labels
- download/delete/share buttons need labels and hints
- if video opens modal, move focus into modal
- on close, return focus to triggering element

### Modal player

- trap focus while open
- `Escape` closes
- close button is first or clearly reachable
- `aria-modal="true"`
- title announced

### Toasts / notices

- use live region
- avoid only visual notice

### Color and contrast

- ensure button contrast passes WCAG
- link styling must remain readable in dark mode
- do not rely on low-contrast accent tints only

---

## 21. Suggested Component Map For Web

Recommended reusable components:

1. `ChatScreenShell`
2. `ScreenHandoffCard`
3. `ImageRequirementCard`
4. `MediaActionRow`
5. `DrawerActionGroup`
6. `VideoGalleryCard`
7. `ImageGalleryCard`
8. `SharedVideoPlayerModal`

Recommended route-aware props:

```ts
type ChatScreenMode = 'chat' | 'image-to-video' | 'edit-image';
```

Recommended message model additions:

```ts
type UiMessage = {
  ...
  screenHandoff?: {
    target: 'chat' | 'image-to-video' | 'edit-image';
    title: string;
    description: string;
    ctaLabel: string;
    iconName?: string;
  };
  imageRequirement?: {
    title: string;
    description: string;
    ctaLabel: string;
    iconName?: string;
  };
};
```

---

## 22. Recommended QA Checklist

### Drawer

- top 3 CTA buttons always visible
- `Show more` reveals extra CTA buttons
- `Show less` collapses them
- keyboard navigation works
- screen reader announces expanded state

### Image-to-video page

- only image upload available
- starter prompts are correct
- valid prompt + no image => image-required card
- valid prompt + image => direct media request succeeds
- wrong prompt => handoff card appears
- generated video renders with actions
- no reference feature

### Edit image page

- only image upload available
- starter prompts are correct
- valid prompt + no image => image-required card
- valid prompt + image => direct media request succeeds
- wrong prompt => handoff card appears
- generated image renders with actions
- no reference feature

### Main chat

- uploaded image + edit request => handoff to `Edit image`
- uploaded image + video request => handoff to `Image-to-video`
- reference feature still works here

### Galleries

- long video history does not create one player per row
- opening a video uses one shared player
- image history scrolling stays smooth
- no excessive memory spikes while scrolling

### Accessibility

- all CTAs focusable
- all helper messages announced
- modals trap focus and restore focus on close
- contrast is good in light and dark themes

---

## 23. Implementation Priority Order

Recommended order for the web team:

1. Add the two new routes
2. Reuse the main chat shell with `screenMode`
3. Add drawer CTA overflow section
4. Add starter prompts and upload restrictions
5. Add `ScreenHandoffCard`
6. Add `ImageRequirementCard`
7. Implement frontend guards
8. Wire direct media endpoints
9. Remove reference feature on dedicated screens
10. Add development logging parity
11. Clean up search-result rendering
12. Optimize video gallery
13. Optimize image gallery
14. Final accessibility pass

---

## 24. Final Product Principle

The web implementation should feel like the dedicated media tools are first-class product surfaces, not hacked branches of chat.

That means:
- same visual language
- same helper behaviors
- same guard logic
- same backend behavior
- same clarity around when user should stay, upload, or switch screens

If web matches these rules, it will behave like mobile rather than merely resemble it.
