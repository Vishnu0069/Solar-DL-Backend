require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const { Container } = require('rhea-promise');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const app = express();
const port = 3000;

app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);

async function logToFile(serviceName, operationType, status, message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}\t${serviceName}\t${operationType}\t${status}\t${message}\n`;
    fs.appendFileSync('M5.log', logMessage);
}

async function sendMessageToQueue(queueName, messageData) {
    const container = new Container();
    try {
        const connection = await container.connect({
            host: process.env.ACTIVE_MQ_HOST,
            port: parseInt(process.env.ACTIVE_MQ_PORT, 10),
            username: process.env.ACTIVE_MQ_USERNAME,
            password: process.env.ACTIVE_MQ_PASSWORD,
            transport: 'tcp',
        });
        const sender = await connection.createSender(queueName);
        await sender.send({ body: JSON.stringify(messageData) });
        await logToFile("Mon2", "write", "success", `Message sent to ${queueName}: ${JSON.stringify(messageData)}`);
        await sender.close();
        await connection.close();
    } catch (error) {
        await logToFile("Mon2", "write", "error", `Failed to send message to queue: ${error.message}`);
    }
}

async function fetchAndProcessData() {
    await mongoClient.connect();
    const db = mongoClient.db(process.env.MONGO_DB_NAME);
    const collection = db.collection(process.env.MONGO_COLLECTION_NAME);
    const cursor = collection.find({});

    while (await cursor.hasNext()) {
        const document = await cursor.next();
        let constructedUrl = '', headers = {};
        const { DeviceMake, API_Key, EndpointApi1, DeviceSerialNumber, ModelNo } = document;

        switch (DeviceMake.toLowerCase()) {
          case 'solaredge':
            // Adapted for MongoDB document structure
            const today = new Date().toISOString().split('T')[0]; // Gets today's date in YYYY-MM-DD format
            
            // Assuming `requestTime` is stored in the document, similar to `document.requestTime`
            // It looks like the error might be occurring because `document.requestTime` is not correctly formatted or missing
            // Make sure `document.requestTime` exists and is correctly formatted (HH:mm)
            const startTime = document.requestTime + ':00'; // Appends :00 to received time for seconds
            const formattedStartTime = `${today}%20${startTime}`; // Formats start time with %20 for space
            
            // Calculates and formats end time by adding 15 minutes to the start time
            const requestTimeDate = new Date(`${today}T${document.requestTime}:00`);
            requestTimeDate.setMinutes(requestTimeDate.getMinutes() + 15);
            let endTime = `${requestTimeDate.getHours().toString().padStart(2, '0')}:${requestTimeDate.getMinutes().toString().padStart(2, '0')}:00`;
            const formattedEndTime = `${today}%20${endTime}`;
            
            // Constructs the full URL with API key
            // Assuming `EndpointApi1`, `ModelNo`, `DeviceSerialNumber`, and `API_Key` are correctly extracted from the MongoDB document
            constructedUrl = `${document.EndpointApi1}/${document.ModelNo}/${document.DeviceSerialNumber}/data?startTime=${formattedStartTime}&endTime=${formattedEndTime}&api_key=${document.API_Key}`;
            break;
        
            case 'solis':
    // Assuming API_Key, HeaderforApi1, and Api1Body are available in the MongoDB document
    const apiId = document.API_Key;
    const contentMd5 = JSON.parse(document.HeaderforApi1)["Content-MD5"];
    const contentType = 'application/json';
    const currentDate = new Date().toUTCString();
    const requestBody = JSON.parse(document.Api1Body);

    // Use the API endpoint from environment variable or document if it's stored there
    const apiEndpoint = process.env.API_URL;
    const stringToSign = `POST\n${contentMd5}\n${contentType}\n${currentDate}\n${apiEndpoint}`;
    
    const secretKey = process.env.SECRET_KEY;
    const signature = crypto.createHmac('sha1', secretKey).update(stringToSign).digest('base64');

    // Constructed URL using data from the MongoDB document
    constructedUrl = `${document.EndpointApi1}`;

    // Populate the headers object with necessary details for Solis, extracted from the document
    headers = {
        "Content-MD5": contentMd5,
        "Content-Type": contentType,
        "Date": currentDate,
        "Signature": signature,
        "Api_key": apiId,
        "body": requestBody // Ensure that requestBody is in the correct format expected by the endpoint
    };

    // Log the constructed URL and headers for debugging
    //console.log('Constructed URL for Solis:', constructedUrl, 'Headers:', headers, 'Request Body:', JSON.stringify(requestBody));
    break;

            case 'solarman':
                // Replicate Solarman URL construction logic
                constructedUrl = `${EndpointApi1}?api_key=${API_Key}`;
                break;
            default:
                console.log(`DeviceMake ${DeviceMake} not recognized.`);
                continue;
        }

        const messageData = {
            deviceMake: DeviceMake,
            constructedUrl,
            headers,
            // Ensure all necessary metadata is included as in the old Mon2
            metadata: {
                
            }
        };

        await sendMessageToQueue('/request', messageData);
    }
    await mongoClient.close();
}

function generateSolisHeaders(API_Key, document) {
    // Implement the Solis headers generation logic exactly as in the old Mon2
}

// Start processing
fetchAndProcessData().catch(console.error);


