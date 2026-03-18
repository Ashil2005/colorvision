# Test Update Guide

## What's New ✨

### 1. **Separate Test Selection**
Users can now choose which test to run:
- **Ishihara Test Only** (28 color dot plates) - ~5 minutes  
- **Farnsworth D-15 Only** (16 color cap arrangement) - ~3 minutes
- **Both Tests** (Full diagnostic) - ~8-10 minutes

### 2. **Multiple Entry Points**

#### From Popup:
```
Click Extension Icon → Three Quick Test Buttons:
├─ Ishihara Test (28 plates)
├─ Farnsworth D-15 (16 caps) 
└─ Both Tests (Full Diagnostic)

Or click "Open Full Screen Test" to get the selection screen
```

#### Full Screen Window:
```
Click "Full Screen Test" → Selection Screen Appears:
├─ Start Ishihara Test
├─ Start Farnsworth Test
└─ Run Both Tests
```

### 3. **Fixed Image Loading Issues** 🖼️

**Problem:** First Ishihara image wasn't displaying
**Root Cause:** File naming mismatch
- JSON referenced: `Ishihara_01.jpg`
- Actual file: `ishihara_1.jpg` (lowercase)

**Solution:** 
- ✅ Fixed JSON paths to match actual file names
- ✅ Added error messages showing which images fail to load
- ✅ Added console logging for debugging

### 4. **Error Handling**

If an image fails to load, users will see:
```
❌ Image not found
assets/plates/Ishihara_XX.jpg

Please verify the image file exists.
```

This helps identify missing images and path issues.

---

## Technical Changes

### Updated Files:
- `tests/diagnostic.html` - Added test selection screen with UI
- `tests/diagnostic.js` - Refactored to handle test selection + image error handling
- `popup/popup.html` - Added quick test selection buttons
- `popup/popup.js` - Added test type preference storage
- `tests/ishihara.json` - Fixed image paths for Plate 1

### New Features:
```javascript
// Session storage to pass test preference from popup to diagnostic
chrome.storage.session.set({ preferredTest: 'ishihara' })

// Auto-selection in diagnostic.html
chrome.storage.session.get(['preferredTest'], (result) => {
  if (result.preferredTest) {
    startSelectedTest(result.preferredTest);
  }
})

// Image error handling
img.onerror = () => {
  // Shows user which image failed + path
}
```

---

## Testing Checklist

- [ ] Click extension icon → see three test buttons
- [ ] Click "Ishihara Test" → should show Plate 1 immediately
- [ ] Click "Farnsworth D-15" → should show reference cap immediately  
- [ ] Click "Both Tests" → should show Plate 1
- [ ] Verify Plate 1 image displays (check for "❌ Image not found" error)
- [ ] Complete a test and verify results are saved
- [ ] Click "Full Screen Test" → should show selection screen
- [ ] Complete full-screen test → window auto-closes after 2 seconds

---

## File Structure
```
assets/plates/
├─ ishihara_1.jpg         ✅ Correct
├─ ishihara_2.jpg         ✅ Correct  
├─ ishihara_3.jpg         ✅ Correct
├─ ishihara_4.jpg         ✅ Correct
├─ ishihara_5.jpg         ✅ Correct
├─ ishihara_6.jpg         ✅ Correct
├─ ishihara_7.jpg         ✅ Correct
├─ ishihara_8.jpg         ✅ Correct
├─ ishihara_9.jpg         ✅ Correct
├─ Ishihara_02.jpg        ✅ Exists (double-digit)
├─ Ishihara_03.jpg        ✅ Exists 
├─ Ishihara_04.jpg        ✅ Exists
├─ Ishihara_05.jpg        ✅ Exists
├─ Ishihara_06.jpg        ✅ Exists
├─ Ishihara_07.jpg        ✅ Exists
├─ Ishihara_08.jpg        ✅ Exists
├─ Ishihara_09.jpg        ✅ Exists
├─ Ishihara_10.jpg        ✅ Exists
├─ Ishihara_11.jpg        ✅ Exists
├─ Ishihara_12.jpg        ✅ Exists
└─ ishihara_10.jpeg       (alternative format)
```

---

## Troubleshooting

**Q: Images still not showing?**
A: Check browser console (F12 → Console) for messages like:
```
[VisionAI] Loading image from: chrome-extension://xxx/assets/plates/ishihara_1.jpg
[VisionAI] Image loaded: assets/plates/ishihara_1.jpg
```

**Q: Tests not starting?**
A: Open DevTools (F12) and check console for errors. Look for:
```
[VisionAI] Loaded 28 Ishihara plates and 16 Farnsworth caps
[VisionAI] Auto-starting preferred test: ishihara
```

**Q: Session storage not working?**
A: Manifest.json includes "storage" permission which handles both local and session storage.

---

## Next Steps

If images still don't display:
1. Check actual filenames in `assets/plates/` folder
2. Update JSON paths to match exactly (case-sensitive)
3. Consider renaming files to standardize format:
   - Option A: All `ishihara_1.jpg` format
   - Option B: All `Ishihara_01.jpg` format (with padding)

Current recommendation: Use `ishihara_1.jpg` format since those files already exist.
