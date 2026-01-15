import type {
  MikroTikConfig,
  HotspotUser,
  ActiveSession,
  WirelessInterface,
  WirelessRegistration,
  SecurityProfile,
  SystemResource,
  MikroTikFile,
  HotspotServerProfile,
  Certificate,
  HotspotUserProfile,
  HotspotCookie,
  DhcpLease,
  WirelessAccessEntry
} from './types';

export class MikroTikClient {
  private baseUrl: string;
  private authHeader: string;
  private timeout: number;

  constructor(config: MikroTikConfig) {
    this.baseUrl = `http://${config.host}/rest`;
    this.authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`);
    this.timeout = 5000; // 5 second timeout
  }

  async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`MikroTik API error: ${response.status} - ${error}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // System
  async getSystemResources(): Promise<SystemResource> {
    return this.request<SystemResource>('/system/resource');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getSystemResources();
      return true;
    } catch {
      return false;
    }
  }

  // Hotspot Users
  async getHotspotUsers(): Promise<HotspotUser[]> {
    return this.request<HotspotUser[]>('/ip/hotspot/user');
  }

  async createHotspotUser(
    name: string,
    password: string,
    profile: string,
    options?: {
      limitBytes?: number;
      server?: string;
      comment?: string;
    }
  ): Promise<void> {
    const body: Record<string, unknown> = {
      name,
      password,
      profile
    };
    if (options?.limitBytes) {
      body['limit-bytes-total'] = options.limitBytes.toString();
    }
    if (options?.server) {
      body.server = options.server;
    }
    if (options?.comment) {
      body.comment = options.comment;
    }
    await this.request('/ip/hotspot/user/add', 'POST', body);
  }

  async deleteHotspotUser(id: string): Promise<void> {
    // MikroTik REST API requires using 'remove' endpoint with the .id
    await this.request('/ip/hotspot/user/remove', 'POST', {
      '.id': id
    });
  }

  // Active Sessions
  async getActiveSessions(): Promise<ActiveSession[]> {
    return this.request<ActiveSession[]>('/ip/hotspot/active');
  }

  async kickSession(id: string): Promise<void> {
    // MikroTik REST API requires using 'remove' endpoint with the .id
    // The ID format is like "*1" so we need to encode it properly
    await this.request('/ip/hotspot/active/remove', 'POST', {
      '.id': id
    });
  }

  // WiFi
  async getWirelessInterfaces(): Promise<WirelessInterface[]> {
    return this.request<WirelessInterface[]>('/interface/wireless');
  }

  async updateWirelessSSID(id: string, ssid: string): Promise<void> {
    await this.request(`/interface/wireless/${id}`, 'PATCH', { ssid });
  }

  async toggleWirelessInterface(id: string, disabled: boolean): Promise<void> {
    await this.request(`/interface/wireless/${id}`, 'PATCH', {
      disabled: disabled ? 'true' : 'false'
    });
  }

  async getSecurityProfiles(): Promise<SecurityProfile[]> {
    return this.request<SecurityProfile[]>('/interface/wireless/security-profiles');
  }

  async updateSecurityPassword(id: string, password: string): Promise<void> {
    await this.request(`/interface/wireless/security-profiles/${id}`, 'PATCH', {
      'wpa2-pre-shared-key': password
    });
  }

  // Wireless Registration Table (connected clients)
  async getWirelessRegistrations(): Promise<WirelessRegistration[]> {
    return this.request<WirelessRegistration[]>('/interface/wireless/registration-table');
  }

  // Create Virtual AP
  async createVirtualAP(
    masterInterface: string,
    ssid: string,
    securityProfile: string,
    name?: string
  ): Promise<void> {
    const body: Record<string, unknown> = {
      'master-interface': masterInterface,
      ssid,
      'security-profile': securityProfile,
      disabled: 'false'
    };
    if (name) body.name = name;
    await this.request('/interface/wireless/add', 'POST', body);
  }

  // Delete Wireless Interface
  async deleteWirelessInterface(id: string): Promise<void> {
    await this.request('/interface/wireless/remove', 'POST', { '.id': id });
  }

  // File Management
  async getFiles(path?: string): Promise<MikroTikFile[]> {
    const files = await this.request<MikroTikFile[]>('/file');
    if (path) {
      return files.filter(f => f.name.startsWith(path));
    }
    return files;
  }

  async getFileContent(name: string): Promise<string> {
    // MikroTik REST API returns file contents as base64 or text
    const response = await fetch(`${this.baseUrl}/file/${encodeURIComponent(name)}`, {
      method: 'GET',
      headers: {
        'Authorization': this.authHeader
      }
    });
    if (!response.ok) {
      throw new Error(`Failed to get file: ${response.status}`);
    }
    const data = await response.json();
    return data.contents || '';
  }

  async uploadFile(name: string, contents: string): Promise<void> {
    // Use the file/set endpoint to write file contents
    await this.request('/file/set', 'POST', {
      '.id': name,
      contents
    });
  }

  async createFile(name: string, contents: string): Promise<void> {
    // For MikroTik, we use the print command to create a file with content
    // Using /file/add for new files
    await this.request('/file/add', 'POST', {
      name,
      contents
    });
  }

  async deleteFile(name: string): Promise<void> {
    await this.request('/file/remove', 'POST', {
      '.id': name
    });
  }

  // Hotspot Server Profiles
  async getHotspotServerProfiles(): Promise<HotspotServerProfile[]> {
    return this.request<HotspotServerProfile[]>('/ip/hotspot/profile');
  }

  async updateHotspotServerProfile(id: string, htmlDirectory: string): Promise<void> {
    await this.request(`/ip/hotspot/profile/${id}`, 'PATCH', {
      'html-directory': htmlDirectory
    });
  }

  async updateHotspotProfileSSL(
    id: string,
    options: {
      sslCertificate?: string;
      loginBy?: string;
    }
  ): Promise<void> {
    const body: Record<string, unknown> = {};
    if (options.sslCertificate !== undefined) {
      body['ssl-certificate'] = options.sslCertificate;
    }
    if (options.loginBy !== undefined) {
      body['login-by'] = options.loginBy;
    }
    await this.request(`/ip/hotspot/profile/${id}`, 'PATCH', body);
  }

  // SSL Certificates
  async getCertificates(): Promise<Certificate[]> {
    return this.request<Certificate[]>('/certificate');
  }

  async createCertificate(
    name: string,
    commonName: string,
    daysValid: number = 3650,
    keySize: number = 2048
  ): Promise<{ ret: string }> {
    return this.request<{ ret: string }>('/certificate/add', 'POST', {
      name,
      'common-name': commonName,
      'days-valid': daysValid.toString(),
      'key-size': keySize.toString()
    });
  }

  async signCertificate(certName: string): Promise<void> {
    await this.request('/certificate/sign', 'POST', {
      '.id': certName
    });
  }

  async deleteCertificate(id: string): Promise<void> {
    await this.request('/certificate/remove', 'POST', {
      '.id': id
    });
  }

  // Let's Encrypt certificate (requires RouterOS 7+)
  async enableLetsEncrypt(
    commonName: string,
    email?: string
  ): Promise<void> {
    // MikroTik RouterOS 7+ supports Let's Encrypt via ACME
    // First check if ACME package is available
    const body: Record<string, unknown> = {
      'common-name': commonName
    };
    if (email) {
      body['email'] = email;
    }
    // This creates and signs a Let's Encrypt certificate
    await this.request('/certificate/enable-ssl-certificate', 'POST', body);
  }

  // Get host for FTP/file operations
  getHost(): string {
    return this.baseUrl.replace('http://', '').replace('/rest', '');
  }

  getCredentials(): { username: string; password: string } {
    const decoded = atob(this.authHeader.replace('Basic ', ''));
    const [username, password] = decoded.split(':');
    return { username, password };
  }

  // Hotspot User Profiles (used for voucher packages)
  async getHotspotUserProfiles(): Promise<HotspotUserProfile[]> {
    return this.request<HotspotUserProfile[]>('/ip/hotspot/user/profile');
  }

  async createHotspotUserProfile(
    name: string,
    options?: {
      rateLimit?: string;
      sessionTimeout?: string;
      sharedUsers?: string;
    }
  ): Promise<void> {
    const body: Record<string, unknown> = { name };
    if (options?.rateLimit) body['rate-limit'] = options.rateLimit;
    if (options?.sessionTimeout) body['session-timeout'] = options.sessionTimeout;
    if (options?.sharedUsers) body['shared-users'] = options.sharedUsers;
    await this.request('/ip/hotspot/user/profile/add', 'POST', body);
  }

  async updateHotspotUserProfile(
    id: string,
    updates: {
      name?: string;
      rateLimit?: string;
      sessionTimeout?: string;
      sharedUsers?: string;
      macCookieTimeout?: string;
    }
  ): Promise<void> {
    const body: Record<string, unknown> = {};
    // Only send non-empty values to MikroTik
    if (updates.name && updates.name.trim()) body.name = updates.name.trim();
    if (updates.rateLimit && updates.rateLimit.trim()) body['rate-limit'] = updates.rateLimit.trim();
    if (updates.sessionTimeout && updates.sessionTimeout.trim()) body['session-timeout'] = updates.sessionTimeout.trim();
    if (updates.sharedUsers && updates.sharedUsers.trim()) body['shared-users'] = updates.sharedUsers.trim();
    if (updates.macCookieTimeout && updates.macCookieTimeout.trim()) body['mac-cookie-timeout'] = updates.macCookieTimeout.trim();
    await this.request(`/ip/hotspot/user/profile/${id}`, 'PATCH', body);
  }

  async deleteHotspotUserProfile(id: string): Promise<void> {
    await this.request('/ip/hotspot/user/profile/remove', 'POST', {
      '.id': id
    });
  }

  // Hotspot Cookies (MAC bindings for session persistence)
  async getHotspotCookies(): Promise<HotspotCookie[]> {
    return this.request<HotspotCookie[]>('/ip/hotspot/cookie');
  }

  // DHCP Leases (for device names)
  async getDhcpLeases(): Promise<DhcpLease[]> {
    return this.request<DhcpLease[]>('/ip/dhcp-server/lease');
  }

  // Get hotspot user by name (for password recovery)
  async getHotspotUserByName(name: string): Promise<HotspotUser | undefined> {
    const users = await this.request<HotspotUser[]>(`/ip/hotspot/user?name=${encodeURIComponent(name)}`);
    return users[0];
  }

  // Hotspot Servers (for restricting user access to specific WiFi networks)
  async getHotspotServers(): Promise<Array<{ '.id': string; name: string; interface: string; profile: string; disabled: string }>> {
    return this.request('/ip/hotspot');
  }

  // Disconnect wireless client from registration table
  async disconnectWirelessClient(id: string): Promise<void> {
    await this.request('/interface/wireless/registration-table/remove', 'POST', {
      '.id': id
    });
  }

  // Wireless Access List (for MAC blocking)
  async getWirelessAccessList(): Promise<WirelessAccessEntry[]> {
    return this.request<WirelessAccessEntry[]>('/interface/wireless/access-list');
  }

  async addToWirelessAccessList(
    macAddress: string,
    comment?: string
  ): Promise<void> {
    await this.request('/interface/wireless/access-list/add', 'POST', {
      'mac-address': macAddress,
      authentication: 'no',
      forwarding: 'no',
      comment: comment || 'Blocked from dashboard'
    });
  }

  async removeFromWirelessAccessList(id: string): Promise<void> {
    await this.request('/interface/wireless/access-list/remove', 'POST', {
      '.id': id
    });
  }
}
