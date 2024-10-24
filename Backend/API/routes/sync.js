const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config(); // Load environment variables from .env

// A POST route to handle make and plantSerialNumber and make API call to SolarEdge
router.post('/sync', async (req, res) => {
    const { make, plantSerialNumber } = req.body; // Extract make and plantSerialNumber from request body

    if (!make || !plantSerialNumber) {
        return res.status(400).json({ error: 'Both make and plantSerialNumber are required' });
    }

    // Check if the make is Solaredge
    if (make.toLowerCase() === 'solaredge') {
        const apiKey = process.env.SOLAREDGE_API_KEY;

        // URL for SolarEdge API (using the provided plantSerialNumber)
        const solarEdgeUrl = `https://monitoringapi.solaredge.com/equipment/${plantSerialNumber}/list?api_key=${apiKey}`;

        try {
            // Make the API call to SolarEdge
            const response = await axios.get(solarEdgeUrl);

            // If the API call is successful, send back the response data
            res.json({
                message: 'API call successful',
                data: response.data
            });
        } catch (error) {
            if (error.response) {
                // Log only the status code and return a clean message
                console.error('Error status code:', error.response.status);
                res.status(error.response.status).json({ error: `Failed to fetch data from SolarEdge API: Status Code ${error.response.status}` });
            } else {
                console.error('Error:', error.message);
                res.status(500).json({ error: 'An unknown error occurred' });
            }
        }
    } else {
        // If the make is not Solaredge, return an error response
        res.status(400).json({ error: 'Unsupported device make' });
    }
});

module.exports = router;
