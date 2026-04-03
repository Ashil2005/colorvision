import { TestEngine } from '../tests/testEngine.js';

let engine;
let plates = [];
let currentTestType = 'ishihara';

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
    platePlaceholder: document.getElementById('plate-placeholder'),
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
    aiExplanation: document.getElementById('ai-explanation'),
    testIshiharaBtn: document.getElementById('test-ishihara-btn'),
    testD15Btn: document.getElementById('test-d15-btn')
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

function shouldEnableFilter(type) {
    return type === 'Protan' || type === 'Deutan' || type === 'Tritan' || type === 'Red-Green Deficient';
}

async function init() {
    try {
        const ishiharaRes = await fetch(chrome.runtime.getURL('tests/ishihara.json'));
        if (!ishiharaRes.ok) {
            throw new Error(`Failed to load ishihara.json: ${ishiharaRes.status}`);
        }

        const ishiPlates = await ishiharaRes.json();
        plates = Array.isArray(ishiPlates)
            ? ishiPlates.filter((plate) => plate && plate.available !== false && plate.image)
            : [];

        if (plates.length === 0) {
            throw new Error('No usable Ishihara plates were found.');
        }

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
            currentTestType = currentSettings.testType || currentTestType;
            updateStatusDisplay();
        }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.cvdSettings) {
            currentSettings = {
                ...currentSettings,
                ...changes.cvdSettings.newValue
            };
            currentTestType = currentSettings.testType || currentTestType;
            updateStatusDisplay();
            showResult(currentSettings, false);
        }
    });

    if (elements.startBtn) {
        elements.startBtn.onclick = () => {
            currentTestType = 'ishihara';
            if (plates.length > 0) {
                showScreen('test', startTest);
            }
        };
    }

    if (elements.testIshiharaBtn) {
        elements.testIshiharaBtn.onclick = () => {
            currentTestType = 'ishihara';
            openFullScreenTestWithType('ishihara');
        };
    }

    if (elements.testD15Btn) {
        elements.testD15Btn.onclick = () => {
            currentTestType = 'farnsworth';
            openFullScreenTestWithType('farnsworth');
        };
    }

    if (elements.nextBtn) {
        elements.nextBtn.onclick = submitAnswer;
    }

    if (elements.answerInput) {
        elements.answerInput.onkeydown = (event) => {
            if (event.key === 'Enter') submitAnswer();
        };
    }

    if (elements.resetBtn) {
        elements.resetBtn.onclick = () => showScreen('welcome');
    }

    if (elements.fullScreenBtn) {
        elements.fullScreenBtn.onclick = () => openFullScreenTestWithType(currentTestType || 'ishihara');
    }

    if (elements.applyManualBtn) {
        elements.applyManualBtn.onclick = applyManualSelection;
    }

    if (elements.enableToggle) {
        elements.enableToggle.onchange = (event) => {
            currentSettings.enabled = event.target.checked;
            saveSettings();
        };
    }

    if (elements.severitySlider) {
        elements.severitySlider.oninput = (event) => {
            const value = Number(event.target.value) / 100;
            if (elements.strengthVal) {
                elements.strengthVal.innerText = `${Math.round(value * 100)}%`;
            }
            currentSettings.overrideSeverity = value;
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
        return;
    }

    elements.statusBadge.classList.add('hidden');
    elements.startBtn.innerText = 'Start Diagnosis';
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

    if (elements.platePlaceholder) {
        elements.platePlaceholder.innerHTML = '';
        elements.platePlaceholder.appendChild(img);
    }

    if (elements.answerInput) {
        elements.answerInput.value = '';
        elements.answerInput.focus();
    }

    if (elements.progress && plates.length > 0) {
        const progress = (engine.currentPlateIndex / plates.length) * 100;
        elements.progress.style.width = `${progress}%`;
    }
}

function submitAnswer() {
    if (!engine) return;

    const answer = elements.answerInput ? elements.answerInput.value.trim() : '';
    const next = engine.submitAnswer(answer);

    if (next.status === 'next') {
        renderPlate(next.plate);
        return;
    }

    showResult({ ...next.result }, true);
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
    const confidence = typeof result.confidence === 'number' ? result.confidence : 1;
    return Math.max(0, Math.min(confidence, 1));
}

function showResult(result, isNew = true) {
    showScreen('result');

    if (isNew) {
        currentSettings = {
            ...currentSettings,
            ...result,
            severityLabel: getSeverityLabel(result),
            confidence: getSafeConfidence(result),
            enabled: shouldEnableFilter(result.type),
            overrideSeverity: null,
            source: 'diagnostic',
            aiExplanation: '',
            testType: result.testType || currentTestType
        };

        currentTestType = currentSettings.testType || currentTestType;
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
        elements.resSeverity.innerText = currentSettings.severityLabel || getSeverityLabel(currentSettings);
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

    const severityValue = currentSettings.overrideSeverity !== null
        ? currentSettings.overrideSeverity
        : (currentSettings.severityScore ?? 0);

    if (elements.severitySlider) {
        elements.severitySlider.value = severityValue * 100;
    }

    if (elements.strengthVal) {
        elements.strengthVal.innerText = `${Math.round(severityValue * 100)}%`;
    }
}

function generateAIExplanation(result) {
    if ((result.type || 'Normal') === 'Normal') {
        return 'Your responses indicate normal color vision. No signs of color vision deficiency were detected.';
    }

    if ((result.type || '') === 'Borderline' || (result.type || '') === 'Unspecified') {
        return 'Your responses were inconclusive. The screening found some inconsistent plates or color choices, but not enough evidence to call this a definite deficiency pattern.';
    }

    return `The test results suggest ${result.type || 'unknown'} color vision deficiency with ${getSeverityLabel(result)} severity. This means certain color ranges may be harder to distinguish. Consider consulting a specialist for confirmation.`;
}

function fetchAiAnalysis(result) {
    if (!elements.aiExplanation) return;

    const explanation = generateAIExplanation(result);
    elements.aiExplanation.innerText = explanation;
    currentSettings.aiExplanation = explanation;
    saveSettings();
}

function saveSettings() {
    chrome.storage.local.set({ cvdSettings: currentSettings });
}

function openFullScreenTestWithType(testType) {
    chrome.windows.create({
        url: chrome.runtime.getURL(`tests/diagnostic.html?test=${encodeURIComponent(testType)}`),
        type: 'popup',
        width: 1000,
        height: 700
    });
}

init();

