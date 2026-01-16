/**
 * Fetch and display current status.html content
 */

const ROUTER_HOST = '192.168.1.109';
const ROUTER_USER = 'admin';
const ROUTER_PASS = 'need4speed';

const baseUrl = `http://${ROUTER_HOST}/rest`;
const authHeader = 'Basic ' + Buffer.from(`${ROUTER_USER}:${ROUTER_PASS}`).toString('base64');

async function getFileContent(name: string): Promise<string> {
  const response = await fetch(`${baseUrl}/file/${encodeURIComponent(name)}`, {
    headers: { 'Authorization': authHeader }
  });
  if (!response.ok) {
    throw new Error(`Failed to get file: ${response.status}`);
  }
  const data = await response.json();
  return data.contents || '';
}

async function main() {
  console.log('=== CURRENT STATUS.HTML ===\n');

  try {
    const content = await getFileContent('flash/hotspot/status.html');
    console.log(content);
  } catch (e: any) {
    console.log('Error fetching status.html:', e.message);
  }
}

main().catch(console.error);
