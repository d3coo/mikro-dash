import type {
  MikroTikConfig,
  HotspotUser,
  ActiveSession,
  WirelessInterface,
  SecurityProfile,
  SystemResource
} from './types';

export class MikroTikClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(config: MikroTikConfig) {
    this.baseUrl = `http://${config.host}/rest`;
    this.authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`);
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': this.authHeader,
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
    limitBytes?: number
  ): Promise<void> {
    const body: Record<string, unknown> = {
      name,
      password,
      profile
    };
    if (limitBytes) {
      body['limit-bytes-total'] = limitBytes.toString();
    }
    await this.request('/ip/hotspot/user/add', 'POST', body);
  }

  async deleteHotspotUser(id: string): Promise<void> {
    await this.request(`/ip/hotspot/user/${id}`, 'DELETE');
  }

  // Active Sessions
  async getActiveSessions(): Promise<ActiveSession[]> {
    return this.request<ActiveSession[]>('/ip/hotspot/active');
  }

  async kickSession(id: string): Promise<void> {
    await this.request(`/ip/hotspot/active/${id}`, 'DELETE');
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
}
