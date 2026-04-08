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
    if (!plates || !responses || responses.length === 0) {
      console.warn('[VisionAI] classify() called with empty data:', { platesCount: plates?.length, responsesCount: responses?.length });
      return { type: 'Normal', confidence: 0 };
    }

    const scores = {
      Normal: 0,
      Protan: 0,
      Deutan: 0,
      Tritan: 0
    };

    responses.forEach((res, index) => {
      const plate = plates.find(p => p.id === res.plateId);
      if (!plate) {
        console.warn(`[VisionAI] Plate ID ${res.plateId} not found in plates array`);
        return;
      }

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
        // General miss: we didn't recognise a specific confusion answer.
        // Rather than rewarding both Red-Green deficiencies equally (which
        // tended to produce tied zero scores) give a small score so the
        // type selection logic has something to compare.  The value is
        // intentionally tiny because we prefer to rely on the explicit
        // confusionMapping entries when available.
        if (plate.category === 'Red-Green') {
          scores.Protan += 0.1;
          scores.Deutan += 0.1;
        } else if (plate.category === 'Blue-Yellow') {
          scores.Tritan += 0.1;
        }
      }
    });

    // Determine the type with the highest score (excluding Normal if others are significant)
    let bestType = 'Normal';
    let maxScore = -1;

    // We give a slight bias toward finding a deficiency if misses are present
    const totalMisses = responses.filter(r => {
      const p = plates.find(pl => pl.id === r.plateId);
      return p && r.answer !== p.expected;
    }).length;

    if (totalMisses > 1) {
      // pick the type with the highest score; if all scores are 0 or
      // negative, we should stay "Normal" rather than bias toward the
      // first entry (Protan).  This fixes the common issue where a user
      // who simply guessed every plate would always be classified as
      // Protan even though no confusion pattern was detected.
      for (const type of ['Protan', 'Deutan', 'Tritan']) {
        if (scores[type] > maxScore) {
          maxScore = scores[type];
          bestType = type;
        }
      }

      if (maxScore <= 0) {
        // no positive evidence for any deficiency
        bestType = 'Normal';
      }
    }

    // --- Confidence calculation ---
    const confidence = responses.length === 0 ? 1.0 : 
                     (totalMisses === 0 ? 1.0 : Math.min(maxScore / (responses.length * 0.5), 1.0));

    console.log(`[VisionAI] Classification result: type=${bestType}, confidence=${confidence.toFixed(2)}, misses=${totalMisses}/${responses.length}`);
    return { type: bestType, confidence };
  }
}
