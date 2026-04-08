# Color Vision Deficiency (CVD) Detection & Correction Extension

## Project Overview

**ColorVision** is a Chrome extension that diagnoses color vision deficiencies (colorblindness) and applies adaptive color correction filters to web pages. It helps people with color vision problems perceive websites more naturally.

---

## What It Does

### 1. **Diagnostic System** 🧪
The extension runs two scientific color blindness tests:

#### **Ishihara Plates Test** (28 plates)
- Classic colored dot matrix test
- User identifies numbers hidden in the dots
- Each plate targets different color perception deficiencies
- Expected answers: "12", "8", "29", "5", "74", "6", "73", "5", "45", "2", "X", "X", "X", etc.
- **Confusion Mappings**: Shows what colorblind users might see instead:
  - Red-Green deficient users might see "3" instead of "8"
  - Tests cover Red-Green (Protan/Deutan) and Blue-Yellow (Tritan) deficiency

#### **Farnsworth D-15 Hue Discrimination Test** (16 color caps + 1 reference)
- User arranges colored caps in order of increasing hue
- Reference cap (ID 1) is fixed
- 15 variable caps (IDs 2-16) in specific color sequence
- Detects subtle crossover patterns that indicate CVD type
- **Crossover Analysis**: 
  - Protan axis crossovers near middle (mid ≈ 7.5)
  - Deutan axis crossovers (mid ≈ 8.5)
  - Tritan axis crossovers at extremes (mid ≈ 4.5 or 13)

### 2. **AI Classification Engine** 🧠
Located in `ai/classifier.js`, uses weighted pattern matching:

**Scoring System:**
- Correct answer = +1 point to "Normal"
- Wrong answer matching CVD confusion pattern = +2 points to that type
- General miss = +0.5 points to relevant deficiency categoryType = **Protan** | **Deutan** | **Tritan** | **Normal**

**D-15 Crossover Detection:**
- Analyzes sequence gaps > 2 units
- Maps crossovers to specific CVD axes
- Can override Ishihara results if D-15 shows strong pattern
- Confidence score: 0.0-1.0 based on miss rate

### 3. **Severity Assessment** 📊
Located in `ai/severityModel.js`, calculates deficiency strength:

**Factors:**
1. **Accuracy Penalty** (80% weight): Miss rate on relevant plates
2. **Response Time Penalty** (20% weight): Avg reaction time per plate
   - Normal: ≤2 seconds
   - Slow: >5 seconds = high penalty

**Severity Labels:**
- **None**: Type = "Normal"
- **Mild**: Score 0.0-0.35
- **Moderate**: Score 0.35-0.7
- **Strong**: Score >0.7

### 4. **Color Correction Filter** 🎨
Located in `content/injectFilter.js`, applies SVG color matrices:

**Correction Matrices** (using LERP - Linear Interpolation):
```
Protan: [0.567, 0.433, 0, 0, 0, ...]  (Red perception simulation)
Deutan: [0.625, 0.375, 0, 0, 0, ...]  (Green perception simulation)
Tritan: [0.95, 0.05, 0, 0, 0, ...]    (Blue perception simulation)
```

**How It Works:**
1. Obtains severity score from test results (0-1)
2. Interpolates between identity matrix (normal vision) and full correction matrix
3. Applies as SVG feColorMatrix filter globally to page
4. User can override severity with manual slider (25%-100%)

**Formula:**
```
Corrected_Matrix = Identity × (1 - severity) + TargetMatrix × severity
```

---

## Architecture

### **Data Flow**

```
User Opens Popup
    ↓
[popup.js] Loads ishihara.json + farnsworth.json
    ↓
[TestEngine] Orchestrates question sequence
    ↓
User answers tests
    ↓
[CVDClassifier] Analyzes patterns → Detects CVD type
    ↓
[SeverityModel] Calculates deficiency strength
    ↓
Results saved to Chrome Storage
    ↓
[injectFilter.js] Monitors storage → Applies correction matrix
    ↓
Web pages display with color correction
```

### **File Structure**

| File | Purpose |
|------|---------|
| `manifest.json` | Extension metadata, permissions, content scripts |
| `popup/popup.js` | Main UI, test control, settings display |
| `popup/popup.html` | Popup UI template |
| `tests/diagnostic.js` | Full-screen test window logic |
| `tests/diagnostic.html` | Full-screen test template |
| `tests/testEngine.js` | Core test orchestration |
| `tests/ishihara.json` | 28 Ishihara plate definitions |
| `tests/farnsworth.json` | 16 Farnsworth cap definitions |
| `ai/classifier.js` | CVD type detection algorithm |
| `ai/severityModel.js` | Severity scoring |
| `content/injectFilter.js` | DOM filter injection & control |
| `filters/adaptiveFilter.js` | (Optional advanced filtering) |

---

## How to Use

### **For Users:**

1. **Click Extension Icon** → Popup appears
2. **Run Diagnostic** → Full-screen test window opens
3. **Take Tests:**
   - Answer Ishihara: Type number you see (or leave blank)
   - Answer Farnsworth: Type cap ID of next color
4. **View Results** → Severity & type displayed
5. **Apply Correction** → Check "Enable" to see color-corrected web pages
6. **Adjust Strength** → Slider fine-tunes correction intensity

### **For Developers:**

**To add a new plate to Ishihara:**
```json
{
  "id": 13,
  "category": "Red-Green",
  "name": "Plate 13",
  "expected": "74",
  "confusionMapping": {
    "Protan": "21",
    "Deutan": "21"
  },
  "image": "assets/plates/Ishihara_13.jpg"
}
```

**To modify correction strength:**
Edit `injectFilter.js`, change matrix values:
```javascript
Protan: [0.567, 0.433, 0, 0, 0, ...]  // Adjust red weighting
```

---

## Issues Fixed

### **Issue 1: Missing Category Field in Farnsworth Data** 🐛
**File:** `tests/farnsworth.json`
**Problem:** Cap 15 (ID 16) was missing `"category": "Farnsworth"` field
**Impact:** Test engine's plate filtering broke, couldn't identify Farnsworth responses
**Fix:** Added missing category field to final entry

### **Issue 2: Inconsistent Category Names in Ishihara** 🐛
**File:** `tests/ishihara.json`
**Problem:** Plates 9-12 used `"category": "Red-Green-Diff"` instead of `"Red-Green"`
**Impact:** Severity model couldn't categorize these plates, skipped them during evaluation
**Original Code:**
```javascript
getCategory(type) {
  if (type === 'Protan' || type === 'Deutan') return 'Red-Green';
  // Red-Green-Diff doesn't match this!
}
```
**Fix:** Replaced all "Red-Green-Diff" with "Red-Green"

### **Issue 3: No Error Handling in JSON Fetch** 🐛
**Files:** `tests/diagnostic.js`, `popup/popup.js`
**Problem:** Silent failures when JSON files failed to load
**Impact:** Tests would hang at "Loading..." forever with no error message
**Fix:** Added try-catch blocks with detailed error logging:
```javascript
try {
  const res = await fetch(chrome.runtime.getURL('tests/ishihara.json'));
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const data = await res.json();
} catch (error) {
  console.error('[VisionAI] Failed to initialize:', error);
  // Show error to user
}
```

### **Issue 4: Unsafe Array Operations in Classifier** 🐛
**File:** `ai/classifier.js`
**Problem:** Could call `.expected` on undefined plate object
**Impact:** Classification crashes on malformed data
**Fix:** Check if plate exists before accessing properties:
```javascript
const p = plates.find(pl => pl.id === r.plateId);
return p && r.answer !== p.expected;  // Safe check
```

### **Issue 5: Missing Data Validation in Severity Model** 🐛
**File:** `ai/severityModel.js`
**Problem:** Division by zero if no relevant responses
**Impact:** NaN or Infinity in severity calculations
**Fix:** Added validation and null checks:
```javascript
if (!plates || !responses || responses.length === 0) {
  return { score: 0, label: 'Unknown' };
}
```

---

## Testing & Debugging

### **Check Console Logs** (F12 → Console)
```javascript
[VisionAI] Loaded 44 test plates (28 Ishihara, 16 Farnsworth)
[VisionAI] Classification result: type=Protan, confidence=0.92, misses=5/28
[VisionAI] Severity calculation for Protan: score=0.65, label=Moderate
```

### **Test Data Integrity**
- Ishihara JSON: 28 plates with valid categories
- Farnsworth JSON: 16 caps all with "Farnsworth" category
- All plates have: `id`, `category`, `expected`, `image`/`color`

### **Browser DevTools Checks**
1. **Network Tab**: Verify `ishihara.json` and `farnsworth.json` load successfully
2. **Storage Tab**: Check `cvdSettings` in Chrome local storage
3. **Console**: Look for `[VisionAI]` log messages

---

## CVD Types Reference

| Type | Red-Green | Blue-Yellow | Prevalence |
|------|-----------|-------------|-----------|
| **Protan** | Red perception reduced | Normal | 1% (mostly male) |
| **Deutan** | Green perception reduced | Normal | 1.1% (mostly male) |
| **Tritan** | Normal | Blue-Yellow reversed | 0.001% |
| **Achromatopsia** | Complete grayscale | Complete grayscale | 0.01% |

---

## Future Improvements

1. **Multi-language support** for test instructions
2. **Customize Ishihara plates** with user-uploaded images
3. **Web-accessible API** for website developers to integrate diagnostics
4. **Refinement of D-15 axis mapping** for more accurate Tritan detection
5. **Browser compatibility** beyond Chrome (Firefox, Edge)

---

## Disclaimer ⚠️

This extension is an **educational tool and visual aid only**. It is **NOT** a medical device and should not be used for medical diagnosis. For professional color vision testing, please consult an ophthalmologist or optometrist.

---

**Version:** 1.0  
**Last Updated:** March 2026  
**Status:** Fixed (Diagnostic System fully operational)
                                                    