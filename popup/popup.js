import { TestEngine } from '../tests/testEngine.js';

let engine;
let plates = [];

// DOM Elements
const screens = {
    welcome: document.getElementById('welcome'),
    test: document.getElementById('test-screen'),
    result: document.getElementById('result-screen')
};

const elements = {
    startBtn: document.getElementById('start-btn'),
    nextBtn: document.getElementById('next-btn'),
    answerInput: document.getElementById('answer-input'),
    plateName: document.getElementById('plate-name'),
    progress: document.getElementById('progress'),
    resType: document.getElementById('res-type'),
    resSeverity: document.getElementById('res-severity'),
    confBar: document.getElementById('conf-bar'),
    resetBtn: document.getElementById('reset-btn'),
    enableToggle: document.getElementById('enable-toggle'),
    severitySlider: document.getElementById('severity-override'),
    strengthVal: document.getElementById('strength-val'),
    applyManualBtn: document.getElementById('apply-manual-btn'),
    statusBadge: document.getElementById('status-badge'),
    modeText: document.getElementById('mode-text'),
    activeSource: document.getElementById('active-source'),
    fullScreenBtn: document.getElementById('full-screen-btn'),
    aiExplanation: document.getElementById('ai-explanation')
};

let currentSettings = {
    type: 'Normal',
    severityScore: 0,
    severityLabel: 'None',
    confidence: 1,
    enabled: false,
    overrideSeverity: null,
    source: 'none',
    aiExplanation: ''
};

const MANUAL_MAPPING = {
    Normal: { type: 'Normal', severity: 0.0 },
    Protanopia: { type: 'Protan', severity: 0.7 },
    Protanomaly: { type: 'Protan', severity: 0.4 },
    Deuteranopia: { type: 'Deutan', severity: 0.7 },
    Deuteranomaly: { type: 'Deutan', severity: 0.4 },
    Tritanopia: { type: 'Tritan', severity: 0.7 },
    Tritanomaly: { type: 'Tritan', severity: 0.4 },
    Achromatopsia: { type: 'Achromatopsia', severity: 1.0 }
};

async function init() {
    try {
        const ishiharaRes = await fetch(chrome.runtime.getURL('tests/ishihara.json'));
        if (!ishiharaRes.ok) {
            throw new Error(`Failed to load ishihara.json: ${ishiharaRes.status}`);
        }

        const ishiPlates = await ishiharaRes.json();
        plates = [...ishiPlates];

        console.log(`[VisionAI] Popup initialized with ${plates.length} test plates`);
        engine = new TestEngine(plates);
    } catch (error) {
        console.error('[VisionAI] Popup initialization failed:', error);
        if (elements.startBtn) {
            elements.startBtn.disabled = true;
            elements.startBtn.innerText = 'Error loading tests';
        }
        if (elements.fullScreenBtn) {
            elements.fullScreenBtn.disabled = true;
        }
    }

    chrome.storage.local.get(['cvdSettings'], (res) => {
        if (res.cvdSettings) {
            currentSettings = {
                ...currentSettings,
                ...res.cvdSettings
            };
            updateStatusDisplay();
        }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.cvdSettings) {
            currentSettings = {
                ...currentSettings,
                ...changes.cvdSettings.newValue
            };
            updateStatusDisplay();
            showResult(currentSettings, false);
        }
    });

    if (elements.startBtn) {
        elements.startBtn.onclick = () => {
            if (plates && plates.length > 0) {
                showScreen('test', startTest);
            } else {
                console.error('[VisionAI] Cannot start test - no plates loaded');
            }
        };
    }

    const testIshiharaBtn = document.getElementById('test-ishihara-btn');
    if (testIshiharaBtn) {
        testIshiharaBtn.onclick = () => openFullScreenTestWithType('ishihara');
    }

    if (elements.nextBtn) {
        elements.nextBtn.onclick = submitAnswer;
    }

    if (elements.answerInput) {
        elements.answerInput.onkeydown = (e) => {
            if (e.key === 'Enter') submitAnswer();
        };
    }

    if (elements.resetBtn) {
        elements.resetBtn.onclick = () => showScreen('welcome');
    }

    if (elements.fullScreenBtn) {
        elements.fullScreenBtn.onclick = openFullScreenTest;
    }

    if (elements.applyManualBtn) {
        elements.applyManualBtn.onclick = applyManualSelection;
    }

    if (elements.enableToggle) {
        elements.enableToggle.onchange = (e) => {
            currentSettings.enabled = e.target.checked;
            saveSettings();
        };
    }

    if (elements.severitySlider) {
        elements.severitySlider.oninput = (e) => {
            const val = e.target.value / 100;
            if (elements.strengthVal) {
                elements.strengthVal.innerText = `${Math.round(val * 100)}%`;
            }
            currentSettings.overrideSeverity = val;
            saveSettings();
        };
    }
}

function updateStatusDisplay() {
    if (!elements.statusBadge || !elements.modeText || !elements.startBtn) return;

    if (currentSettings.source !== 'none' && currentSettings.type !== 'Normal') {
        elements.statusBadge.classList.remove('hidden');
        elements.modeText.innerText = currentSettings.source.toUpperCase();
        elements.startBtn.innerText = 'Run Diagnostic Anyway';
    } else {
        elements.statusBadge.classList.add('hidden');
        elements.startBtn.innerText = 'Start Diagnosis';
    }
}

function applyManualSelection() {
    const selectedRadio = document.querySelector('input[name="cvd-manual"]:checked');
    if (!selectedRadio) return;

    const selected = selectedRadio.value;
    const config = MANUAL_MAPPING[selected];
    if (!config) return;

    currentSettings = {
        type: config.type,
        severityScore: config.severity,
        severityLabel:
            config.severity > 0.7 ? 'Strong'
                : config.severity > 0.35 ? 'Moderate'
                    : config.severity > 0 ? 'Mild'
                        : 'None',
        confidence: 1,
        enabled: true,
        overrideSeverity: null,
        source: 'manual',
        aiExplanation: 'Manual mode selected. AI explanation is only generated for diagnostic screening results.'
    };

    saveSettings();
    showResult(currentSettings, false);
}

function showScreen(name, callback) {
    Object.values(screens).forEach((screen) => {
        if (screen) screen.classList.add('hidden');
    });

    if (screens[name]) {
        screens[name].classList.remove('hidden');
    }

    if (callback) callback();
}

function startTest() {
    if (!engine) return;
    const plate = engine.startTest();
    renderPlate(plate);
}

function renderPlate(plate) {
    if (!plate) return;

    if (elements.plateName) {
        elements.plateName.innerText = `${plate.name} (${plate.category})`;
    }

    const img = document.createElement('img');
    img.src = chrome.runtime.getURL(plate.image);
    img.alt = plate.name;
    img.className = 'ishihara-img';

    const plateContainer = document.getElementById('plate-placeholder');
    if (plateContainer) {
        plateContainer.innerHTML = '';
        plateContainer.appendChild(img);
    }

    if (elements.answerInput) {
        elements.answerInput.value = '';
        elements.answerInput.focus();
    }

    if (elements.progress && plates.length > 0) {
        const prog = (engine.currentPlateIndex / plates.length) * 100;
        elements.progress.style.width = `${prog}%`;
    }
}

function submitAnswer() {
    if (!engine) return;

    const ans = elements.answerInput ? elements.answerInput.value.trim() : '';
    const next = engine.submitAnswer(ans);

    if (next.status === 'next') {
        renderPlate(next.plate);
    } else {
        showResult(next.result, true);
    }
}

function getSeverityLabel(result) {
    if (result.severityLabel) return result.severityLabel;

    const score = result.severityScore ?? 0;

    if (score > 0.7) return 'Strong';
    if (score > 0.35) return 'Moderate';
    if (score > 0) return 'Mild';
    return 'None';
}

function getSafeConfidence(result) {
    const conf = typeof result.confidence === 'number' ? result.confidence : 1;
    return Math.max(0, Math.min(conf, 1));
}

function showResult(result, isNew = true) {
    showScreen('result');

    if (isNew) {
        currentSettings = {
            ...currentSettings,
            ...result,
            severityLabel: getSeverityLabel(result),
            confidence: getSafeConfidence(result),
            enabled: true,
            overrideSeverity: null,
            source: 'diagnostic',
            aiExplanation: ''
        };

        saveSettings();
        fetchAiAnalysis(currentSettings);
    }

    updateStatusDisplay();

    if (elements.activeSource) {
        elements.activeSource.innerText = `${currentSettings.source} mode`;
    }

    if (elements.resType) {
        elements.resType.innerText = currentSettings.type || 'Normal';
    }

    if (elements.resSeverity) {
        elements.resSeverity.innerText =
            currentSettings.severityLabel || getSeverityLabel(currentSettings);
    }

    const confidencePercent = Math.round(getSafeConfidence(currentSettings) * 100);
    if (elements.confBar) {
        elements.confBar.style.width = `${confidencePercent}%`;
    }

    if (elements.aiExplanation) {
        if (currentSettings.aiExplanation) {
            elements.aiExplanation.innerText = currentSettings.aiExplanation;
        } else if (isNew) {
            elements.aiExplanation.innerText = 'Analyzing results with AI...';
        } else {
            elements.aiExplanation.innerText = 'No AI analysis available.';
        }
    }

    if (elements.enableToggle) {
        elements.enableToggle.checked = !!currentSettings.enabled;
    }

    const sev =
        currentSettings.overrideSeverity !== null
            ? currentSettings.overrideSeverity
            : (currentSettings.severityScore ?? 0);

    if (elements.severitySlider) {
        elements.severitySlider.value = sev * 100;
    }

    if (elements.strengthVal) {
        elements.strengthVal.innerText = `${Math.round(sev * 100)}%`;
    }
}

async function fetchAiAnalysis(result) {
    if (!elements.aiExplanation) return;

    elements.aiExplanation.innerText = 'Analyzing results with AI...';

    try {
        const payload = {
            likelyType: result.type || 'Normal',
            confidence: Math.round(getSafeConfidence(result) * 100),
            severity: getSeverityLabel(result),
            testQuality: 'Acceptable',
            totalResponses: Array.isArray(result.responses) ? result.responses.length : 0
        };

        console.log('[VisionAI] Sending AI payload:', payload);

        const response = await fetch('http://localhost:3000/analyze-result', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('[VisionAI] AI response:', data);

        if (data.success && data.analysis) {
            elements.aiExplanation.innerText = data.analysis;
            currentSettings.aiExplanation = data.analysis;
            saveSettings();
        } else {
            throw new Error(data.error || 'AI analysis failed');
        }
    } catch (error) {
        console.error('[VisionAI] Failed to fetch AI analysis:', error);

        const fallbackText =
            `The screening suggests a likely ${result.type || 'Normal'} pattern ` +
            `(Confidence: ${Math.round(getSafeConfidence(result) * 100)}%, Severity: ${getSeverityLabel(result)}). ` +
            `This is a preliminary screening only and not a clinical diagnosis. ` +
            `A professional eye evaluation may help with confirmation.`;

        elements.aiExplanation.innerText = fallbackText;
        currentSettings.aiExplanation = fallbackText;
        saveSettings();
    }
}

function saveSettings() {
    chrome.storage.local.set({ cvdSettings: currentSettings });
}

function openFullScreenTest() {
    chrome.windows.create({
        url: chrome.runtime.getURL('tests/diagnostic.html'),
        type: 'popup',
        width: 1000,
        height: 700
    });
}

function openFullScreenTestWithType(testType) {
    console.log('[VisionAI] Opening full screen test:', testType);

    chrome.windows.create({
        url: chrome.runtime.getURL('tests/diagnostic.html'),
        type: 'popup',
        width: 1000,
        height: 700
    });
}

init();