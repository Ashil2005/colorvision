import { CVDClassifier } from '../ai/classifier.js';
import { SeverityModel } from '../ai/severityModel.js';

export class TestEngine {
    constructor(plates) {
        this.plates = plates;
        this.currentPlateIndex = 0;
        this.responses = [];
        this.startTime = null;
        this.classifier = new CVDClassifier();
        this.severityModel = new SeverityModel();
    }

    startTest() {
        this.currentPlateIndex = 0;
        this.responses = [];
        return this.getCurrentPlate();
    }

    getCurrentPlate() {
        this.startTime = Date.now();
        return this.plates[this.currentPlateIndex];
    }

    submitAnswer(answer) {
        const endTime = Date.now();
        const timeTaken = endTime - this.startTime;

        this.responses.push({
            plateId: this.plates[this.currentPlateIndex].id,
            answer: answer,
            timeTaken: timeTaken
        });

        this.currentPlateIndex++;

        if (this.currentPlateIndex >= this.plates.length) {
            return this.finishTest();
        }

        return { status: 'next', plate: this.getCurrentPlate() };
    }

    finishTest() {
        const classification = this.classifier.classify(this.plates, this.responses);
        const severity = this.severityModel.calculateSeverity(classification.type, this.plates, this.responses);

        return {
            status: 'complete',
            result: {
                type: classification.type,
                confidence: classification.confidence,
                severityScore: severity.score,
                severityLabel: severity.label,
                responses: this.responses
            }
        };
    }
}
