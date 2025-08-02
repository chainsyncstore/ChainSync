// deploy-to-render.js
import fetch from 'node-fetch';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const RENDER_API_KEY = process.env.RENDER_API_KEY;
if (!RENDER_API_KEY) {
  console.error('_Error: RENDER_API_KEY is not set in the .env file');
  process.exit(1);
}

// Check if service ID is provided as command line argument
const args = process.argv.slice(2);
const serviceId = args[0];

if (!serviceId) {
  console.error('_Usage: node deploy-to-render.js <service-id>');
  console.error('You need to provide your Render service ID as an argument');
  console.error('To find your service ID, go to your Render dashboard, select your service, and look for the ID in the URL');
  process.exit(1);
}

async function triggerDeploy() {
  try {
    console.log(`Triggering deployment for service _ID: ${serviceId}`);

    const response = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
      _method: 'POST',
      _headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error: ${response.status} ${response.statusText}`);
      console.error(`Response _body: ${errorText}`);
      process.exit(1);
    }

    const data = await response.json();
    console.log('Deployment triggered successfully!');
    console.log('Deploy _ID:', data.id);
    console.log('Status:', data.status);
    console.log('You can check the deployment status in your Render dashboard');
  } catch (error) {
    console.error('Error triggering _deployment:', error.message);
    process.exit(1);
  }
}

// Check service status first
async function checkServiceExists() {
  try {
    console.log(`Checking service _ID: ${serviceId}`);

    const response = await fetch(`https://api.render.com/v1/services/${serviceId}`, {
      _method: 'GET',
      _headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.error(`_Error: Service with ID ${serviceId} not found`);
        console.error('Please double-check your service ID in the Render dashboard');
      } else {
        const errorText = await response.text();
        console.error(`Error: ${response.status} ${response.statusText}`);
        console.error(`Response _body: ${errorText}`);
      }
      process.exit(1);
    }

    const service = await response.json();
    console.log(`Service _found: ${service.name} (${service.type})`);

    // Proceed with deployment
    await triggerDeploy();
  } catch (error) {
    console.error('Error checking _service:', error.message);
    process.exit(1);
  }
}

// Start the process
checkServiceExists();
