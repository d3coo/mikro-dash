import type { PageServerLoad, Actions } from './$types';
import { getMikroTikClient } from '$lib/server/services/settings';
import { fail } from '@sveltejs/kit';
import { readdir } from 'fs/promises';

const HOTSPOT_FILES = ['login.html', 'logout.html', 'status.html', 'redirect.html', 'error.html'];
const LOCAL_HOTSPOT_DIR = 'static/hotspot';

interface HotspotFile {
  name: string;
  size: string;
  exists: boolean;
  hasBackup: boolean;
}

interface CertificateInfo {
  id: string;
  name: string;
  commonName: string;
  expiresAfter?: string;
  status?: string;
}

export const load: PageServerLoad = async () => {
  let routerConnected = false;
  let routerFiles: HotspotFile[] = [];
  let localFiles: string[] = [];
  let profiles: Array<{
    id: string;
    name: string;
    htmlDirectory: string;
    sslCertificate?: string;
    loginBy?: string;
    httpsRedirect?: string;
  }> = [];
  let currentDirectory = 'hotspot';
  let allRouterFiles: Array<{ name: string; type: string; size: string }> = [];
  let certificates: CertificateInfo[] = [];
  let routerVersion = '';

  try {
    const client = await getMikroTikClient();
    const resources = await client.getSystemResources();
    routerConnected = true;
    routerVersion = resources.version;

    // Get files from router
    const allFiles = await client.getFiles();

    // Store all files for debugging
    allRouterFiles = allFiles.map(f => ({
      name: f.name,
      type: f.type,
      size: f.size
    }));

    // Get hotspot server profiles
    const serverProfiles = await client.getHotspotServerProfiles();
    profiles = serverProfiles.map(p => ({
      id: p['.id'],
      name: p.name,
      htmlDirectory: p['html-directory'],
      sslCertificate: p['ssl-certificate'],
      loginBy: p['login-by'],
      httpsRedirect: p['https-redirect']
    }));

    // Find current html-directory from first profile
    if (profiles.length > 0) {
      currentDirectory = profiles[0].htmlDirectory;
    }

    // Get SSL certificates
    try {
      const certs = await client.getCertificates();
      certificates = certs.map(c => ({
        id: c['.id'],
        name: c.name,
        commonName: c['common-name'],
        expiresAfter: c['expires-after'],
        status: c.status
      }));
    } catch {
      // Certificates endpoint might not be available
      certificates = [];
    }

    // Check each required hotspot file
    // MikroTik stores files with "flash/" prefix, e.g., "flash/hotspot/login.html"
    routerFiles = HOTSPOT_FILES.map(fileName => {
      // Try multiple path formats
      const paths = [
        `flash/${currentDirectory}/${fileName}`,
        `${currentDirectory}/${fileName}`,
        fileName
      ];
      const backupPaths = [
        `flash/${currentDirectory}-backup/${fileName}`,
        `${currentDirectory}-backup/${fileName}`
      ];

      const file = allFiles.find(f => paths.some(p => f.name === p));
      const backup = allFiles.find(f => backupPaths.some(p => f.name === p));

      return {
        name: fileName,
        size: file?.size || '0',
        exists: !!file,
        hasBackup: !!backup
      };
    });

  } catch (error) {
    console.error('Failed to connect to router:', error);
  }

  // Get local hotspot files
  try {
    const files = await readdir(LOCAL_HOTSPOT_DIR);
    localFiles = files.filter(f => f.endsWith('.html'));
  } catch {
    localFiles = [];
  }

  return {
    routerConnected,
    routerFiles,
    localFiles,
    profiles,
    currentDirectory,
    allRouterFiles,
    certificates,
    routerVersion
  };
};

export const actions: Actions = {
  // Switch to backup directory (use existing static/hotspot as backup)
  backup: async () => {
    try {
      const client = await getMikroTikClient();
      const profiles = await client.getHotspotServerProfiles();

      if (profiles.length === 0) {
        return fail(400, { error: 'لا يوجد بروفايل هوتسبوت' });
      }

      // Check if static/hotspot exists (original backup)
      const allFiles = await client.getFiles();
      const backupExists = allFiles.some(f => f.name === 'flash/static/hotspot/login.html');

      if (!backupExists) {
        return fail(400, { error: 'النسخة الاحتياطية غير موجودة في flash/static/hotspot' });
      }

      // Switch profile to use static/hotspot
      await client.updateHotspotServerProfile(profiles[0]['.id'], 'static/hotspot');

      return { success: true, message: 'تم التبديل إلى النسخة الاحتياطية (static/hotspot)' };
    } catch (error) {
      console.error('Backup error:', error);
      return fail(500, { error: 'فشل في التبديل' });
    }
  },

  // Restore means switch back to original hotspot directory
  restore: async () => {
    try {
      const client = await getMikroTikClient();
      const profiles = await client.getHotspotServerProfiles();

      if (profiles.length === 0) {
        return fail(400, { error: 'لا يوجد بروفايل هوتسبوت' });
      }

      // Switch profile back to hotspot
      await client.updateHotspotServerProfile(profiles[0]['.id'], 'hotspot');

      return { success: true, message: 'تم الاستعادة إلى المجلد الأصلي (hotspot)' };
    } catch (error) {
      console.error('Restore error:', error);
      return fail(500, { error: 'فشل في الاستعادة' });
    }
  },

  // Upload custom hotspot files - generate FTP commands
  upload: async () => {
    try {
      const client = await getMikroTikClient();
      const host = client.getHost();
      const creds = client.getCredentials();

      // Since MikroTik REST API doesn't support file upload well,
      // we'll provide FTP instructions
      const ftpCommands = `
# Upload via FTP (run in terminal):
cd ${LOCAL_HOTSPOT_DIR}

# Windows PowerShell:
$ftp = New-Object System.Net.WebClient
$ftp.Credentials = New-Object System.Net.NetworkCredential("${creds.username}", "${creds.password}")
${HOTSPOT_FILES.map(f => `$ftp.UploadFile("ftp://${host}/hotspot/${f}", "${f}")`).join('\n')}

# Or use WinSCP/FileZilla:
# Host: ${host}
# Username: ${creds.username}
# Protocol: FTP
# Upload files to: /hotspot/
      `.trim();

      return {
        success: true,
        message: 'لا يمكن رفع الملفات عبر REST API. استخدم FTP أو WinBox',
        ftpCommands,
        ftpInfo: {
          host,
          username: creds.username,
          remotePath: '/hotspot/',
          localPath: LOCAL_HOTSPOT_DIR
        }
      };
    } catch (error) {
      console.error('Upload error:', error);
      return fail(500, { error: 'فشل في تجهيز معلومات الرفع' });
    }
  },

  // Switch hotspot directory
  switchDirectory: async ({ request }) => {
    const formData = await request.formData();
    const directory = formData.get('directory') as string;
    const profileId = formData.get('profileId') as string;

    if (!directory || !profileId) {
      return fail(400, { error: 'البيانات غير صحيحة' });
    }

    try {
      const client = await getMikroTikClient();
      await client.updateHotspotServerProfile(profileId, directory);

      return { success: true, message: `تم تغيير المجلد إلى ${directory}` };
    } catch (error) {
      console.error('Switch directory error:', error);
      return fail(500, { error: 'فشل في تغيير المجلد' });
    }
  },

  // Create self-signed SSL certificate
  createCertificate: async ({ request }) => {
    const formData = await request.formData();
    const name = formData.get('name') as string || 'hotspot-cert';
    const commonName = formData.get('commonName') as string || 'hotspot';

    try {
      const client = await getMikroTikClient();

      // Create the certificate
      await client.createCertificate(name, commonName, 3650, 2048);

      // Sign it (self-signed)
      await client.signCertificate(name);

      return { success: true, message: `تم إنشاء شهادة SSL: ${name}` };
    } catch (error) {
      console.error('Create certificate error:', error);
      const errorMsg = error instanceof Error ? error.message : 'فشل في إنشاء الشهادة';
      return fail(500, { error: errorMsg });
    }
  },

  // Enable HTTPS on hotspot profile
  enableHttps: async ({ request }) => {
    const formData = await request.formData();
    const profileId = formData.get('profileId') as string;
    const certificateName = formData.get('certificate') as string;

    if (!profileId || !certificateName) {
      return fail(400, { error: 'البيانات غير صحيحة' });
    }

    try {
      const client = await getMikroTikClient();

      // Update hotspot profile with SSL certificate
      await client.updateHotspotProfileSSL(profileId, {
        sslCertificate: certificateName,
        loginBy: 'http-chap,https'
      });

      return { success: true, message: 'تم تفعيل HTTPS على البوابة' };
    } catch (error) {
      console.error('Enable HTTPS error:', error);
      const errorMsg = error instanceof Error ? error.message : 'فشل في تفعيل HTTPS';
      return fail(500, { error: errorMsg });
    }
  },

  // Disable HTTPS on hotspot profile
  disableHttps: async ({ request }) => {
    const formData = await request.formData();
    const profileId = formData.get('profileId') as string;

    if (!profileId) {
      return fail(400, { error: 'البيانات غير صحيحة' });
    }

    try {
      const client = await getMikroTikClient();

      // Remove SSL certificate from profile
      await client.updateHotspotProfileSSL(profileId, {
        sslCertificate: '',
        loginBy: 'http-chap'
      });

      return { success: true, message: 'تم تعطيل HTTPS' };
    } catch (error) {
      console.error('Disable HTTPS error:', error);
      return fail(500, { error: 'فشل في تعطيل HTTPS' });
    }
  },

  // Delete certificate
  deleteCertificate: async ({ request }) => {
    const formData = await request.formData();
    const certId = formData.get('certId') as string;

    if (!certId) {
      return fail(400, { error: 'البيانات غير صحيحة' });
    }

    try {
      const client = await getMikroTikClient();
      await client.deleteCertificate(certId);

      return { success: true, message: 'تم حذف الشهادة' };
    } catch (error) {
      console.error('Delete certificate error:', error);
      return fail(500, { error: 'فشل في حذف الشهادة' });
    }
  }
};
