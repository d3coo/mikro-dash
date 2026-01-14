export interface HotspotUser {
  '.id': string;
  name: string;
  password?: string;
  profile: string;
  'limit-bytes-total'?: string;
  'bytes-in'?: string;
  'bytes-out'?: string;
  uptime?: string;
  comment?: string;
  disabled: string;
}

export interface ActiveSession {
  '.id': string;
  user: string;
  address: string;
  'mac-address': string;
  uptime: string;
  'bytes-in': string;
  'bytes-out': string;
  'session-time-left'?: string;
}

export interface WirelessInterface {
  '.id': string;
  name: string;
  ssid: string;
  band: string;
  disabled: string;
  'security-profile': string;
}

export interface SecurityProfile {
  '.id': string;
  name: string;
  mode: string;
  'wpa2-pre-shared-key'?: string;
}

export interface SystemResource {
  uptime: string;
  'cpu-load': string;
  'free-memory': string;
  'total-memory': string;
  'board-name': string;
  version: string;
}

export interface MikroTikConfig {
  host: string;
  username: string;
  password: string;
}

export interface MikroTikFile {
  '.id'?: string;
  name: string;
  type: string;
  size: string;
  'creation-time': string;
  contents?: string;
}

export interface HotspotServerProfile {
  '.id': string;
  name: string;
  'html-directory': string;
  'login-by': string;
  'ssl-certificate'?: string;
  'https-redirect'?: string;
}

export interface Certificate {
  '.id': string;
  name: string;
  'common-name': string;
  'days-valid'?: string;
  'key-size'?: string;
  fingerprint?: string;
  'invalid-before'?: string;
  'invalid-after'?: string;
  'expires-after'?: string;
  trusted?: string;
  'ca'?: string;
  issued?: string;
  status?: string;
}

export interface HotspotUserProfile {
  '.id': string;
  name: string;
  'session-timeout'?: string;
  'idle-timeout'?: string;
  'keepalive-timeout'?: string;
  'status-autorefresh'?: string;
  'shared-users'?: string;
  'rate-limit'?: string;
  'mac-cookie-timeout'?: string;
  'address-pool'?: string;
  'transparent-proxy'?: string;
  'open-status-page'?: string;
  'advertise'?: string;
}

export interface HotspotCookie {
  '.id': string;
  user: string;
  'mac-address': string;
  'expires-in'?: string;
}

export interface DhcpLease {
  '.id': string;
  address: string;
  'mac-address': string;
  'host-name'?: string;
  status?: string;
  'last-seen'?: string;
}
