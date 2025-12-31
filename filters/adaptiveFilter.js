/**
 * Adaptive Filter Logic
 * Interpolates color matrices based on severity for personalized correction.
 */

export const getMatrixForCVD = (type, severity) => {
    const identity = [
        1, 0, 0, 0, 0,
        0, 1, 0, 0, 0,
        0, 0, 1, 0, 0,
        0, 0, 0, 1, 0
    ];

    const fullMatrices = {
        Protan: [
            0.567, 0.433, 0, 0, 0,
            0.558, 0.442, 0, 0, 0,
            0, 0.242, 0.758, 0, 0,
            0, 0, 0, 1, 0
        ],
        Deutan: [
            0.625, 0.375, 0, 0, 0,
            0.7, 0.3, 0, 0, 0,
            0, 0.3, 0.7, 0, 0,
            0, 0, 0, 1, 0
        ],
        Tritan: [
            0.95, 0.05, 0, 0, 0,
            0, 0.433, 0.567, 0, 0,
            0, 0.475, 0.525, 0, 0,
            0, 0, 0, 1, 0
        ]
    };

    if (type === 'Normal' || !fullMatrices[type]) return identity;

    const target = fullMatrices[type];

    // Linear interpolation: Matrix = Identity * (1 - severity) + Target * severity
    const adaptiveMatrix = identity.map((val, i) => {
        return val * (1 - severity) + target[i] * severity;
    });

    return adaptiveMatrix;
};
