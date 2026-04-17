/**
 * CVD Severity Model
 * Evaluates the strength of the deficiency based on miss rates and response lag.
 */

export class SeverityModel {
    /**
     * Calculates severity score.
     * @param {string} type - The detected CVD type
     * @param {Array} plates - Plate metadata
     * @param {Array} responses - User responses
     * @returns {Object} { score: number, label: string }
     */
    calculateSeverity(type, plates, responses) {
        if (type === 'Normal') return { score: 0, label: 'None' };

        const relevantPlates = plates.filter(p => p.category === this.getCategory(type));
        const relevantResponses = responses.filter(r => {
            const p = plates.find(pl => pl.id === r.plateId);
            return p && p.category === this.getCategory(type);
        });

        if (relevantPlates.length === 0) return { score: 0, label: 'Unknown' };

        // Factor 1: Accuracy (Miss rate)
        const misses = relevantResponses.filter(r => {
            const p = plates.find(pl => pl.id === r.plateId);
            return r.answer !== p.expected;
        }).length;
        const accuracyPenalty = misses / relevantPlates.length;

        // Factor 2: Reaction Time (Mildly elevated RT indicates struggling)
        // Threshold high for a "Simple" plate. Normal <= 3s, > 5s is high.
        const avgResponseTime = relevantResponses.reduce((acc, r) => acc + r.timeTaken, 0) / relevantResponses.length;
        const timePenalty = Math.max(0, (avgResponseTime - 2000) / 8000); // Normalize 2s-10s to 0-1

        // Combined score (Weighted: Accuracy 80%, Time 20%)
        const score = (accuracyPenalty * 0.8) + (timePenalty * 0.2);
        const clampedScore = Math.min(Math.max(score, 0), 1);

        let label = 'Mild';
        if (clampedScore > 0.7) label = 'Strong';
        else if (clampedScore > 0.35) label = 'Moderate';

        return { score: clampedScore, label };
    }

    getCategory(type) {
        if (type === 'Protan' || type === 'Deutan') return 'Red-Green';
        if (type === 'Tritan') return 'Blue-Yellow';
        return 'General';
    }
}
