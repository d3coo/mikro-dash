/**
 * Upload the new status.html to the router
 */

import { readFileSync } from 'fs';

const ROUTER_HOST = '192.168.1.109';
const ROUTER_USER = 'admin';
const ROUTER_PASS = 'need4speed';

const baseUrl = `http://${ROUTER_HOST}/rest`;
const authHeader = 'Basic ' + Buffer.from(`${ROUTER_USER}:${ROUTER_PASS}`).toString('base64');

async function request<T>(endpoint: string, method: 'GET' | 'POST' | 'PUT' = 'GET', body?: any): Promise<T> {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MikroTik API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function main() {
  console.log('=== UPLOADING NEW STATUS.HTML ===\n');

  // Read the new status.html
  const statusHtml = readFileSync('static/hotspot/status-new.html', 'utf-8');
  console.log(`Read status-new.html (${statusHtml.length} bytes)\n`);

  // Upload to router
  console.log('Uploading to flash/hotspot/status.html...\n');

  try {
    await request('/file/set', 'POST', {
      '.id': 'flash/hotspot/status.html',
      contents: statusHtml
    });
    console.log('✓ Successfully uploaded status.html to router!\n');
  } catch (e: any) {
    console.log('✗ Upload failed:', e.message);
    console.log('\n--- MANUAL UPLOAD REQUIRED ---\n');
    console.log('The REST API cannot update the file directly.');
    console.log('Please upload manually via FTP or WinBox:\n');
    console.log(`1. Open WinBox and connect to ${ROUTER_HOST}`);
    console.log('2. Go to Files → flash → hotspot');
    console.log('3. Drag and drop status-new.html (rename to status.html)');
    console.log('\nOr use FTP:');
    console.log(`   Host: ${ROUTER_HOST}`);
    console.log(`   User: ${ROUTER_USER}`);
    console.log(`   Pass: ${ROUTER_PASS}`);
    console.log('   Path: /flash/hotspot/status.html');
  }

  console.log('\n--- CHANGES IN NEW STATUS.HTML ---\n');
  console.log('1. Fixed "Continue" button → now goes to Google.com');
  console.log('2. Simplified data display (shows bytes-in-nice correctly)');
  console.log('3. Added JavaScript to handle remaining bytes display');
  console.log('4. Shows session-time-left only if it exists');
  console.log('5. Cleaner, more compact design');
  console.log('6. Fixed Arabic RTL layout');
}

main().catch(console.error);
