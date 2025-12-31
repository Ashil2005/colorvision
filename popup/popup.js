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
    startBtn: document.getElementById('start-btn')
};

let currentSettings = {
    type: 'Normal',
    severityScore: 0,
    enabled: false,
    overrideSeverity: null,
    source: 'none'
};

const MANUAL_MAPPING = {
    'Normal': { type: 'Normal', severity: 0.0 },
    'Protanopia': { type: 'Protan', severity: 0.7 },
    'Protanomaly': { type: 'Protan', severity: 0.4 },
    'Deuteranopia': { type: 'Deutan', severity: 0.7 },
    'Deuteranomaly': { type: 'Deutan', severity: 0.4 },
    'Tritanopia': { type: 'Tritan', severity: 0.7 },
    'Tritanomaly': { type: 'Tritan', severity: 0.4 },
    'Achromatopsia': { type: 'Achromatopsia', severity: 1.0 }
};

// Initialize
async function init() {
    const response = await fetch('../tests/ishihara.json');
    plates = await response.json();
    engine = new TestEngine(plates);

    // Load existing settings
    chrome.storage.local.get(['cvdSettings'], (res) => {
        if (res.cvdSettings) {
            currentSettings = res.cvdSettings;
            updateStatusDisplay();
        }
    });

    elements.startBtn.onclick = () => showScreen('test', startTest);
    elements.nextBtn.onclick = submitAnswer;
    elements.answerInput.onkeydown = (e) => { if (e.key === 'Enter') submitAnswer(); };
    elements.resetBtn.onclick = () => showScreen('welcome');

    // Manual Selection
    elements.applyManualBtn.onclick = applyManualSelection;

    // Correction Controls
    elements.enableToggle.onchange = (e) => {
        currentSettings.enabled = e.target.checked;
        saveSettings();
    };

    elements.severitySlider.oninput = (e) => {
        const val = e.target.value / 100;
        elements.strengthVal.innerText = Math.round(val * 100) + '%';
        currentSettings.overrideSeverity = val;
        saveSettings();
    };
}

function updateStatusDisplay() {
    if (currentSettings.source !== 'none' && currentSettings.type !== 'Normal') {
        elements.statusBadge.classList.remove('hidden');
        elements.modeText.innerText = currentSettings.source.toUpperCase();
        elements.startBtn.innerText = "Run Diagnostic Anyway";
    } else {
        elements.statusBadge.classList.add('hidden');
        elements.startBtn.innerText = "Start Diagnosis";
    }
}

function applyManualSelection() {
    const selected = document.querySelector('input[name="cvd-manual"]:checked').value;
    const config = MANUAL_MAPPING[selected];

    currentSettings = {
        type: config.type,
        severityScore: config.severity,
        enabled: true,
        overrideSeverity: null,
        source: 'manual'
    };

    saveSettings();
    showResult(currentSettings, false);
}

function showScreen(name, callback) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
    if (callback) callback();
}

function startTest() {
    const plate = engine.startTest();
    renderPlate(plate);
}

function renderPlate(plate) {
    elements.plateName.innerText = plate.name + " (" + plate.category + ")";
    elements.answerInput.value = '';
    elements.answerInput.focus();

    const prog = (engine.currentPlateIndex / plates.length) * 100;
    elements.progress.style.width = prog + '%';
}

function submitAnswer() {
    const ans = elements.answerInput.value.trim();
    const next = engine.submitAnswer(ans);

    if (next.status === 'next') {
        renderPlate(next.plate);
    } else {
        showResult(next.result);
    }
}

function showResult(result, isNew = true) {
    showScreen('result');

    if (isNew) {
        currentSettings = {
            ...result,
            enabled: true,
            overrideSeverity: null,
            source: 'diagnostic'
        };
        saveSettings();
    }

    updateStatusDisplay();
    elements.activeSource.innerText = currentSettings.source + " mode";

    elements.resType.innerText = currentSettings.type;
    elements.resSeverity.innerText = currentSettings.severityLabel || (currentSettings.severityScore > 0.7 ? 'Strong' : currentSettings.severityScore > 0.35 ? 'Moderate' : 'Mild');
    elements.confBar.style.width = (currentSettings.confidence * 100 || 100) + '%';

    elements.enableToggle.checked = currentSettings.enabled;
    const sev = currentSettings.overrideSeverity !== null ? currentSettings.overrideSeverity : currentSettings.severityScore;
    elements.severitySlider.value = sev * 100;
    elements.strengthVal.innerText = Math.round(sev * 100) + '%';
}

function saveSettings() {
    chrome.storage.local.set({ cvdSettings: currentSettings });
}

init();
