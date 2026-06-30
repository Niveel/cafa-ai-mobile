# Cafa AI — Document Wizard Frontend Integration Guide

**Version:** 2.0  
**Date:** June 2026  
**Backend:** `https://cafaapi.niveel.com`  
**Platforms:** Next.js (Web) + React Native Expo (Mobile)

---

## What Changed in Version 2.0

- **New `/detect` endpoint** — AI-powered detection replaces keyword matching. Use this instead of `isDocumentRequest()`, and use its response type hint to drive text, image, video, or artifact loading animations.
- **New `/history` endpoint** — Retrieve user's previously generated documents.
- **Sandbox error handling** — `/generate` now returns a proper HTTP 500 on failure instead of empty artifacts.
- **Artifact response shape updated** — `fileName` (not `filename`), `size_bytes` (not `size`).
- **Form caching** — `/start` caches HTML for 10 minutes for the same document type. Fast repeated calls.

---

## Overview — The Complete Flow

```
User types message in chat
         ↓
Frontend calls /wizard/detect (Groq AI — ~0.3 seconds)
         ↓
{ isDocumentRequest: true, documentType: "resume", format: "pdf", confidence: 0.95, expectedResponseType: "artifact" }
         ↓
If isDocumentRequest === true AND confidence >= 0.7:
  Call /wizard/start → get HTML form string
         ↓
  Render HTML in iframe (web) or WebView (mobile)
         ↓
  User fills form and clicks Generate
         ↓
  HTML sends form data via postMessage
         ↓
  Frontend catches postMessage → calls /wizard/generate
         ↓
  Backend returns generated file URL
         ↓
  Show download button to user
Else:
  Send to normal chat endpoint
```

---

## API Reference

### 1. Detect Document Request

**Endpoint:** `POST /api/v1/documents/wizard/detect`

**Purpose:** Use this on EVERY user message before deciding whether to show the wizard or send to normal chat. AI-powered — works for any document type in any language. Never hardcode document keywords.
It also tells the frontend what kind of response is expected so chat can show the correct loading animation without regex guessing.

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <user_access_token>
```

**Request Body:**
```json
{ "message": "I need a court affidavit for property ownership" }
```

**Success Response (200) — always returns 200, never 500:**
```json
{
  "success": true,
  "data": {
    "isDocumentRequest": true,
    "documentType": "court affidavit",
    "format": "pdf",
    "confidence": 0.9,
    "expectedResponseType": "artifact"
  }
}
```

**Fallback response (when AI fails or times out):**
```json
{
  "success": true,
  "data": {
    "isDocumentRequest": false,
    "documentType": null,
    "format": null,
    "confidence": 0,
    "expectedResponseType": "text"
  }
}
```

**`expectedResponseType` values:**
- `text` — normal assistant text reply
- `image` — image generation loading animation
- `video` — video generation loading animation
- `artifact` — file/document/artifact generation loading animation

**Important:** This endpoint NEVER returns an error. If Groq times out or fails, it returns `isDocumentRequest: false` safely — the message falls through to normal chat. Always handle the response, never catch errors from this endpoint.

**Confidence threshold:** Only show wizard if `confidence >= 0.7`. Below that, let normal chat handle it.

**Real examples tested:**
```
"create a resume for me"         → { isDocumentRequest: true,  documentType: "resume",          format: "pdf",  confidence: 0.95 }
"I need a CV urgently"           → { isDocumentRequest: true,  documentType: "cv",              format: "pdf",  confidence: 0.9  }
"help me apply for a job"        → { isDocumentRequest: true,  documentType: "cover letter",    format: "pdf",  confidence: 0.85 }
"court affidavit for property"   → { isDocumentRequest: true,  documentType: "court affidavit", format: "pdf",  confidence: 0.9  }
"climate change presentation"    → { isDocumentRequest: true,  documentType: "presentation",    format: "pptx", confidence: 0.95 }
"what is a resume?"              → { isDocumentRequest: false, documentType: null,              format: null,   confidence: 0.1  }
"generate an image of a cat"     → { isDocumentRequest: false, documentType: null,              format: null,   confidence: 0    }
"hello"                          → { isDocumentRequest: false, documentType: null,              format: null,   confidence: 0    }
```

---

### 2. Start Wizard — Generate HTML Form

**Endpoint:** `POST /api/v1/documents/wizard/start`

**Purpose:** Given any document type, returns a complete, styled, mobile-friendly HTML form that collects exactly the right information for that document. The AI figures out what questions to ask — no hardcoding needed.

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <user_access_token>
```

**Request Body:**
```json
{ "userRequest": "create a resume for me" }
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "html": "<!DOCTYPE html><html>...</html>"
  }
}
```

**Error Response (400):**
```json
{ "success": false, "message": "userRequest is required" }
```

**Notes:**
- Response time: 2-4 seconds on first call, near-instant on repeated calls (10-minute cache)
- The HTML is completely self-contained — no external CSS or JS
- The HTML handles both web iframe and React Native WebView automatically
- Pass the `userRequest` exactly as the user typed it — the AI adapts to any document type
- Use `documentType` from `/detect` as the `userRequest` for best results

---

### 3. Generate Document — From Filled Form Data

**Endpoint:** `POST /api/v1/documents/wizard/generate`

**Purpose:** Takes the form data submitted by the user and generates a professional document file.

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <user_access_token>
```

**Request Body:**
```json
{
  "formData": {
    "fullName": "Eritten Kwame Gyau",
    "targetRole": "Software Engineer",
    "experienceLevel": "Senior",
    "workExperience": "Niveel LLC — Founder and Senior Software Engineer...",
    "skills": "Python, Node.js, TypeScript, Docker"
  },
  "documentType": "resume",
  "format": "pdf"
}
```

**Fields:**
| Field | Type | Required | Description |
|---|---|---|---|
| `formData` | object | Yes | Key-value pairs from the filled HTML form |
| `documentType` | string | Yes | Use the value from `/detect` response |
| `format` | string | Yes | One of: `"pdf"`, `"docx"`, `"pptx"`, `"xlsx"` |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "artifacts": [
      {
        "type": "pdf",
        "title": "eritten_kwame_gyau_resume",
        "mimeType": "application/pdf",
        "url": "https://res.cloudinary.com/dziemsbyg/raw/upload/v.../resume.pdf",
        "fileName": "eritten_kwame_gyau_resume.pdf",
        "size_bytes": 45231
      }
    ]
  }
}
```

**Error Responses:**
```json
{ "success": false, "message": "formData, documentType, and format are required" }
{ "success": false, "message": "Invalid format. Must be one of: pdf, docx, pptx, xlsx" }
{ "success": false, "error": "GENERATION_FAILED", "message": "Document generation failed. Please try again." }
```

**Important:** Response time is 15-30 seconds. Always show a loading state. The last error (`GENERATION_FAILED`) is HTTP 500 — handle it specifically and show a retry button.

---

### 4. Get Document History

**Endpoint:** `GET /api/v1/documents/wizard/history`

**Purpose:** Returns the user's previously generated documents. Documents from both the wizard and the chat pipeline are included.

**Headers:**
```
Authorization: Bearer <user_access_token>
```

**Query Parameters:**
| Param | Default | Max | Description |
|---|---|---|---|
| `limit` | 20 | 50 | Number of documents per page |
| `page` | 1 | — | Page number |

**Example:** `GET /api/v1/documents/wizard/history?limit=10&page=1`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "_id": "...",
        "documentType": "resume",
        "format": "pdf",
        "title": "eritten_kwame_gyau_resume",
        "source": "wizard",
        "artifacts": [
          {
            "url": "https://res.cloudinary.com/...",
            "fileName": "resume.pdf",
            "mimeType": "application/pdf",
            "size_bytes": 45231
          }
        ],
        "createdAt": "2026-06-08T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 10,
      "totalPages": 1,
      "hasNextPage": false
    }
  }
}
```

**Notes:**
- Documents expire after 90 days (TTL index)
- `source` is either `"wizard"` (created via wizard) or `"chat"` (created via chat pipeline)
- Use this to build a "My Documents" screen

---

## Shared Service — Use This on Both Web and Mobile

Create `services/documentWizard.ts` once and import it on both platforms:

```typescript
// services/documentWizard.ts

const BASE_URL = 'https://cafaapi.niveel.com/api/v1';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ExpectedResponseType = 'text' | 'image' | 'video' | 'artifact';

export interface DetectResult {
  isDocumentRequest: boolean;
  documentType: string | null;
  format: 'pdf' | 'docx' | 'pptx' | 'xlsx' | null;
  confidence: number;
  expectedResponseType: ExpectedResponseType;
}

export interface DocumentArtifact {
  type: string;
  title: string;
  mimeType: string;
  url: string;
  fileName: string;
  size_bytes: number;
}

export interface DocumentHistoryItem {
  _id: string;
  documentType: string;
  format: string;
  title: string;
  source: 'wizard' | 'chat';
  artifacts: DocumentArtifact[];
  createdAt: string;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

/**
 * Detect if a user message is a document creation request.
 * ALWAYS returns a result — never throws. Safe to call on every message.
 */
export async function detectDocumentRequest(
  message: string,
  accessToken: string
): Promise<DetectResult> {
  try {
    const response = await fetch(`${BASE_URL}/documents/wizard/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ message })
    });

    const data = await response.json();
    return data.data ?? { isDocumentRequest: false, documentType: null, format: null, confidence: 0, expectedResponseType: 'text' };
  } catch {
    // Network error — fall back to normal chat
    return { isDocumentRequest: false, documentType: null, format: null, confidence: 0, expectedResponseType: 'text' };
  }
}

/**
 * Generate the HTML wizard form for any document type.
 * Takes 2-4 seconds on first call, near-instant on cached calls.
 */
export async function startWizard(
  userRequest: string,
  accessToken: string
): Promise<string> {
  const response = await fetch(`${BASE_URL}/documents/wizard/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ userRequest })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to start wizard');
  }

  return data.data.html;
}

/**
 * Generate a document from filled form data.
 * Takes 15-30 seconds. Always show a loading state.
 */
export async function generateFromForm(
  formData: Record<string, string>,
  documentType: string,
  format: string,
  accessToken: string
): Promise<DocumentArtifact[]> {
  const response = await fetch(`${BASE_URL}/documents/wizard/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ formData, documentType, format })
  });

  const data = await response.json();

  if (!data.success) {
    // Check for specific generation failure
    if (data.error === 'GENERATION_FAILED') {
      throw new Error('Document generation failed. Please try again.');
    }
    throw new Error(data.message || 'Failed to generate document');
  }

  return data.data.artifacts;
}

/**
 * Get the user's document history.
 */
export async function getDocumentHistory(
  accessToken: string,
  page = 1,
  limit = 20
): Promise<{ documents: DocumentHistoryItem[]; pagination: any }> {
  const response = await fetch(
    `${BASE_URL}/documents/wizard/history?page=${page}&limit=${limit}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch history');
  }

  return data.data;
}
```

---

## Web Integration (Next.js)

### DocumentWizard Component

```tsx
// components/DocumentWizard.tsx
'use client';

import { useEffect, useState } from 'react';
import { generateFromForm, DocumentArtifact } from '@/services/documentWizard';

interface DocumentWizardProps {
  html: string;
  documentType: string;
  format: string;
  accessToken: string;
  onComplete: (artifacts: DocumentArtifact[]) => void;
  onClose: () => void;
}

export default function DocumentWizard({
  html,
  documentType,
  format,
  accessToken,
  onComplete,
  onClose
}: DocumentWizardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;

      let formData: Record<string, string>;
      try {
        formData = JSON.parse(event.data);
      } catch {
        return;
      }

      if (typeof formData !== 'object' || Array.isArray(formData)) return;

      setLoading(true);
      setError(null);

      try {
        const artifacts = await generateFromForm(formData, documentType, format, accessToken);
        onComplete(artifacts);
      } catch (err: any) {
        setError(err.message || 'Failed to generate document. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [documentType, format, accessToken, onComplete, retryCount]);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '12px',
        width: '90%', maxWidth: '640px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        position: 'relative'
      }}>

        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontWeight: 600, color: '#1e293b' }}>Document Builder</span>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b' }}>
            ✕
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div style={{
            padding: '12px 20px', backgroundColor: '#fef2f2',
            color: '#dc2626', borderBottom: '1px solid #fecaca',
            fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span>{error}</span>
            <button
              onClick={() => { setError(null); setRetryCount(c => c + 1); }}
              style={{
                background: '#dc2626', color: 'white', border: 'none',
                borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '13px'
              }}>
              Retry
            </button>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundColor: 'rgba(255,255,255,0.92)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 10, borderRadius: '12px', gap: '12px'
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              border: '3px solid #e2e8f0', borderTopColor: '#6366f1',
              animation: 'spin 0.8s linear infinite'
            }} />
            <div style={{ color: '#6366f1', fontWeight: 500 }}>✨ Generating your document...</div>
            <div style={{ color: '#94a3b8', fontSize: '13px' }}>This takes 15-30 seconds</div>
          </div>
        )}

        {/* The Form */}
        <iframe
          srcDoc={html}
          sandbox="allow-scripts"
          style={{ border: 'none', width: '100%', flex: 1, minHeight: '400px' }}
          title="Document Wizard Form"
        />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
```

### Using in Chat (Next.js)

```tsx
// In your chat component

import DocumentWizard from '@/components/DocumentWizard';
import { detectDocumentRequest, startWizard, DocumentArtifact } from '@/services/documentWizard';

// State
const [wizardHtml, setWizardHtml] = useState<string | null>(null);
const [wizardDocType, setWizardDocType] = useState('');
const [wizardFormat, setWizardFormat] = useState<string>('pdf');
const [showWizard, setShowWizard] = useState(false);
const [detectingDoc, setDetectingDoc] = useState(false);

const handleSendMessage = async (message: string) => {
  setDetectingDoc(true);

  // Step 1: AI detects if this is a document request
  const detection = await detectDocumentRequest(message, accessToken);
  setDetectingDoc(false);

  if (detection.isDocumentRequest && detection.confidence >= 0.7) {
    // Step 2: Get the HTML form
    try {
      const html = await startWizard(
        detection.documentType ?? message,
        accessToken
      );
      setWizardHtml(html);
      setWizardDocType(detection.documentType ?? 'document');
      setWizardFormat(detection.format ?? 'pdf');
      setShowWizard(true);
    } catch (err) {
      // If wizard fails, fall back to normal chat
      sendChatMessage(message);
    }
  } else {
    // Normal chat
    sendChatMessage(message);
  }
};

const handleWizardComplete = (artifacts: DocumentArtifact[]) => {
  setShowWizard(false);
  setWizardHtml(null);

  // Add file to chat as assistant message
  addMessageToChat({
    role: 'assistant',
    content: 'Your document is ready!',
    attachments: artifacts
  });
};

// In JSX:
{showWizard && wizardHtml && (
  <DocumentWizard
    html={wizardHtml}
    documentType={wizardDocType}
    format={wizardFormat}
    accessToken={accessToken}
    onComplete={handleWizardComplete}
    onClose={() => setShowWizard(false)}
  />
)}
```

---

## Mobile Integration (React Native Expo)

### Install WebView

```bash
npx expo install react-native-webview
```

### DocumentWizard Component (Mobile)

```tsx
// components/DocumentWizard.tsx

import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView
} from 'react-native';
import { WebView } from 'react-native-webview';
import { generateFromForm, DocumentArtifact } from '../services/documentWizard';

interface DocumentWizardProps {
  visible: boolean;
  html: string;
  documentType: string;
  format: string;
  accessToken: string;
  onComplete: (artifacts: DocumentArtifact[]) => void;
  onClose: () => void;
}

export default function DocumentWizard({
  visible, html, documentType, format,
  accessToken, onComplete, onClose
}: DocumentWizardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMessage = async (event: any) => {
    let formData: Record<string, string>;
    try {
      formData = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    if (typeof formData !== 'object' || Array.isArray(formData)) return;

    setLoading(true);
    setError(null);

    try {
      const artifacts = await generateFromForm(formData, documentType, format, accessToken);
      onComplete(artifacts);
    } catch (err: any) {
      setError(err.message || 'Document generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Document Builder</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Error Banner */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading Overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>✨ Generating your document...</Text>
            <Text style={styles.loadingSubText}>This takes 15-30 seconds</Text>
          </View>
        )}

        {/* HTML Form */}
        <WebView
          source={{ html }}
          onMessage={handleMessage}
          style={styles.webview}
          scrollEnabled={true}
          javaScriptEnabled={true}
          originWhitelist={['*']}
          showsVerticalScrollIndicator={false}
        />

      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0'
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1e293b' },
  closeButton: { padding: 4 },
  closeText: { fontSize: 18, color: '#64748b' },
  errorBanner: {
    backgroundColor: '#fef2f2', padding: 12,
    borderBottomWidth: 1, borderBottomColor: '#fecaca',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
  },
  errorText: { color: '#dc2626', fontSize: 14, flex: 1 },
  retryButton: {
    backgroundColor: '#dc2626', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 4, marginLeft: 8
  },
  retryText: { color: 'white', fontSize: 13 },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center', zIndex: 10, gap: 8
  },
  loadingText: { color: '#6366f1', fontSize: 16, fontWeight: '500', marginTop: 12 },
  loadingSubText: { color: '#94a3b8', fontSize: 13 },
  webview: { flex: 1, backgroundColor: '#f8fafc' }
});
```

### Using in Mobile Chat Screen

```tsx
// screens/ChatScreen.tsx

import * as Linking from 'expo-linking';
import DocumentWizard from '../components/DocumentWizard';
import { detectDocumentRequest, startWizard, DocumentArtifact } from '../services/documentWizard';

// State
const [wizardVisible, setWizardVisible] = useState(false);
const [wizardHtml, setWizardHtml] = useState('');
const [wizardDocType, setWizardDocType] = useState('');
const [wizardFormat, setWizardFormat] = useState('pdf');

const handleSendMessage = async (message: string) => {
  // Step 1: AI detects if this is a document request
  const detection = await detectDocumentRequest(message, accessToken);

  if (detection.isDocumentRequest && detection.confidence >= 0.7) {
    try {
      const html = await startWizard(detection.documentType ?? message, accessToken);
      setWizardHtml(html);
      setWizardDocType(detection.documentType ?? 'document');
      setWizardFormat(detection.format ?? 'pdf');
      setWizardVisible(true);
    } catch {
      sendMessage(message); // fallback to chat
    }
  } else {
    sendMessage(message);
  }
};

const handleWizardComplete = (artifacts: DocumentArtifact[]) => {
  setWizardVisible(false);

  // Open file directly
  if (artifacts.length > 0) {
    Linking.openURL(artifacts[0].url);
  }

  // Also add to chat
  addMessage({
    role: 'assistant',
    content: 'Your document is ready! Tap to open.',
    attachments: artifacts
  });
};

// In JSX:
<DocumentWizard
  visible={wizardVisible}
  html={wizardHtml}
  documentType={wizardDocType}
  format={wizardFormat}
  accessToken={accessToken}
  onComplete={handleWizardComplete}
  onClose={() => setWizardVisible(false)}
/>
```

---

## Handling the Generated File

The artifact response shape from `/generate`:

```json
{
  "type": "pdf",
  "title": "eritten_kwame_gyau_resume",
  "mimeType": "application/pdf",
  "url": "https://res.cloudinary.com/dziemsbyg/raw/upload/v.../resume.pdf",
  "fileName": "eritten_kwame_gyau_resume.pdf",
  "size_bytes": 45231
}
```

**Note:** Field names are `fileName` (not `filename`) and `size_bytes` (not `size`).

**Web — Download:**
```typescript
const handleWizardComplete = (artifacts: DocumentArtifact[]) => {
  if (artifacts.length > 0) {
    const file = artifacts[0];
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.fileName; // use fileName not filename
    a.click();
  }
};
```

**Mobile — Open:**
```typescript
import * as Linking from 'expo-linking';

const handleWizardComplete = (artifacts: DocumentArtifact[]) => {
  if (artifacts.length > 0) {
    Linking.openURL(artifacts[0].url);
  }
};
```

---

## Document History Screen (Optional)

Use the `/history` endpoint to build a "My Documents" screen:

```tsx
import { getDocumentHistory, DocumentHistoryItem } from '../services/documentWizard';

const [documents, setDocuments] = useState<DocumentHistoryItem[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  getDocumentHistory(accessToken, 1, 20)
    .then(({ documents }) => setDocuments(documents))
    .catch(console.error)
    .finally(() => setLoading(false));
}, []);

// Render each document with a download button
documents.map(doc => (
  <View key={doc._id}>
    <Text>{doc.documentType} — {doc.format.toUpperCase()}</Text>
    <Text>{new Date(doc.createdAt).toLocaleDateString()}</Text>
    <TouchableOpacity onPress={() => Linking.openURL(doc.artifacts[0].url)}>
      <Text>Download</Text>
    </TouchableOpacity>
  </View>
))
```

---

## All Endpoints — Quick Reference

| Method | Endpoint | Purpose | Response Time |
|---|---|---|---|
| POST | `/documents/wizard/detect` | AI intent detection | ~0.3s |
| POST | `/documents/wizard/start` | Generate HTML form | 2-4s (cached: instant) |
| POST | `/documents/wizard/generate` | Create document file | 15-30s |
| GET | `/documents/wizard/history` | User's past documents | ~0.2s |

All endpoints require `Authorization: Bearer <token>` header.

---

## Important Notes

1. **Always call `/detect` first** — never use keyword matching. The AI handles any document type in any language.

2. **Confidence threshold** — Only show wizard if `confidence >= 0.7`. Lower confidence = let normal chat handle it.

3. **Token expiry** — Tokens expire after ~15 minutes. Refresh before each request. On 401, refresh token and retry once.

4. **Loading states are critical:**
   - `/detect` — show subtle spinner (0.3s)
   - `/start` — show "Preparing your form..." (2-4s)
   - `/generate` — show prominent "Generating document... (15-30 seconds)"

5. **Retry on GENERATION_FAILED** — When `/generate` returns `error: "GENERATION_FAILED"`, show a retry button. Do NOT retry automatically.

6. **Do not modify the HTML** — The form HTML from `/start` is complete. Render it as-is.

7. **iOS WebView** — `javaScriptEnabled={true}` is required on the WebView component.

8. **postMessage bridge** — The HTML handles both platforms automatically. Do not add custom postMessage listeners outside the component.

9. **detectDocumentRequest never throws** — Wrap in try/catch only as a safety net. The endpoint always returns a safe fallback.

10. **Document types are open-ended** — Pass `detection.documentType` from `/detect` directly to `/start` and `/generate`. Never hardcode document type strings.

---

## Questions?

Contact: Eritten Kwame Gyau (backend)  
API Base URL: `https://cafaapi.niveel.com/api/v1`  
All 4 endpoints tested and live on production.
