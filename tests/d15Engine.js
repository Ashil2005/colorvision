export const D15_THRESHOLD = 5;

function sum(values) {
    return values.reduce((total, value) => total + value, 0);
}

function getZoneForCap(id) {
    if (id >= 1 && id <= 4) return 'red';
    if (id >= 5 && id <= 8) return 'green';
    if (id >= 9 && id <= 11) return 'blue';
    if (id >= 12 && id <= 15) return 'yellow';
    return 'unknown';
}

function getSeverity(totalError) {
    if (totalError <= 4) {
        return { severityScore: 0, severityLabel: 'None' };
    }
    if (totalError <= 10) {
        return { severityScore: 0.35, severityLabel: 'Mild' };
    }
    if (totalError <= 18) {
        return { severityScore: 0.65, severityLabel: 'Moderate' };
    }
    return { severityScore: 0.85, severityLabel: 'Strong' };
}

export function classifyD15(errors, userOrder) {
    const zoneTotals = {
        red: 0,
        green: 0,
        blue: 0,
        yellow: 0
    };

    userOrder.forEach((capId, index) => {
        const zone = getZoneForCap(capId);
        if (zone === 'unknown') return;
        zoneTotals[zone] += Math.abs(errors[index] ?? 0);
    });

    const zoneScores = [zoneTotals.red, zoneTotals.green, zoneTotals.blue, zoneTotals.yellow];
    const maxScore = Math.max(...zoneScores);
    const matchingZones = Object.entries(zoneTotals)
        .filter(([, score]) => score === maxScore)
        .map(([zone]) => zone);

    if (maxScore < D15_THRESHOLD) {
        return { type: 'normal', zoneTotals, maxScore };
    }

    if (matchingZones.length > 1) {
        if (matchingZones.every((zone) => zone === 'blue' || zone === 'yellow')) {
            return { type: 'tritan', zoneTotals, maxScore };
        }
        return { type: 'unspecified', zoneTotals, maxScore };
    }

    const [dominantZone] = matchingZones;
    if (dominantZone === 'red') return { type: 'protan', zoneTotals, maxScore };
    if (dominantZone === 'green') return { type: 'deutan', zoneTotals, maxScore };
    if (dominantZone === 'blue' || dominantZone === 'yellow') return { type: 'tritan', zoneTotals, maxScore };

    return { type: 'unspecified', zoneTotals, maxScore };
}

export function evaluateD15(userOrder, correctOrder) {
    const safeOrder = Array.isArray(userOrder) ? userOrder.slice() : [];
    const expectedOrder = Array.isArray(correctOrder) ? correctOrder.slice() : [];

    const errors = safeOrder.map((id, index) => {
        const correctIndex = expectedOrder.indexOf(id);
        return correctIndex === -1 ? expectedOrder.length : index - correctIndex;
    });

    const classification = classifyD15(errors, safeOrder);
    const absoluteErrors = errors.map((error) => Math.abs(error));
    const totalError = sum(absoluteErrors);
    const severity = getSeverity(totalError);
    const confidence = safeOrder.length > 0
        ? Math.max(0, 1 - (totalError / (safeOrder.length * 3)))
        : 0;

    return {
        type: classification.type,
        errors,
        totalError,
        confidence,
        pass: classification.type === 'normal',
        zoneTotals: classification.zoneTotals,
        maxZoneScore: classification.maxScore,
        severityScore: severity.severityScore,
        severityLabel: severity.severityLabel,
        userOrder: safeOrder
    };
}
