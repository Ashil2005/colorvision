# VisionAI Backend

This is the AI-assisted diagnostic backend for the ColorVision browser extension. It provides an endpoint for the extension to send screening results, uses an LLM to generate a safe, user-friendly explanation, and returns the result safely without exposing API keys in the frontend.

## Setup Instructions

1. **Install Dependencies**
   Make sure you have Node.js installed, then run:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Rename `.env.example` to `.env` and fill in your free AI API key (e.g. from OpenRouter, Hugging Face, or Groq).
   ```bash
   cp .env.example .env
   ```
   Open `.env` and configure:
   - `AI_API_KEY`: Your provider's API key
   - `AI_API_URL`: The completion endpoint (default is OpenRouter)
   - `AI_MODEL`: Note that free models like `meta-llama/llama-3-8b-instruct:free` generally work best for strict zero-shot explanations.

3. **Start the Server**
   ```bash
   npm start
   ```
   The backend will run on `http://localhost:3000`.

## Architecture & Data Flow

1. **Frontend Extension (popup.js / diagnostic.js)**: 
   The rule-based Ishihara engine calculates the score locally (protecting privacy and ensuring it still works offline).
2. **Fetch Request**: 
   A JSON representation of the result (likely type, confidence, severity) is posted to `http://localhost:3000/analyze-result`.
3. **Backend Validation**:
   The `/analyze-result` endpoint validates that the required fields are present.
4. **AI Generation (ai.js)**:
   The backend sends a localized, structured system prompt to the language model guaranteeing that it treats the data as a "screening tool" and not a medical diagnosis. 
5. **Output Safety**:
   The AI text is intercepted by `isOutputSafe()`. It strips any hallucinatory phrases like "confirmed diagnosis" or "100% accurate".
6. **Fallback Mechanism**:
   If the LLM is down, rate-limited, or outputs an unsafe string, the exact same endpoint silently switches to `generateFallbackExplanation()`, which returns a professionally written template output.
7. **Frontend Display**:
   The extension displays the explanation text in its new AI Result Card.

This ensures:
- The API key is securely stored in Node.js.
- Strict formatting prevents the AI from being overly confident or legally liable.
- The UI never breaks if the AI goes down.
