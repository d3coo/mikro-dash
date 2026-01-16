/**
 * Configure hotspot to redirect users to status page after login
 */

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
  console.log('=== CONFIGURING REDIRECT TO STATUS PAGE ===\n');

  // Check current redirect.html
  console.log('1. Checking current redirect.html...\n');

  try {
    const currentRedirect = await getFileContent('flash/hotspot/redirect.html');
    console.log('Current redirect.html (first 500 chars):');
    console.log('---');
    console.log(currentRedirect.slice(0, 500));
    console.log('---\n');
  } catch (e) {
    console.log('Could not read current redirect.html\n');
  }

  // The redirect.html file controls where users go after login
  // We need to modify it to redirect to /status instead of $(link-orig)

  const newRedirectHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0; url=/status">
  <title>تم تسجيل الدخول</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .success-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
    p {
      opacity: 0.8;
      margin-bottom: 1rem;
    }
    a {
      color: #4ade80;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">✓</div>
    <h1>تم تسجيل الدخول بنجاح!</h1>
    <p>جاري التحويل إلى صفحة الحالة...</p>
    <p><a href="/status">اضغط هنا إذا لم يتم التحويل تلقائياً</a></p>
  </div>
  <script>
    // Redirect to status page
    window.location.href = '/status';
  </script>
</body>
</html>`;

  console.log('2. New redirect.html will redirect to /status page');
  console.log('   - Shows success message in Arabic');
  console.log('   - Auto-redirects to status page');
  console.log('   - Manual link if redirect fails\n');

  // Upload the new redirect.html
  console.log('3. Uploading new redirect.html...\n');

  try {
    // Use file set to update existing file
    await request('/file/set', 'POST', {
      '.id': 'flash/hotspot/redirect.html',
      contents: newRedirectHtml
    });
    console.log('   ✓ Successfully updated redirect.html\n');
  } catch (e: any) {
    console.log('   ✗ Failed to update via set, trying different approach...\n');
    console.log('   Error:', e.message, '\n');

    // Alternative: provide instructions for manual update
    console.log('   MANUAL UPDATE REQUIRED:');
    console.log('   1. Open WinBox and connect to the router');
    console.log('   2. Go to Files');
    console.log('   3. Navigate to flash/hotspot/');
    console.log('   4. Edit redirect.html');
    console.log('   5. Replace content with the HTML below\n');
  }

  console.log('=== NEW REDIRECT.HTML CONTENT ===\n');
  console.log(newRedirectHtml);

  console.log('\n=== WHAT HAPPENS NOW ===\n');
  console.log('1. Customer connects to WiFi');
  console.log('2. Opens browser → sees login page');
  console.log('3. Enters voucher code');
  console.log('4. Sees "تم تسجيل الدخول بنجاح!" (Login successful)');
  console.log('5. Automatically redirected to status page');
  console.log('6. Status page shows: username, data used, data remaining, logout button');
}

main().catch(console.error);
