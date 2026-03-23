require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { analyzeScreeningResult } = require('./ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow requests from the browser extension
app.use(express.json()); // Parse JSON bodies

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'VisionAI Backend is running.' });
});

// AI analysis endpoint
app.post('/analyze-result', async (req, res) => {
    try {
        const resultData = req.body;

        // Basic validation of incoming data
        if (!resultData || !resultData.likelyType || resultData.confidence === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing screening data. Required fields: likelyType, confidence.'
            });
        }

        console.log(`[Backend] Received analysis request for type: ${resultData.likelyType}`);

        // Call the AI utility function
        const analysis = await analyzeScreeningResult(resultData);

        // Send back the safe AI-assisted summary
        res.json({
            success: true,
            analysis
        });

    } catch (error) {
        console.error('[Backend] Error processing request:', error);
        
        // Fallback response handled within ai.js mostly, but here is a safe catch-all
        res.status(500).json({
            success: false,
            error: 'Internal server error while analyzing results.',
            analysis: `Based on your responses, the screening indicates a ${req.body.likelyType || 'potential anomaly'} (Confidence: ${req.body.confidence || 'unknown'}%). This is a preliminary screening and not a medical diagnosis. Please consult an eye care professional for confirmation.`
        });
    }
});

app.listen(PORT, () => {
    console.log(`[Backend] Server is listening on port ${PORT}`);
});
