/**
 * injectFilter.js - Robust Content Script
 * 
 * DISCLAIMER: This extension is for educational/project purposes only.
 * It is NOT a medical device and should not be used for medical diagnosis.
 */

(function () {
    const FILTER_ID = 'vision-correction-filter';
    const SVG_ID = 'vision-correction-svg';

    /**
     * Linear Interpolation (LERP) for Color Matrices
     * Mathematical proof: Matrix_res = I * (1 - s) + M_target * s
     */
    function getMatrixString(type, severity) {
        const identity = [
            1, 0, 0, 0, 0,
            0, 1, 0, 0, 0,
            0, 0, 1, 0, 0,
            0, 0, 0, 1, 0
        ];

        const fullMatrices = {
            Protan: [0.567, 0.433, 0, 0, 0, 0.558, 0.442, 0, 0, 0, 0, 0.242, 0.758, 0, 0, 0, 0, 0, 1, 0],
            Deutan: [0.625, 0.375, 0, 0, 0, 0.7, 0.3, 0, 0, 0, 0, 0.3, 0.7, 0, 0, 0, 0, 0, 1, 0],
            Tritan: [0.95, 0.05, 0, 0, 0, 0, 0.433, 0.567, 0, 0, 0, 0.475, 0.525, 0, 0, 0, 0, 0, 1, 0]
        };

        if (type === 'Normal' || !fullMatrices[type]) return identity.join(' ');

        const target = fullMatrices[type];
        const adaptive = identity.map((val, i) => (val * (1 - severity) + target[i] * severity).toFixed(3));

        return adaptive.join(' ');
    }

    function applyToDOM(settings) {
        // Safety check for extension context invalidation (after reload)
        if (!chrome.runtime?.id) return;

        let svg = document.getElementById(SVG_ID);

        if (!settings || !settings.enabled || settings.type === 'Normal') {
            if (svg) svg.remove();
            document.documentElement.style.filter = '';
            return;
        }

        const severity = settings.overrideSeverity !== null ? settings.overrideSeverity : settings.severityScore;
        const matrix = getMatrixString(settings.type, severity);

        // Ensure we have a place to inject (handle early script execution)
        const container = document.body || document.documentElement;

        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = SVG_ID;
            svg.setAttribute('style', 'position:absolute; width:0; height:0; pointer-events:none;');
            svg.setAttribute('aria-hidden', 'true');
            svg.innerHTML = `
        <defs>
          <filter id="${FILTER_ID}" color-interpolation-filters="sRGB">
            <feColorMatrix type="matrix" values="${matrix}" />
          </filter>
        </defs>
      `;
            container.appendChild(svg);
        } else {
            const feColorMatrix = svg.querySelector('feColorMatrix');
            if (feColorMatrix) feColorMatrix.setAttribute('values', matrix);
        }

        // Apply filter globally
        document.documentElement.style.filter = `url(#${FILTER_ID})`;
    }

    // Handle Initial State & Persistence
    const init = () => {
        try {
            chrome.storage.local.get(['cvdSettings'], (res) => {
                applyToDOM(res.cvdSettings);
            });
        } catch (e) {
            console.log("[VisionAI] Extension context invalidated. Please refresh the page.");
        }
    };

    // Immediate execution or wait for body
    if (document.body) init();
    else {
        const observer = new MutationObserver(() => {
            if (document.body) {
                observer.disconnect();
                init();
            }
        });
        observer.observe(document.documentElement, { childList: true });
    }

    // Reactive updates
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.cvdSettings) {
            applyToDOM(changes.cvdSettings.newValue);
        }
    });

})();
