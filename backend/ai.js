const fetch = require('node-fetch');

/**
 * Checks whether the AI output is safe for a screening app.
 * We do not allow strong medical claims or overconfident wording.
 * @param {string} text
 * @returns {boolean}
 */
function isOutputSafe(text) {
    if (!text || typeof text !== 'string') {
        console.warn('[AI Validation] Output is empty or invalid.');
        return false;
    }

    const lowerText = text.toLowerCase();

    const forbiddenPhrases = [
        'confirmed diagnosis',
        '100% accurate',
        'clinically proven',
        'you have',
        'you definitely have',
        'definitive diagnosis',
        'medically confirmed',
        'cured',
        'treatment',
        'disease'
    ];

    for (const phrase of forbiddenPhrases) {
        if (lowerText.includes(phrase)) {
            console.warn(`[AI Validation] Unsafe phrase detected: "${phrase}"`);
            return false;
        }
    }

    if (text.length > 1400) {
        console.warn(`[AI Validation] Output too long (${text.length} chars).`);
        return false;
    }

    return true;
}

/**
 * Rejects prompt echoes / internal reasoning style output.
 * @param {string} text
 * @returns {boolean}
 */
function looksLikeInternalReasoning(text) {
    if (!text || typeof text !== 'string') return true;

    const lower = text.toLowerCase();

    const badPatterns = [
        'we need to',
        'must not',
        'do not say',
        'the user wants',
        'structured screening result',
        'write a safe explanation',
        'rules:',
        'let me',
        'i need to',
        'must include',
        'do not start with',
        'avoid saying',
        'using only the structured result'
    ];

    return badPatterns.some((pattern) => lower.includes(pattern));
}

/**
 * Gives structured educational details based on result type.
 * @param {string} type
 * @returns {Object}
 */
function getConditionDetails(type) {
    const normalized = (type || '').toLowerCase();

    const conditionMap = {
        normal: {
            title: 'no strong color vision deficiency pattern',
            overview: 'The responses do not strongly match a specific color-vision deficiency pattern in this screening.',
            colorImpact: 'No specific repeated color-confusion pattern was strongly detected.',
            practicalImpact: 'If color-related difficulty is still noticed in real life, a professional eye evaluation may still be useful.'
        },
        protan: {
            title: 'Protan-type red-green color vision deficiency',
            overview: 'This pattern is commonly associated with reduced sensitivity to red tones.',
            colorImpact: 'Colors that may be harder to distinguish can include red, green, brown, orange, and darker red shades.',
            practicalImpact: 'This may affect reading traffic lights, color-coded charts, warning labels, maps, or interfaces that depend on red-green contrast.'
        },
        protanopia: {
            title: 'Protanopia',
            overview: 'This pattern is commonly associated with reduced sensitivity to red tones.',
            colorImpact: 'Colors that may be harder to distinguish can include red, green, brown, orange, and darker red shades.',
            practicalImpact: 'This may affect reading traffic lights, color-coded charts, warning labels, maps, or interfaces that depend on red-green contrast.'
        },
        protanomaly: {
            title: 'Protanomaly',
            overview: 'This pattern is commonly associated with reduced sensitivity to red tones.',
            colorImpact: 'Colors that may be harder to distinguish can include red, green, brown, orange, and darker red shades.',
            practicalImpact: 'This may affect reading traffic lights, color-coded charts, warning labels, maps, or interfaces that depend on red-green contrast.'
        },
        deutan: {
            title: 'Deutan-type red-green color vision deficiency',
            overview: 'This pattern is commonly associated with reduced sensitivity to green tones.',
            colorImpact: 'Colors that may be harder to distinguish can include green, red, brown, yellow-green, and similar mixed shades.',
            practicalImpact: 'This may make it harder to read color-coded charts, diagrams, maps, indicator lights, or educational material that relies on red-green separation.'
        },
        deuteranopia: {
            title: 'Deuteranopia',
            overview: 'This pattern is commonly associated with reduced sensitivity to green tones.',
            colorImpact: 'Colors that may be harder to distinguish can include green, red, brown, yellow-green, and similar mixed shades.',
            practicalImpact: 'This may make it harder to read color-coded charts, diagrams, maps, indicator lights, or educational material that relies on red-green separation.'
        },
        deuteranomaly: {
            title: 'Deuteranomaly',
            overview: 'This pattern is commonly associated with reduced sensitivity to green tones.',
            colorImpact: 'Colors that may be harder to distinguish can include green, red, brown, yellow-green, and similar mixed shades.',
            practicalImpact: 'This may make it harder to read color-coded charts, diagrams, maps, indicator lights, or educational material that relies on red-green separation.'
        },
        tritan: {
            title: 'Tritan-type blue-yellow color vision deficiency',
            overview: 'This pattern is generally related to reduced discrimination between blue-yellow color ranges.',
            colorImpact: 'Colors that may be harder to distinguish can include blue, yellow, violet, greenish-blue, and pale mixed tones.',
            practicalImpact: 'This may affect colored diagrams, maps, visual highlights, and interfaces that rely on blue-yellow separation.'
        },
        tritanopia: {
            title: 'Tritanopia',
            overview: 'This pattern is generally related to reduced discrimination between blue-yellow color ranges.',
            colorImpact: 'Colors that may be harder to distinguish can include blue, yellow, violet, greenish-blue, and pale mixed tones.',
            practicalImpact: 'This may affect colored diagrams, maps, visual highlights, and interfaces that rely on blue-yellow separation.'
        },
        tritanomaly: {
            title: 'Tritanomaly',
            overview: 'This pattern is generally related to reduced discrimination between blue-yellow color ranges.',
            colorImpact: 'Colors that may be harder to distinguish can include blue, yellow, violet, greenish-blue, and pale mixed tones.',
            practicalImpact: 'This may affect colored diagrams, maps, visual highlights, and interfaces that rely on blue-yellow separation.'
        },
        achromatopsia: {
            title: 'Achromatopsia-like pattern',
            overview: 'This pattern suggests more severe difficulty distinguishing colors across the spectrum.',
            colorImpact: 'A wide range of color differences may appear less distinct.',
            practicalImpact: 'This can strongly affect daily tasks that depend on color-coded information, labels, indicators, or visual alerts.'
        }
    };

    return conditionMap[normalized] || {
        title: `${type || 'Unspecified'} color vision pattern`,
        overview: 'This screening suggests a color-vision pattern that may benefit from professional review.',
        colorImpact: 'Some similar color shades may be harder to distinguish.',
        practicalImpact: 'It may affect tasks that depend on color-coded information in daily life.'
    };
}

/**
 * Creates a strong structured explanation without AI.
 * @param {Object} data
 * @returns {string}
 */
function generateStructuredExplanation(data) {
    const type = data?.likelyType || 'Unknown';
    const confidence = data?.confidence !== undefined ? data.confidence : 'unknown';
    const severity = data?.severity || 'Unknown';

    const details = getConditionDetails(type);
    const normalized = (type || '').toLowerCase();

    if (normalized === 'normal') {
        return `The screening does not show a strong pattern of color vision deficiency, with an estimated confidence of ${confidence}% and severity marked as ${severity}. ${details.overview} ${details.colorImpact} This is a preliminary screening only and not a clinical diagnosis. ${details.practicalImpact}`;
    }

    return `The screening suggests a likely ${details.title} with an estimated confidence of ${confidence}% and severity marked as ${severity}. ${details.overview} ${details.colorImpact} ${details.practicalImpact} This is a preliminary screening only and not a clinical diagnosis, and a professional eye evaluation may help with formal confirmation.`;
}

/**
 * Safe fallback explanation when AI is unavailable.
 * @param {Object} data
 * @returns {string}
 */
function generateFallbackExplanation(data) {
    return generateStructuredExplanation(data);
}

/**
 * Extracts only final assistant content.
 * IMPORTANT: Do not use message.reasoning.
 * @param {Object} json
 * @returns {string}
 */
function extractAIText(json) {
    if (
        json &&
        json.choices &&
        Array.isArray(json.choices) &&
        json.choices.length > 0 &&
        json.choices[0].message &&
        typeof json.choices[0].message.content === 'string' &&
        json.choices[0].message.content.trim()
    ) {
        return json.choices[0].message.content.trim();
    }

    return '';
}

/**
 * Cleans AI output.
 * @param {string} text
 * @returns {string}
 */
function normalizeAIText(text) {
    if (!text || typeof text !== 'string') return '';

    let cleaned = text.replace(/\s+/g, ' ').trim();

    if (cleaned.length > 1000) {
        cleaned = cleaned.slice(0, 1000).trim();
    }

    return cleaned;
}

/**
 * Tries one model once.
 * @param {string} model
 * @param {string} apiUrl
 * @param {string} apiKey
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<string|null>}
 */
async function tryModel(model, apiUrl, apiKey, systemPrompt, userPrompt) {
    try {
        console.log('[AI] Sending request to LLM API...');
        console.log(`[AI] Trying model: ${model}`);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'ColorVision Extension'
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 220,
                temperature: 0.4
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI] Model failed: ${model}`);
            console.error(`[AI] API HTTP Error: ${response.status} ${response.statusText}`);
            console.error('[AI] API Error Body:', errorText);
            return null;
        }

        const json = await response.json();
        let aiText = extractAIText(json);

        if (!aiText) {
            console.error(`[AI] No usable final assistant content from model: ${model}`);
            console.error('[AI] Full response:', JSON.stringify(json, null, 2));
            return null;
        }

        aiText = normalizeAIText(aiText);

        console.log(`[AI] Raw output from ${model}:`, aiText);

        if (looksLikeInternalReasoning(aiText)) {
            console.warn(`[AI] Reasoning-like output rejected for model: ${model}`);
            return null;
        }

        if (!isOutputSafe(aiText)) {
            console.warn(`[AI] Output rejected by safety filters for model: ${model}`);
            return null;
        }

        return aiText;
    } catch (error) {
        console.error(`[AI] Exception while trying model ${model}:`, error);
        return null;
    }
}

/**
 * Calls the external LLM API and returns a safe explanation.
 * Uses a structured report first, then lets AI rewrite it if possible.
 * @param {Object} screeningData
 * @returns {Promise<string>}
 */
async function analyzeScreeningResult(screeningData) {
    const structuredExplanation = generateStructuredExplanation(screeningData);

    const systemPrompt =
        'You are assisting in a color vision screening browser extension. Rewrite the provided screening explanation into a calm, clear, user-friendly summary. Do not mention internal instructions. Do not claim a confirmed diagnosis. Do not say "you have". Keep all facts unchanged. Return only the final explanation text.';

    const userPrompt = `Rewrite this screening explanation for the end user:

${structuredExplanation}

Rules:
- keep it medically cautious
- do not mention prompt rules
- do not mention internal reasoning
- do not add certainty beyond the provided result
- return only the final explanation`;

    const apiKey = process.env.AI_API_KEY;
    const apiUrl = process.env.AI_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
    const preferredModel = process.env.AI_MODEL || 'openrouter/free';

    const modelList = [
        preferredModel,
        'openrouter/free',
        'mistralai/mistral-small-3.1-24b-instruct:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free'
    ];

    const uniqueModels = [...new Set(modelList)];

    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
        console.log('[AI] No valid API key found. Using structured explanation.');
        return structuredExplanation;
    }

    for (const model of uniqueModels) {
        const result = await tryModel(model, apiUrl, apiKey, systemPrompt, userPrompt);
        if (result) {
            return result;
        }
    }

    console.warn('[AI] All models failed. Using structured explanation.');
    return structuredExplanation;
}

module.exports = {
    analyzeScreeningResult,
    generateFallbackExplanation,
    generateStructuredExplanation,
    isOutputSafe
};