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
    resFilterType: document.getElementById('res-filter-type'),
    resRecommendedTest: document.getElementById('res-recommended-test'),
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
    // Tests are loaded when starting the test based on selection
    engine = new TestEngine();

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

async function startTest() {
    const selectedTest = document.querySelector('input[name="ai-test-type"]:checked').value;

    // Load appropriate test data based on selection
    if (selectedTest === 'ishihara') {
        const response = await fetch('../tests/ishihara.json');
        plates = await response.json();
    } else if (selectedTest === 'farnsworth') {
        plates = engine.getFarnsworthSequence();
    } else if (selectedTest === 'cone') {
        plates = engine.getConeSequence();
    }

    engine.initTest(selectedTest, plates);
    const plate = engine.startTest();
    renderPlate(plate);
}

function renderPlate(plate) {
    elements.plateName.innerText = plate.name + (plate.category ? " (" + plate.category + ")" : "");
    elements.answerInput.value = '';
    elements.answerInput.focus();

    const prog = (engine.currentPlateIndex / engine.plates.length) * 100;
    elements.progress.style.width = prog + '%';

    // Adjust UI based on test type (stub for custom UI if needed later)
    const ishiharaContainer = document.getElementById('plate-name');
    const farnsworthContainer = document.getElementById('farnsworth-container');
    const coneContainer = document.getElementById('cone-container');

    // Base URL for actual colorlite images
    const ISHIHARA_BASE_URL = "https://www.colorlitelens.com/images/Ishihara/";

    if (engine.testType === 'farnsworth') {
        ishiharaContainer.innerHTML = '';
        farnsworthContainer.classList.remove('hidden');
        coneContainer.classList.add('hidden');
        elements.answerInput.placeholder = "Enter matching cap number (e.g., 2)";
        // Render a colored block reflecting the current Farnsworth cap rgb
        farnsworthContainer.innerHTML = `<div style="width:100px; height:100px; background-color:${plate.rgb}; margin:10px auto; border-radius:50%; border:2px solid #ccc;"></div>`;
    } else if (engine.testType === 'cone') {
        ishiharaContainer.innerHTML = `<img src="${plate.image}" alt="Cone Response" style="max-width:100%; border-radius:8px;">`;
        farnsworthContainer.classList.add('hidden');
        coneContainer.classList.remove('hidden');
        elements.answerInput.placeholder = "Enter matching curve shift number";
        coneContainer.innerHTML = `<p style="font-size:0.85em; text-align:center;">Analyze the receptor shift shown above.</p>`;
    } else {
        // Ishihara Plate
        const imgUrl = ISHIHARA_BASE_URL + plate.image;
        ishiharaContainer.innerHTML = `<img src="${imgUrl}" alt="${plate.name}" style="max-width:100%; border-radius:50%; border:4px solid #fff; box-shadow:0 4px 6px rgba(0,0,0,0.1);">`;
        farnsworthContainer.classList.add('hidden');
        coneContainer.classList.add('hidden');
        elements.answerInput.placeholder = "What number do you see? (or 'nothing')";
    }
}

function submitAnswer() {
    const ans = elements.answerInput.value.trim();
    if (!ans) return;

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

    // Set Recommended Filter and Test (100% accuracy requirement)
    let recommendedFilter = "None";
    let recommendedTest = "Ishihara Plates";

    if (currentSettings.type !== 'Normal') {
        recommendedFilter = currentSettings.type + " Correction Filter";

        if (currentSettings.severityScore > 0.6) {
            recommendedTest = "Farnsworth Munsell (for accurate hue discrimination limitation assessment)";
        } else if (currentSettings.severityScore > 0.3) {
            recommendedTest = "Cone Response Simulation (for specific cell deficiency mapping)";
        } else {
            recommendedTest = "Ishihara Plates (sufficient for mild anomaly)";
        }
    }

    elements.resFilterType.innerText = recommendedFilter;
    if (elements.resRecommendedTest) {
        elements.resRecommendedTest.innerText = recommendedTest;
    }

    // Apply entire browser filter by communicating with background/content script
    if (currentSettings.enabled && currentSettings.type !== 'Normal') {
        chrome.runtime.sendMessage({
            action: 'applyFilter',
            settings: currentSettings,
            filterName: recommendedFilter
        });
    }

    elements.enableToggle.checked = currentSettings.enabled;
    const sev = currentSettings.overrideSeverity !== null ? currentSettings.overrideSeverity : currentSettings.severityScore;
    elements.severitySlider.value = sev * 100;
    elements.strengthVal.innerText = Math.round(sev * 100) + '%';
}

function saveSettings() {
    chrome.storage.local.set({ cvdSettings: currentSettings });
}

init();
