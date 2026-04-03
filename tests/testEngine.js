function normalizeAnswer(value) {
    return String(value ?? '').trim().toLowerCase();
}

function isUsablePlate(plate) {
    return Boolean(plate && plate.available !== false && plate.image);
}

function getPlateValue(plate, key, fallback = '') {
    return normalizeAnswer(plate?.[key] ?? fallback);
}

function getSeverityDetails(wrong) {
    if (wrong <= 3) {
        return { score: 0, label: 'None' };
    }
    if (wrong <= 5) {
        return { score: 0.35, label: 'Mild' };
    }
    if (wrong <= 10) {
        return { score: 0.65, label: 'Moderate' };
    }
    return { score: 0.85, label: 'Strong' };
}

function isScoredPlate(plate) {
    return isUsablePlate(plate) && plate?.type !== 'demo';
}

function evaluateResponses(plates, responses) {
    const plateMap = new Map((plates || []).map((plate) => [plate.id, plate]));
    const scoredResponses = (responses || []).filter((response) => {
        const plate = plateMap.get(response.plateId);
        return isScoredPlate(plate);
    });

    let correct = 0;
    let wrong = 0;
    let deficientMatches = 0;
    let vanishingMisses = 0;

    scoredResponses.forEach((response) => {
        const plate = plateMap.get(response.plateId);
        const answer = normalizeAnswer(response.answer);
        const normalAnswer = getPlateValue(plate, 'normal', plate.expected);
        const deficientAnswer = getPlateValue(plate, 'deficient');

        if (answer === normalAnswer) {
            correct += 1;
            return;
        }

        wrong += 1;

        if (deficientAnswer && answer === deficientAnswer) {
            deficientMatches += 1;
        }

        if (plate?.type === 'vanishing' && (!answer || answer === 'x' || answer === 'none' || answer === 'error')) {
            vanishingMisses += 1;
        }
    });

    let screeningResult = 'borderline';
    if (wrong <= 3) {
        screeningResult = 'normal';
    } else if (wrong >= 6) {
        screeningResult = 'deficient';
    }

    const severity = getSeverityDetails(wrong);
    const confidence = scoredResponses.length > 0 ? correct / scoredResponses.length : 0;
    let type = 'Borderline';
    if (screeningResult === 'normal') {
        type = 'Normal';
    } else if (screeningResult === 'deficient') {
        type = 'Red-Green Deficient';
    }

    return {
        type,
        confidence,
        severityScore: severity.score,
        severityLabel: severity.label,
        screeningResult,
        correct,
        wrong,
        deficientMatches,
        vanishingMisses,
        pass: screeningResult === 'normal'
    };
}

export class TestEngine {
    constructor(plates) {
        this.plates = Array.isArray(plates) ? plates.filter(isUsablePlate) : [];
        this.currentPlateIndex = 0;
        this.responses = [];
        this.startTime = null;
    }

    startTest() {
        this.currentPlateIndex = 0;
        this.responses = [];
        return this.getCurrentPlate();
    }

    getCurrentPlate() {
        this.startTime = Date.now();
        return this.plates[this.currentPlateIndex] ?? null;
    }

    submitAnswer(answer) {
        const currentPlate = this.plates[this.currentPlateIndex];
        if (!currentPlate) {
            return this.finishTest();
        }

        const endTime = Date.now();
        const timeTaken = endTime - this.startTime;

        this.responses.push({
            plateId: currentPlate.id,
            answer: normalizeAnswer(answer),
            timeTaken
        });

        this.currentPlateIndex += 1;

        if (this.currentPlateIndex >= this.plates.length) {
            return this.finishTest();
        }

        return { status: 'next', plate: this.getCurrentPlate() };
    }

    finishTest() {
        return {
            status: 'complete',
            result: {
                ...evaluateResponses(this.plates, this.responses),
                responses: this.responses
            }
        };
    }
}


