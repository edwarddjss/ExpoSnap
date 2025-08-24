/**
 * Auto-discovery utility for finding ExpoSnap servers on the local network
 */
/* eslint-disable no-undef */

interface DiscoveryResult {
  ip: string;
  port: number;
  service: string;
  version: string;
}

/**
 * Gets common IP ranges to scan based on device's network
 */
function getIPRangesToScan(): string[] {
  // Common private network ranges
  return [
    '192.168.1', // Most home routers
    '192.168.0', // Alternative home router config
    '10.0.0', // Corporate networks, some routers
    '172.16.0', // Less common but possible
    '192.168.2', // Some ISP router configs
  ];
}

/**
 * Tests a single IP address for ExpoSnap server
 */
async function testIP(
  ip: string,
  port: number,
  timeoutMs: number = 1000
): Promise<DiscoveryResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`http://${ip}:${port}/ping`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.service === 'exposnap') {
        return {
          ip,
          port: data.port || port,
          service: data.service,
          version: data.version || 'unknown',
        };
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Scans a single IP range for ExpoSnap servers
 */
async function scanIPRange(
  baseIP: string,
  port: number = 3333
): Promise<DiscoveryResult | null> {
  const promises: Promise<DiscoveryResult | null>[] = [];

  // Scan common host IPs first (routers, common static IPs)
  const priorityIPs = [100, 101, 102, 1, 2, 10, 20, 50];

  for (const hostNum of priorityIPs) {
    const ip = `${baseIP}.${hostNum}`;
    promises.push(testIP(ip, port, 800));
  }

  // Check priority IPs first
  const priorityResults = await Promise.all(promises);
  const found = priorityResults.find(result => result !== null);
  if (found) {
    return found;
  }

  // If not found in priority IPs, scan the full range (but skip already checked)
  const fullScanPromises: Promise<DiscoveryResult | null>[] = [];
  for (let i = 1; i <= 254; i++) {
    if (!priorityIPs.includes(i)) {
      const ip = `${baseIP}.${i}`;
      fullScanPromises.push(testIP(ip, port, 500));
    }
  }

  const fullResults = await Promise.all(fullScanPromises);
  return fullResults.find(result => result !== null) || null;
}

/**
 * Discovers ExpoSnap servers on the local network
 */
export async function discoverServer(
  ports: number | number[] = [3333, 3000, 3001, 8080, 8081, 5000, 4000]
): Promise<DiscoveryResult | null> {
  const ranges = getIPRangesToScan();

  // Handle both single port and array of ports for backward compatibility
  const portArray = Array.isArray(ports) ? ports : [ports];

  // Try each port on each range
  for (const port of portArray) {
    const rangePromises = ranges.map(range => scanIPRange(range, port));

    for (const promise of rangePromises) {
      try {
        const result = await promise;
        if (result) {
          return result;
        }
      } catch {
        // Continue to next range
        continue;
      }
    }
  }

  return null;
}

/**
 * Helper to get server URL from discovery result
 */
export function getServerURL(result: DiscoveryResult): string {
  return `http://${result.ip}:${result.port}`;
}
