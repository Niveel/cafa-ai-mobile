# Cafa AI — Prompt Suggest Integration Guide

**Endpoint:** `POST /api/v1/prompts/suggest`  
**Auth:** Bearer token required  
**Response time:** Under 800ms

---

## What It Does

While the user is typing, call this endpoint to get 3 professional AI-improved versions of what they are typing. Show them as suggestions the user can tap to use.

---

## Request

```typescript
POST /api/v1/prompts/suggest
Authorization: Bearer <token>
Content-Type: application/json

{
  "partialText": "a lion in the",  // what the user has typed so far
  "context": "image"               // optional — which screen they are on
}
```

**Context values:**

| Value | When to send |
|---|---|
| `"image"` | User is on the Images / image generation screen |
| `"video"` | User is on the Videos / video generation screen |
| `"edit-image"` | User is on the Edit Image screen |
| `"chat"` | General chat screen — also the default if you omit context |

---

## Response

Always HTTP 200. Never errors.

```json
{
  "success": true,
  "data": {
    "suggestions": [
      "A majestic lion in the golden savanna at sunset, dramatic orange sky, photorealistic, National Geographic style",
      "A lion in the jungle at dawn, oil painting style, rich earthy colors, impressionist brushwork",
      "A white lion cub in tall grass, soft morning light, wildlife photography, shallow depth of field"
    ]
  }
}
```

If suggestions is an empty array `[]` — hide the dropdown silently. No error to show.

---

## How to Implement

### Step 1 — Debounce the input

**Never call on every keystroke.** Wait 500ms after the user stops typing.

```typescript
// React example
const [suggestions, setSuggestions] = useState<string[]>([]);
const abortRef = useRef<AbortController | null>(null);

const handleInputChange = (text: string) => {
  setValue(text);

  // Clear previous timeout
  clearTimeout(debounceRef.current);

  // Hide suggestions if too short
  if (text.trim().length < 3) {
    setSuggestions([]);
    return;
  }

  // Debounce 500ms
  debounceRef.current = setTimeout(() => {
    fetchSuggestions(text);
  }, 500);
};
```

### Step 2 — Fetch with AbortController

Cancel the previous request if the user types again before it returns.

```typescript
const fetchSuggestions = async (text: string) => {
  // Cancel previous request
  if (abortRef.current) abortRef.current.abort();
  abortRef.current = new AbortController();

  try {
    const response = await fetch('https://cafaapi.niveel.com/api/v1/prompts/suggest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        partialText: text,
        context: 'image' // change based on current screen
      }),
      signal: abortRef.current.signal
    });

    const data = await response.json();
    setSuggestions(data.data.suggestions ?? []);
  } catch (err: any) {
    if (err.name === 'AbortError') return; // user typed again — ignore
    setSuggestions([]);
  }
};
```

### Step 3 — Show suggestions

Display as a dropdown or chips below the input. When user taps one, replace the input text with it and hide the dropdown.

```typescript
// When user taps a suggestion
const handleSuggestionTap = (suggestion: string) => {
  setValue(suggestion);       // replace input with full suggestion
  setSuggestions([]);         // hide dropdown
};

// Hide on submit or clear
const handleSubmit = () => {
  setSuggestions([]);
  // ... send message
};
```

### Step 4 — React Native (Mobile)

Same logic. Use `TextInput` `onChangeText` with the same debounce pattern.

```tsx
<TextInput
  value={value}
  onChangeText={handleInputChange}
  placeholder="Type your message..."
/>

{suggestions.length > 0 && (
  <View style={styles.suggestionsContainer}>
    {suggestions.map((s, i) => (
      <TouchableOpacity key={i} onPress={() => handleSuggestionTap(s)}>
        <Text style={styles.suggestionText}>{s}</Text>
      </TouchableOpacity>
    ))}
  </View>
)}
```

---

## Important Rules

1. **Debounce 500ms** — never call on every keystroke
2. **Minimum 3 characters** — don't call for very short text
3. **Always use AbortController** — cancel stale requests
4. **Empty array = hide silently** — no error message needed
5. **Tapping a suggestion replaces the full input** — not appends
6. **Hide on submit or clear** — don't show stale suggestions

---

## Quick Test

```bash
curl -s -X POST https://cafaapi.niveel.com/api/v1/prompts/suggest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"partialText": "a lion in the forest", "context": "image"}' \
  | python3 -m json.tool
```

---

**API Base:** `https://cafaapi.niveel.com/api/v1`  
**Contact:** Eritten Kwame Gyau (backend)
