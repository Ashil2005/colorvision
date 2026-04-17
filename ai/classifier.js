/**
 * AI-Assisted CVD Classifier
 * Uses a rule-based weighted response pattern analysis to detect CVD type.
 */

export class CVDClassifier {
  constructor() {
    this.types = ['Normal', 'Protan', 'Deutan', 'Tritan'];
  }

  /**
   * Classifies the CVD type based on user responses.
   * @param {Array} plates - The plate metadata (expected, confusion for each type)
   * @param {Array} responses - The user's input for each plate
   * @returns {Object} { type: string, confidence: number }
   */
  classify(plates, responses) {
    const scores = {
      Normal: 0,
      Protan: 0,
      Deutan: 0,
      Tritan: 0
    };

    responses.forEach((res, index) => {
      const plate = plates.find(p => p.id === res.plateId);
      if (!plate) return;

      if (res.answer === plate.expected) {
        scores.Normal += 1;
      } else if (plate.confusionMapping) {
        // AI Logic: Check if the answer matches a specific deficiency confusion pattern
        for (const [type, confusionValue] of Object.entries(plate.confusionMapping)) {
          if (res.answer === confusionValue) {
            scores[type] += 2; // High weight for specific confusion
          }
        }
      } else {
        // General miss, lower weight towards the deficiency category
        if (plate.category === 'Red-Green') {
          scores.Protan += 0.5;
          scores.Deutan += 0.5;
        } else if (plate.category === 'Blue-Yellow') {
          scores.Tritan += 1;
        }
      }
    });

    // Determine the type with the highest score (excluding Normal if others are significant)
    let bestType = 'Normal';
    let maxScore = -1;

    // We give a slight bias toward finding a deficiency if misses are present
    const totalMisses = responses.filter(r => {
      const p = plates.find(pl => pl.id === r.plateId);
      return r.answer !== p.expected;
    }).length;

    if (totalMisses > 1) {
      for (const type of ['Protan', 'Deutan', 'Tritan']) {
        if (scores[type] > maxScore) {
          maxScore = scores[type];
          bestType = type;
        }
      }
    }

    // Confidence calculation
    const confidence = totalMisses === 0 ? 1.0 : Math.min(maxScore / (responses.length * 0.5), 1.0);

    return { type: bestType, confidence };
  }
}
