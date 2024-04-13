/*require('dotenv').config();
const mysql = require('mysql');
const fs = require('fs');
const { MongoClient } = require('mongodb');

// Logging function
function logToFile(serviceName, operationType, status, message) {
  const now = new Date();
  const timestamp = now.toISOString();
  const logMessage = `${timestamp}\t${serviceName}\t${operationType}\t${status}\t${message}\n`;
  fs.appendFileSync('M5.log', logMessage, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  });
}

// MongoDB setup
const mongoClient = new MongoClient(process.env.MONGO_URI);
let deviceCollection;

async function connectMongoDB() {
  try {
    await mongoClient.connect();
    logToFile("Mon1", "database", "success", "Connected to MongoDB.");
    const db = mongoClient.db(process.env.MONGO_DB_NAME);
    deviceCollection = db.collection(process.env.MONGO_COLLECTION_NAME);
  } catch (error) {
    logToFile("Mon1", "database", "error", `MongoDB connection error: ${error.message}`);
    process.exit(1); // Exit if cannot connect to MongoDB
  }
}

// MySQL database setup
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
});

db.connect(err => {
  if (err) {
    logToFile("Mon1", "read", "error", `Error connecting to MySQL: ${err.stack}`);
    return;
  }
  logToFile("Mon1", "read", "success", "Connected to MySQL database.");
});

// Function to perform MySQL queries and return a promise
function query(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

// Function to generate a request serial number
function generateRequestSerial(currentCount) {
  const date = new Date();
  const dateString = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
  return `${dateString}-${currentCount.toString().padStart(6, '0')}`;
}

function calculateNewTime() {
  let now = new Date();
  now.setMinutes(now.getMinutes() - 14);
  let hours = now.getHours().toString().padStart(2, '0');
  let minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
// Fetch device metadata, device and plant details from MySQL and insert into MongoDB
async function fetchAndInsertDeviceData() {
  let requestSerialCounter = 1; // Initialize the request serial counter

  try {
    const metadataList = await query('SELECT EndpointApi1, DeviceTypeID, DeviceMake, Api1Body, HeaderforApi1 FROM DeviceMetadataMaster');
    for (const metadata of metadataList) {
      const deviceList = await query('SELECT DeviceSerialNumber, ModelNo, PlantID, DeviceType, Capacity, Phase, DeviceUUID, modelno, API_Key, Creation_Date_time FROM DeviceMaster WHERE DeviceTypeID = ?', [metadata.DeviceTypeID]);
      for (const device of deviceList) {
        const plant = await query('SELECT PlantID, IntegratorID, API_Key, PlantName, Latitude, Longitude FROM PlantMaster WHERE PlantID = ?', [device.PlantID]);
        const timeVariable = calculateNewTime();
        
        
        const document = {
          ...metadata,
          ...device,
          plant: plant[0], // Assuming there is at least one plant record
          //requestSerialNumber: requestSerialNumber,
          Last_Update_Date: device.Creation_Date_time, // Convert to UTC and extract YYYY-MM-DD
          timeStamp:timeVariable,
          metadata: {
            integratorId: plant[0].IntegratorID,
            plantName: plant[0].PlantName,
            latitude: plant[0].Latitude,
            longitude: plant[0].Longitude,
            PlantID: plant[0].PlantID,
            deviceUUID: device.DeviceUUID, // Use the DeviceUUID from the query
            deviceMake: metadata.DeviceMake,
            deviceType: device.DeviceType,
            capacity: device.Capacity,
            phase: device.Phase,
            modelno: device.modelno,
            API_Key: device.API_Key // Use the API_Key from the deviceList result
          }
        };
        
        
        await deviceCollection.insertOne(document);
        logToFile("Mon1", "write", "success", `Document inserted to MongoDB: ${JSON.stringify(document)}`);
      }
    }
  } catch (error) {
    logToFile("Mon1", "database", "error", `Error during data fetch/insert: ${error.message}`);
  } finally {
    // Close the MySQL connection
    db.end();
    // Close the MongoDB connection when all operations are done
    await mongoClient.close();
  }
}

// Start the process
connectMongoDB().then(() => {
  fetchAndInsertDeviceData();
});*/
require('dotenv').config();
const mysql = require('mysql');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const cron = require('node-cron');

// Logging function
function logToFile(serviceName, operationType, status, message) {
  const now = new Date();
  const timestamp = now.toISOString();
  const logMessage = `${timestamp}\t${serviceName}\t${operationType}\t${status}\t${message}\n`;
  fs.appendFileSync('M5.log', logMessage, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  });
}

// MongoDB setup
const mongoClient = new MongoClient(process.env.MONGO_URI);
let deviceCollection;
let greatestCreationDate = new Date(0); // Initialize with a minimum date

async function connectMongoDB() {
  try {
    await mongoClient.connect();
    logToFile("Mon1", "database", "success", "Connected to MongoDB.");
    const db = mongoClient.db(process.env.MONGO_DB_NAME);
    deviceCollection = db.collection(process.env.MONGO_COLLECTION_NAME);
  } catch (error) {
    logToFile("Mon1", "database", "error", `MongoDB connection error: ${error.message}`);
    process.exit(1); // Exit if cannot connect to MongoDB
  }
}

// MySQL database setup
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
});

db.connect(err => {
  if (err) {
    logToFile("Mon1", "read", "error", `Error connecting to MySQL: ${err.stack}`);
    return;
  }
  logToFile("Mon1", "read", "success", "Connected to MySQL database.");
});

// Function to perform MySQL queries and return a promise
function query(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

// Function to generate a request serial number
function generateRequestSerial(currentCount) {
  const date = new Date();
  const dateString = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
  return `${dateString}-${currentCount.toString().padStart(6, '0')}`;
}

function calculateNewTime() {
  let now = new Date();
  now.setMinutes(now.getMinutes() - 14);
  let hours = now.getHours().toString().padStart(2, '0');
  let minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

async function fetchAndInsertGreaterDeviceData() {
  logToFile("Fetching and inserting greater device data...");
  try {
    let maxCreationDate = greatestCreationDate; // Start with the current greatestCreationDate
    const metadataList = await query('SELECT EndpointApi1, DeviceTypeID, DeviceMake, Api1Body, HeaderforApi1 FROM DeviceMetadataMaster');
    for (const metadata of metadataList) {
      const deviceList = await query('SELECT DeviceSerialNumber, ModelNo, PlantID, DeviceType, Capacity, Phase, DeviceUUID, modelno, API_Key, Creation_Date_time FROM DeviceMaster WHERE DeviceTypeID = ? AND Creation_Date_time > ?', [metadata.DeviceTypeID, greatestCreationDate]);
      for (const device of deviceList) {
        const plant = await query('SELECT PlantID, IntegratorID, API_Key, PlantName, Latitude, Longitude FROM PlantMaster WHERE PlantID = ?', [device.PlantID]);
        
        const document = {
          ...metadata,
          ...device,
          plant: plant[0], // Assuming there is at least one plant record
          requestTime: calculateNewTime(),
          metadata: {
            integratorId: plant[0].IntegratorID,
            plantName: plant[0].PlantName,
            latitude: plant[0].Latitude,
            longitude: plant[0].Longitude,
            PlantID: plant[0].PlantID,
            deviceUUID: device.DeviceUUID, // Use the DeviceUUID from the query
            deviceMake: metadata.DeviceMake,
            deviceType: device.DeviceType,
            capacity: device.Capacity,
            phase: device.Phase,
            modelno: device.modelno,
            API_Key: device.API_Key // Use the API_Key from the deviceList result
          }
        };

        await deviceCollection.insertOne(document);
        logToFile("Mon1", "write", "success", `Document inserted to MongoDB: ${JSON.stringify(document)}`);
        
        // Update maxCreationDate if the current Creation_Date_time is greater
        if (device.Creation_Date_time > maxCreationDate) {
          maxCreationDate = device.Creation_Date_time;
        }
      }
    }
    // Update greatestCreationDate after processing all documents
    greatestCreationDate = maxCreationDate;
  } catch (error) {
    console.error("Error during greater data fetch/insert:", error);
    logToFile("Mon1", "database", "error", `Error during greater data fetch/insert: ${error.message}`);
  }
}

async function latestCreationDate() {
  try {
    const latestDevices = await query('SELECT DeviceSerialNumber, ModelNo, PlantID, DeviceType, Capacity, Phase, DeviceUUID, modelno, API_Key, Creation_Date_time FROM DeviceMaster WHERE Creation_Date_time > ?', [greatestCreationDate]);
    if (latestDevices.length > 0) {
      await fetchAndInsertGreaterDeviceData();
    } else {
      logToFile("Mon1", "latestCreationDate", "info", "No new devices found.");
    }
  } catch (error) {
    console.error("Error during latestCreationDate:", error);
    logToFile("Mon1", "latestCreationDate", "error", `Error during latestCreationDate: ${error.message}`);
  }
}

// Start the process
connectMongoDB().then(() => {
  fetchAndInsertGreaterDeviceData();
});

// Schedule the function to run every 3 minutes
cron.schedule('*/3 * * * *', () => {
  latestCreationDate();
});

// Listen on a port to keep the script alive
const PORT = process.env.PORT || 3000;
const http = require('http');

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('MON-1.js is running and listening.');
});

server.listen(PORT, () => {
  console.log(`MON-1.js is running and listening on port ${PORT}`);
});
