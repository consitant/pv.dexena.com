/**
 * Formulare der Weboberfläche des WLAN-Sticks (High-Flying, Seite do_cmd_en.html).
 * Feldnamen und Werte stammen aus der Original-Weboberfläche (JS der Seiten wireless/port/select);
 * am echten Gerät per direktem POST noch NICHT verifiziert → im UI als Beta gekennzeichnet.
 * Alle stick-spezifischen Werte stehen ausschließlich hier.
 */

export const STICK_DEFAULT_AP_IP = "10.10.100.254";
export const STICK_FORM_PATH = "/do_cmd_en.html";
export const STICK_SERVER_HOST = "solarmax.dexena.com";
export const STICK_TCP_TIMEOUT_S = 300;

export type FormField = { name: string; value: string };

/** Betriebsart: AP+STA (eigenes WLAN bleibt erreichbar, zusätzlich Verbindung ins Heim-WLAN). Menü „Mode Selection“. */
export function wifiModeFields(): FormField[] {
  return [{ name: "wifi_mode", value: "APSTA" }];
}

/**
 * Heim-WLAN (STA). Menü „STA Setting“. WPA2-PSK/AES, DHCP.
 * Die IP-Felder sind im Original bei DHCP deaktiviert und werden vom Browser nicht gesendet.
 */
export function staFields(ssid: string, password: string): FormField[] {
  return [
    { name: "sta_setting_ssid", value: ssid },
    { name: "sta_setting_auth_sel", value: "WPA2PSK" },
    { name: "sta_setting_auth", value: "WPA2PSK" },
    { name: "sta_setting_encry_sel", value: "AES" },
    { name: "sta_setting_encry", value: "AES" },
    { name: "sta_setting_type_sel", value: "ASCII" },
    { name: "sta_setting_wpakey", value: password },
    { name: "wan_setting_dhcp", value: "DHCP" },
  ];
}

/** Verbindung zum Gateway (Socket A als TCP-Client). Menü „Other Setting“ → „Network Setting“. */
export function serverFields(port: number, host = STICK_SERVER_HOST): FormField[] {
  return [
    { name: "net_setting_pro_sel", value: "TCPCLIENT" },
    { name: "net_setting_pro", value: "TCP" },
    { name: "net_setting_cs", value: "CLIENT" },
    { name: "net_setting_port", value: String(port) },
    { name: "net_setting_ip", value: host },
    { name: "net_setting_to", value: String(STICK_TCP_TIMEOUT_S) },
  ];
}

/** Entsprechender AT-Befehl (Socket B), wie im Admin angezeigt. */
export function atCommand(port: number, host = STICK_SERVER_HOST): string {
  return `AT+SOCKB=TCP,${port},${host}`;
}

/** Prüft eine vom Nutzer eingegebene Stick-IP (nur private IPv4-Adressen). */
export function isPrivateIpv4(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim());
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((x) => x > 255)) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
