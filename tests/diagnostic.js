import { TestEngine } from './testEngine.js';

let engine;
let allPlates = [];
let ishiharaPlates = [];
let currentTestType = null;

const elements = {
    selectionScreen: document.getElementById('selection-screen'),
    testScreen: document.getElementById('test-screen'),
    resultScreen: document.getElementById('result-screen'),
    testTitle: document.getElementById('test-title'),
    nextBtn: document.getElementById('next-btn'),
    answerInput: document.getElementById('answer-input'),
    plateName: document.getElementById('plate-name'),
    plateContainer: document.getElementById('plate-placeholder'),
    progress: document.getElementById('progress'),
    progressCount: document.getElementById('progress-count'),
    progressTotal: document.getElementById('progress-total'),
    resType: document.getElementById('res-type'),
    resSeverity: document.getElementById('res-severity'),
    closeBtn: document.getElementById('close-btn'),
    backBtn: document.getElementById('back-to-selection-btn'),
    startIshiharaBtn: document.getElementById('start-ishihara-btn'),
    testIshiharaRadio: document.getElementById('test-ishihara')
};

async function init() {
    try {
        const ishiharaRes = await fetch(chrome.runtime.getURL('tests/ishihara.json'));
        if (!ishiharaRes.ok) {
            throw new Error(`Failed to load ishihara.json: ${ishiharaRes.status} ${ishiharaRes.statusText}`);
        }
        ishiharaPlates = await ishiharaRes.json();

        console.log(`[VisionAI] Loaded ${ishiharaPlates.length} Ishihara plates`);

        // Setup button listeners with debugging
        console.log('[VisionAI] Setting up button listeners...');
        console.log('[VisionAI] startIshiharaBtn exists?', !!elements.startIshiharaBtn);

        if (elements.startIshiharaBtn) {
            elements.startIshiharaBtn.onclick = (e) => {
                e.preventDefault();
                console.log('[VisionAI] Ishihara button clicked');
                startSelectedTest('ishihara');
            };
        } else {
            console.error('[VisionAI] startIshiharaBtn not found!');
        }
        
        if (elements.closeBtn) {
            elements.closeBtn.onclick = () => window.close();
        }

        // Setup back button
        if (elements.backBtn) {
            elements.backBtn.onclick = () => {
                console.log('[VisionAI] Back button clicked, returning to selection screen');
                showSelectionScreen();
            };
        }

        // Always show selection screen initially
        showSelectionScreen();
        console.log('[VisionAI] Diagnostic window ready - showing selection screen');

    } catch (error) {
        console.error('[VisionAI] Failed to initialize diagnostic:', error);
        if (elements.plateName) {
            elements.plateName.innerText = 'Error: Could not load test plates. ' + error.message;
        }
        if (elements.nextBtn) elements.nextBtn.disabled = true;
        throw error;
    }
}

function showSelectionScreen() {
    if (elements.selectionScreen) elements.selectionScreen.classList.remove('hidden');
    if (elements.testScreen) elements.testScreen.classList.add('hidden');
    if (elements.resultScreen) elements.resultScreen.classList.add('hidden');
    console.log('[VisionAI] Showing selection screen');
}

function startSelectedTest(testType) {
    currentTestType = testType;
    
    // Prepare plates based on selected test
    if (testType === 'ishihara') {
        allPlates = [...ishiharaPlates];
        elements.testTitle.innerText = 'Ishihara Vision Test';
    }

    engine = new TestEngine(allPlates);
    
    // Show test screen and hide selection
    if (elements.selectionScreen) elements.selectionScreen.classList.add('hidden');
    if (elements.testScreen) elements.testScreen.classList.remove('hidden');
    if (elements.resultScreen) elements.resultScreen.classList.add('hidden');
    
    console.log(`[VisionAI] Starting ${testType} test with ${allPlates.length} plates`);
    
    // Start the test
    const plate = engine.startTest();
    renderPlate(plate);
}

function renderPlate(plate) {
    elements.plateName.innerText = plate.name + " (" + plate.category + ")";

    renderIshihara(plate);

    elements.answerInput.value = '';
    elements.answerInput.focus();

    const progressValue = (engine.currentPlateIndex / allPlates.length) * 100;
    elements.progress.style.width = progressValue + '%';
    
    // Update progress counter
    if (elements.progressCount) {
        elements.progressCount.innerText = engine.currentPlateIndex + 1;
    }
    if (elements.progressTotal) {
        elements.progressTotal.innerText = allPlates.length;
    }
}

function renderIshihara(plate) {
    elements.plateContainer.innerHTML = '';
    
    const img = document.createElement('img');
    img.alt = plate.name;
    img.className = "ishihara-img";
    
    img.onload = () => {
        console.log(`[VisionAI] Image loaded: ${plate.image}`);
    };
    
    img.onerror = () => {
        console.error(`[VisionAI] Failed to load image: ${plate.image}`);
        elements.plateContainer.innerHTML = '';
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'image-placeholder';
        errorDiv.style.width = '400px';
        errorDiv.style.height = '400px';
        errorDiv.style.marginLeft = 'auto';
        errorDiv.style.marginRight = 'auto';
        errorDiv.style.lineHeight = '1.5';
        errorDiv.innerText = `❌ Image not found\n${plate.image}\n\nPlease verify the image file exists.`;
        elements.plateContainer.appendChild(errorDiv);
    };
    
    const imageUrl = chrome.runtime.getURL(plate.image);
    console.log(`[VisionAI] Loading image from: ${imageUrl}`);
    img.src = imageUrl;
    
    elements.plateContainer.appendChild(img);
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

function showResult(result) {
    if (elements.testScreen) elements.testScreen.classList.add('hidden');
    if (elements.resultScreen) elements.resultScreen.classList.remove('hidden');

    const currentSettings = {
        type: result.type,
        severityScore: result.severityScore,
        confidence: result.confidence,
        severityLabel: result.severityLabel,
        enabled: true,
        overrideSeverity: null,
        source: "diagnostic"
    };

    chrome.storage.local.set({ cvdSettings: currentSettings });

    elements.resType.innerText = result.type;
    elements.resSeverity.innerText = result.severityLabel || 
        (result.severityScore > 0.7 ? 'Strong' : 
         result.severityScore > 0.35 ? 'Moderate' : 'Mild');

    console.log('[VisionAI] Test completed:', currentSettings);

    setTimeout(() => {
        window.close();
    }, 2000);
}

// Event listeners
elements.nextBtn.onclick = submitAnswer;

elements.answerInput.onkeydown = (e) => {
    if (e.key === 'Enter') submitAnswer();
};

init();