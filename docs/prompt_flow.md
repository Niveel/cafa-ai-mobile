gyau eritten:
# Cafa AI — Chat Classification & Document Wizard Update

This document covers three new changes to implement on the frontend.

Base URL: https://cafaapi.niveel.com/api/v1

---

## 1. New Endpoint — POST /api/v1/chat/classify

Call this endpoint BEFORE sending any chat message. It tells you what type of response to expect so you can show the correct loading animation immediately.

Authentication: Required

Request body:
{
  "message": "Generate a video of Ghana Black Stars",
  "attachments": [],
  "hasImageAttachment": false,
  "hasDocumentAttachment": false
}


Response:
{
  "success": true,
  "data": {
    "responseType": "video",
    "confidence": 0.97,
    "subIntent": "generate_video",
    "label": "Generating video",
    "description": "Creating your video with AI"
  }
}


responseType values:

| responseType | label | description | UI Action |
|---|---|---|---|
| text | Thinking | Getting your answer ready | Normal chat loading |
| search | Searching | Finding the latest information | Search animation |
| image | Generating image | Creating your image with AI | Image generation animation |
| video | Generating video | Creating your video with AI | Video generation animation |
| artifact | Creating document | Building your document | Document generation animation |
| image_analysis | Analyzing image | Reading your image | Analysis animation |
| document_analysis | Analyzing document | Reading your document | Analysis animation |

This endpoint never fails. If classification fails internally it always returns responseType: "text" as a safe default.

---

## 2. Updated Flow — How to Use classify + detect Together

Old flow (remove this):
User sends message
→ Call /documents/wizard/detect
→ If isDocumentRequest: true → show form
→ Else → send to chat


New flow (implement this):
User sends message
         ↓
Step 1: POST /chat/classify
→ Show correct loading animation immediately based on responseType
         ↓
Step 2: Is responseType === "artifact"?
  YES → POST /documents/wizard/detect
        → Check needsForm field (see Section 3)
  NO  → Send directly to POST /chat/send
        → Render response based on mediaAction


Key rule: Only call /documents/wizard/detect when /chat/classify returns responseType: "artifact". For all other responseTypes, skip detect entirely and go straight to chat.

---

## 3. Updated /documents/wizard/detect Response

POST /api/v1/documents/wizard/detect now returns two new fields: needsForm and formReason.

Example response — document that needs a form (resume, CV, cover letter):
{
  "success": true,
  "data": {
    "isDocumentRequest": true,
    "documentType": "resume",
    "format": "pdf",
    "confidence": 0.95,
    "expectedResponseType": "artifact",
    "needsForm": true,
    "formReason": "This document needs your personal details to complete"
  }
}


Example response — document that does NOT need a form (report, presentation, essay):
{
  "success": true,
  "data": {
    "isDocumentRequest": true,
    "documentType": "report",
    "format": "pdf",
    "confidence": 0.95,
    "expectedResponseType": "artifact",
    "needsForm": false,
    "formReason": "Your request has enough detail to generate directly"
  }
}


needsForm field rules:

| needsForm | What to do |
|---|---|
| true | Show the wizard form — user must fill in personal details |
| false | Send message directly to POST /chat/send — backend generates file automatically |

---

## 4. Documents That Need a Form vs Not

needsForm: true — always show the wizard form:
- Resume / CV
- Cover letter
- Biography / Bio
- Personal statement
- Job application
- Wedding speech / Eulogy / Tribute
- Legal letter / Formal complaint
- Business plan

needsForm: false — generate directly, no form needed:
- Report (business report, research report, etc.)
- Essay
- Article / Blog post
- Presentation / PowerPoint
- Spreadsheet / Excel
- Proposal (generic)
- Infographic
- Chart / Graph
- Speech (generic)
- Letter (generic business letter)
- Template
- Summary

---

## 5. Complete Updated Flow with All Cases

User types message and taps Send

       ↓
POST /chat/classify
         ↓
┌─────────────────────────────────────────────┐
│ responseType === "text"                      │
│ → Show "Thinking" animation                  │
│ → POST /chat/send                            │
│ → Render text response                       │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ responseType === "search"                    │
│ → Show "Searching" animation                 │
│ → POST /chat/send                            │
│ → Render text response with sources          │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ responseType === "image"                     │
│ → Show "Generating image" animation          │
│ → POST /chat/send                            │
│ → Render image from mediaAction              │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ responseType === "video"                     │
│ → Show "Generating video" animation          │
│ → POST /chat/send                            │
│ → Render video player from mediaAction       │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ responseType === "image_analysis"            │
│ OR "document_analysis"                       │
│ → Show "Analyzing" animation                 │
│ → POST /chat/send                            │
│ → Render text response                       │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ responseType === "artifact"                  │
│ → POST /documents/wizard/detect              │
│         ↓                                   │
│   needsForm: true                            │
│   → Show wizard form                         │
│   → POST /documents/wizard/start             │
│   → User fills form                          │
│   → POST /documents/wizard/generate          │
│   → Show download link                       │
│         ↓                                   │
│   needsForm: false                           │
│   → Show "Creating document" animation       │
│   → POST /chat/send                          │
│   → Backend generates file automatically     │
│   → Show download link from response         │
└─────────────────────────────────────────────┘


---

## 6. Key Notes

- Always call /chat/classify first before every message send. It is fast (under 1 second) and never fails.
- Only call /detect when responseType is "artifact" — do not call it for text, image, video, or search.
- Use the label and description from /classify to show the user a meaningful loading message while waiting.
- needsForm: false means the backend handles file generation automatically — no form, no extra steps needed. Just send the message to /chat/send and wait for the file URL in the response.
- mediaAction in /chat/send response tells you what was actually generated: image_generate, video_generate, chart_generate, avatar_video_generate etc.