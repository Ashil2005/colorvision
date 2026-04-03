import { TestEngine } from './testEngine.js';
import { correctOrder } from './d15Config.js';
import { renderD15Board, createShuffledD15Order } from './d15Board.js';
import { evaluateD15 } from './d15Engine.js';

let engine;
let allPlates = [];
let ishiharaPlates = [];
let currentTestType = null;
let d15Order = [];

const searchParams = new URLSearchParams(window.location.search);

const elements = {
    selectionScreen: document.getElementById('selection-screen'),
    testScreen: document.getElementById('test-screen'),
    resultScreen: document.getElementById('result-screen'),
    testTitle: document.getElementById('test-title'),
    nextBtn: document.getElementById('next-btn'),
    answerInput: document.getElementById('answer-input'),
    plateName: document.getElementById('plate-name'),
    d15Description: document.getElementById('test-description'),
    instructionText: document.getElementById('instruction-text'),
    plateContainer: document.getElementById('plate-placeholder'),
    ishiharaPlateContainer: document.getElementById('ishihara-plate'),
    progress: document.getElementById('progress'),
    progressCount: document.getElementById('progress-count'),
    progressTotal: document.getElementById('progress-total'),
    resType: document.getElementById('res-type'),
    resSeverity: document.getElementById('res-severity'),
    closeBtn: document.getElementById('close-btn'),
    backBtn: document.getElementById('back-to-selection-btn'),
    reshuffleBtn: document.getElementById('reshuffle-btn'),
    startIshiharaBtn: document.getElementById('start-ishihara-btn'),
    startD15Btn: document.getElementById('start-d15-btn'),
    aiExplanation: document.getElementById('ai-explanation')
};

function shouldEnableFilter(type) {
    return type === 'Protan' || type === 'Deutan' || type === 'Tritan' || type === 'Red-Green Deficient';
}

function applyPlateContainerMode(testType) {
    if (!elements.plateContainer) return;
    
    // CSS now handles styling, just manage visibility
    const capsCard = elements.plateContainer.closest('.caps-card');
    const ishiharaWrapper = elements.testScreen?.querySelector('.ishihara-wrapper');
    
    if (testType === 'farnsworth') {
        if (capsCard) capsCard.style.display = 'block';
        if (ishiharaWrapper) ishiharaWrapper.style.display = 'none';
        return;
    }

    if (capsCard) capsCard.style.display = 'none';
    if (ishiharaWrapper) ishiharaWrapper.style.display = 'block';
}

function setTestInteractionMode(testType) {
    applyPlateContainerMode(testType);

    if (!elements.answerInput || !elements.nextBtn) return;

    if (testType === 'farnsworth') {
        elements.answerInput.classList.add('hidden');
        elements.answerInput.style.display = 'none';
        elements.nextBtn.innerText = 'Submit Order';
        if (elements.reshuffleBtn) {
            elements.reshuffleBtn.style.display = 'inline-block';
        }
        return;
    }

    elements.answerInput.classList.remove('hidden');
    elements.answerInput.style.display = '';
    elements.answerInput.placeholder = 'Your answer...';
    elements.nextBtn.innerText = 'Next';
    if (elements.reshuffleBtn) {
        elements.reshuffleBtn.style.display = 'none';
    }
}

function setProgress(current, total) {
    if (elements.progress) {
        const percent = total > 0 ? (current / total) * 100 : 0;
        elements.progress.style.width = `${percent}%`;
    }
    if (elements.progressCount) {
        elements.progressCount.innerText = String(current);
    }
    if (elements.progressTotal) {
        elements.progressTotal.innerText = String(total);
    }
}

function mapD15Result(result) {
    const typeMap = {
        normal: 'Normal',
        protan: 'Protan',
        deutan: 'Deutan',
        tritan: 'Tritan',
        unspecified: 'Unspecified'
    };

    return {
        ...result,
        type: typeMap[result.type] || 'Unspecified',
        testType: 'farnsworth'
    };
}

async function init() {
    try {
        const ishiharaRes = await fetch(chrome.runtime.getURL('tests/ishihara.json'));
        if (!ishiharaRes.ok) {
            throw new Error(`Failed to load ishihara.json: ${ishiharaRes.status} ${ishiharaRes.statusText}`);
        }

        const loadedPlates = await ishiharaRes.json();
        ishiharaPlates = Array.isArray(loadedPlates)
            ? loadedPlates.filter((plate) => plate && plate.available !== false && plate.image)
            : [];

        if (ishiharaPlates.length === 0) {
            throw new Error('No usable Ishihara plates were found.');
        }

        if (elements.startIshiharaBtn) {
            elements.startIshiharaBtn.onclick = (event) => {
                event.preventDefault();
                startSelectedTest('ishihara');
            };
        }

        if (elements.startD15Btn) {
            elements.startD15Btn.onclick = (event) => {
                event.preventDefault();
                startSelectedTest('farnsworth');
            };
        }

        if (elements.closeBtn) {
            elements.closeBtn.onclick = () => window.close();
        }

        if (elements.backBtn) {
            elements.backBtn.onclick = () => showSelectionScreen();
        }

        if (elements.reshuffleBtn) {
            elements.reshuffleBtn.onclick = (event) => {
                event.preventDefault();
                if (currentTestType === 'farnsworth') {
                    startD15Test();
                }
            };
        }

        showSelectionScreen();

        const preferredTest = searchParams.get('test');
        if (preferredTest === 'ishihara' || preferredTest === 'farnsworth') {
            startSelectedTest(preferredTest);
        }
    } catch (error) {
        console.error('[VisionAI] Failed to initialize diagnostic:', error);
        if (elements.plateName) {
            elements.plateName.innerText = `Error: Could not load test plates. ${error.message}`;
        }
        if (elements.nextBtn) {
            elements.nextBtn.disabled = true;
        }
        throw error;
    }
}

function showSelectionScreen() {
    currentTestType = null;
    if (elements.selectionScreen) elements.selectionScreen.classList.remove('hidden');
    if (elements.testScreen) elements.testScreen.classList.add('hidden');
    if (elements.resultScreen) elements.resultScreen.classList.add('hidden');
    setTestInteractionMode('ishihara');
    setProgress(0, 0);
}

function startSelectedTest(testType) {
    currentTestType = testType;

    if (elements.selectionScreen) elements.selectionScreen.classList.add('hidden');
    if (elements.testScreen) elements.testScreen.classList.remove('hidden');
    if (elements.resultScreen) elements.resultScreen.classList.add('hidden');

    if (testType === 'farnsworth') {
        startD15Test();
        return;
    }

    startIshiharaTest();
}

function startD15Test() {
    d15Order = createShuffledD15Order();
    if (elements.testTitle) {
        elements.testTitle.innerText = 'Farnsworth D-15 Test';
    }

    if (elements.testScreen) {
        elements.testScreen.classList.add('d15-fullscreen', 'fullscreen-wrapper');
    }
    if (elements.d15Description) {
        elements.d15Description.style.display = 'block';
    }
    if (elements.plateContainer) {
        elements.plateContainer.classList.add('caps-container');
    }
    if (elements.inputArea) {
        elements.inputArea.classList.add('test-actions');
    }

    setTestInteractionMode('farnsworth');
    renderD15Test();
}

function startIshiharaTest() {
    if (elements.testScreen) {
        elements.testScreen.classList.remove('d15-fullscreen', 'fullscreen-wrapper');
    }
    if (elements.d15Description) {
        elements.d15Description.style.display = 'none';
    }
    if (elements.plateContainer) {
        elements.plateContainer.classList.remove('caps-container');
    }
    if (elements.inputArea) {
        elements.inputArea.classList.remove('test-actions');
    }

    allPlates = [...ishiharaPlates];
    if (elements.testTitle) {
        elements.testTitle.innerText = 'Ishihara Vision Test';
    }

    setTestInteractionMode('ishihara');
    engine = new TestEngine(allPlates);
    const plate = engine.startTest();
    renderPlate(plate);
}

function renderPlate(plate) {
    if (!plate) return;

    elements.plateName.innerText = `${plate.name} (${plate.category})`;
    renderIshihara(plate);

    if (elements.answerInput) {
        elements.answerInput.value = '';
        elements.answerInput.focus();
    }

    setProgress(engine.currentPlateIndex + 1, allPlates.length);
}

function renderIshihara(plate) {
    if (!elements.ishiharaPlateContainer) return;
    
    elements.ishiharaPlateContainer.innerHTML = '';

    const img = document.createElement('img');
    img.alt = plate.name;
    img.className = 'ishihara-img';

    img.onerror = () => {
        elements.ishiharaPlateContainer.innerHTML = '';

        const errorDiv = document.createElement('div');
        errorDiv.className = 'image-placeholder';
        errorDiv.style.width = '100%';
        errorDiv.style.height = '100%';
        errorDiv.style.marginLeft = 'auto';
        errorDiv.style.marginRight = 'auto';
        errorDiv.style.lineHeight = '1.5';
        errorDiv.innerText = `Image not found\n${plate.image}\n\nPlease verify the image file exists.`;
        elements.ishiharaPlateContainer.appendChild(errorDiv);
    };

    img.src = chrome.runtime.getURL(plate.image);
    elements.ishiharaPlateContainer.appendChild(img);
}

function renderD15Test() {
    if (elements.instructionText) {
        elements.instructionText.innerText = 'Drag the caps into a smooth color progression from left to right.';
    }

    renderD15Board(elements.plateContainer, d15Order, {
        onReorder(nextOrder) {
            d15Order = nextOrder;
            renderD15Test();
        }
    });

    setProgress(correctOrder.length, correctOrder.length);
}

function submitAnswer() {
    if (currentTestType === 'farnsworth') {
        showResult(mapD15Result(evaluateD15(d15Order, correctOrder)));
        return;
    }

    if (!engine) return;

    const answer = elements.answerInput ? elements.answerInput.value.trim() : '';
    const next = engine.submitAnswer(answer);

    if (next.status === 'next') {
        renderPlate(next.plate);
        return;
    }

    showResult({ ...next.result, testType: 'ishihara' });
}

function showResult(result) {
    if (elements.testScreen) elements.testScreen.classList.add('hidden');
    if (elements.resultScreen) elements.resultScreen.classList.remove('hidden');

    const currentSettings = {
        type: result.type,
        severityScore: result.severityScore,
        confidence: result.confidence,
        severityLabel: result.severityLabel,
        enabled: shouldEnableFilter(result.type),
        overrideSeverity: null,
        source: 'diagnostic',
        testType: result.testType || currentTestType,
        aiExplanation: ''
    };

    elements.resType.innerText = result.type;
    elements.resSeverity.innerText = result.severityLabel || 'None';

    fetchAiAnalysis(result, currentSettings);
}

function generateAIExplanation(result) {
    if ((result.type || 'Normal') === 'Normal') {
        return 'Your responses indicate a normal arrangement pattern. No strong signs of color vision deficiency were detected in this screening.';
    }

    if ((result.type || '') === 'Borderline' || (result.type || '') === 'Unspecified') {
        return 'Your responses were inconclusive. The screening found some inconsistent color choices, but not enough evidence to confidently assign a specific deficiency pattern.';
    }

    return `The test results suggest ${result.type} color vision deficiency with ${result.severityLabel || 'Mild'} severity. This means certain color ranges may be harder to distinguish. Consider consulting a specialist for confirmation.`;
}

function fetchAiAnalysis(result, currentSettings) {
    const explanationText = generateAIExplanation(result);

    if (elements.aiExplanation) {
        elements.aiExplanation.innerText = explanationText;
    }

    currentSettings.aiExplanation = explanationText;
    chrome.storage.local.set({ cvdSettings: currentSettings });
}

if (elements.nextBtn) {
    elements.nextBtn.onclick = submitAnswer;
}

if (elements.answerInput) {
    elements.answerInput.onkeydown = (event) => {
        if (event.key === 'Enter' && currentTestType !== 'farnsworth') {
            submitAnswer();
        }
    };
}

init();
