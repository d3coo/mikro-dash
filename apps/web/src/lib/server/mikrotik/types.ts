export interface HotspotUser {
  '.id': string;
  name: string;
  password?: string;
  profile: string;
  server?: string;
  'limit-bytes-total'?: string;
  'limit-uptime'?: string;
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

export interface WifiInterface {
  '.id': string;
  name: string;
  'default-name'?: string;
  configuration?: string;
  'configuration.ssid'?: string;
  'configuration.country'?: string;
  'datapath.bridge'?: string;
  'security.authentication-types'?: string;
  'security.passphrase'?: string;
  channel?: string;
  'channel.width'?: string;
  disabled: string;
  running: string;
  inactive: string;
  bound: string;
  master: string;
  'master-interface'?: string;
  'mac-address': string;
  'radio-mac'?: string;
  'l2mtu'?: string;
  'arp-timeout'?: string;
}

/** @deprecated Use WifiInterface - kept for backward compatibility */
export type WirelessInterface = WifiInterface;

export interface WifiRegistration {
  '.id': string;
  interface: string;
  'mac-address': string;
  signal: string;
  band?: string;
  ssid?: string;
  authorized: string;
  uptime: string;
  'tx-rate': string;
  'rx-rate': string;
  'tx-bits-per-second'?: string;
  'rx-bits-per-second'?: string;
  bytes: string; // "in,out" format
  packets: string;
  'auth-type'?: string;
  'last-activity'?: string;
}

/** @deprecated Use WifiRegistration - kept for backward compatibility */
export type WirelessRegistration = WifiRegistration;

export interface WifiSecurityProfile {
  '.id': string;
  name: string;
  'authentication-types'?: string;
  passphrase?: string;
}

/** @deprecated Use WifiSecurityProfile - kept for backward compatibility */
export type SecurityProfile = WifiSecurityProfile;

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
  comment?: string;
  server?: string;
  dynamic?: string;
}

export interface WifiAccessEntry {
  '.id': string;
  'mac-address': string;
  interface?: string;
  action?: string; // 'accept' | 'reject'
  'signal-range'?: string;
  comment?: string;
  disabled?: string;
}

/** @deprecated Use WifiAccessEntry - kept for backward compatibility */
export type WirelessAccessEntry = WifiAccessEntry;

export interface WifiConfiguration {
  '.id': string;
  name: string;
  ssid?: string;
  country?: string;
  security?: string;
  'security.authentication-types'?: string;
  'security.passphrase'?: string;
  datapath?: string;
  'datapath.bridge'?: string;
}

export interface WifiDatapath {
  '.id': string;
  name: string;
  bridge?: string;
}
