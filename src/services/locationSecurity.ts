/**
 * Official Macquires Office Branches with Geofence Polygons / Radius
 * Coordinates are verified against Riyadh HQ and regional hubs.
 */
export interface OfficeGeofenceBranch {
  id: string;
  name: string;
  nameAr: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  allowedWifiBssids: string[];
  allowedWifiSsid: string;
  bleBeaconUuid: string;
}

export const MACQUIRES_BRANCHES: OfficeGeofenceBranch[] = [
  {
    id: 'branch-riyadh-hq',
    name: 'Riyadh HQ • King Fahd Digital City',
    nameAr: 'المقر الرئيسي بالرياض • مدينة الملك فهد الرقمية',
    latitude: 24.7136,
    longitude: 46.6753,
    radiusMeters: 150,
    allowedWifiBssids: ['A4:83:E7:2F:91:C0', 'A4:83:E7:2F:91:C1'],
    allowedWifiSsid: 'Macquires-Corp-5G',
    bleBeaconUuid: 'FDA50693-A4E2-4FB1-AFCF-C6EB07647825',
  },
  {
    id: 'branch-jeddah-hub',
    name: 'Jeddah Regional Hub • Corniche Tower',
    nameAr: 'الفرع الإقليمي بجدة • برج الكورنيش',
    latitude: 21.5433,
    longitude: 39.1728,
    radiusMeters: 120,
    allowedWifiBssids: ['B8:27:EB:45:12:99'],
    allowedWifiSsid: 'Macquires-Jeddah-5G',
    bleBeaconUuid: 'FDA50693-A4E2-4FB1-AFCF-C6EB07647826',
  },
];

export interface RawLocationTelemetry {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude?: number | null;
  speed?: number | null;
  mocked?: boolean;
  timestamp: number;
  wifiSsid?: string | null;
  wifiBssid?: string | null;
  bleBeaconDetected?: boolean;
  isJailbrokenOrRooted?: boolean;
  biometricVerified?: boolean;
}

export type SecurityViolationCode =
  | 'MOCK_LOCATION_PROVIDER_DETECTED'
  | 'COMPROMISED_DEVICE_ROOT_JAILBREAK'
  | 'LOW_GPS_ACCURACY'
  | 'IMPLAUSIBLE_MOVEMENT_SPEED'
  | 'TIME_TAMPER_DRIFT_DETECTED'
  | 'OUTSIDE_GEOFENCE_BOUNDARY'
  | 'UNVERIFIED_BIOMETRIC_LIVENESS';

export interface GeofenceSecurityVerdict {
  allowed: boolean;
  trustScore: number; // 0 to 100
  distanceMeters: number;
  insideGeofence: boolean;
  wifiVerified: boolean;
  bleVerified: boolean;
  isMockDetected: boolean;
  isAccuracyAcceptable: boolean;
  serverNtpTimestampIso: string;
  clockDriftMs: number;
  nearestBranch: OfficeGeofenceBranch;
  violations: SecurityViolationCode[];
  violationDetails: string[];
}

/**
 * Maximum acceptable GPS accuracy radius per RULES.md Section 2.2:
 * - <= 25m is high confidence
 * - > 50m is strictly rejected
 */
export const HIGH_CONFIDENCE_ACCURACY_METERS = 25;
export const MAX_ALLOWED_ACCURACY_METERS = 50;
export const MAX_PLAUSIBLE_SPEED_MPS = 45; // ~162 km/h (rejects teleportation jumps)
export const MAX_CLOCK_DRIFT_MS = 5 * 60 * 1000; // 5 minutes max client/server clock drift

/**
 * Haversine formula to compute exact spherical distance in meters
 * between two GPS coordinates (Section 2.2 of RULES.md).
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Evaluates raw telemetry against all 6 Anti-Spoofing Rules in RULES.md:
 * 1. Hardware & OS Mock Location Verification (`mocked` flag)
 * 2. Geofencing & Accuracy Enforcement (Haversine distance + accuracy <= 25m/50m)
 * 3. Office Network & BLE Beacons Fallback (BSSID / SSID / BLE verification)
 * 4. Device Integrity & Root/Jailbreak Detection
 * 5. Biometric Liveness Verification
 * 6. Server-Side NTP Timestamping & Clock Drift Prevention
 */
export function evaluateAttendanceSecurity(
  telemetry: RawLocationTelemetry,
  branches: OfficeGeofenceBranch[] = MACQUIRES_BRANCHES,
  authoritativeServerTimeMs: number = Date.now()
): GeofenceSecurityVerdict {
  const violations: SecurityViolationCode[] = [];
  const violationDetails: string[] = [];

  // Find nearest corporate branch
  let nearestBranch = branches[0];
  let minDistance = calculateHaversineDistanceMeters(
    telemetry.latitude,
    telemetry.longitude,
    nearestBranch.latitude,
    nearestBranch.longitude
  );

  for (let i = 1; i < branches.length; i++) {
    const d = calculateHaversineDistanceMeters(
      telemetry.latitude,
      telemetry.longitude,
      branches[i].latitude,
      branches[i].longitude
    );
    if (d < minDistance) {
      minDistance = d;
      nearestBranch = branches[i];
    }
  }

  // Rule 1: Hardware & OS Mock Location Verification
  const isMockDetected = Boolean(telemetry.mocked);
  if (isMockDetected) {
    violations.push('MOCK_LOCATION_PROVIDER_DETECTED');
    violationDetails.push(
      'Mock GPS location provider or spoofing software detected on device.'
    );
  }

  // Rule 4: Device Integrity & Root/Jailbreak Detection
  if (telemetry.isJailbrokenOrRooted) {
    violations.push('COMPROMISED_DEVICE_ROOT_JAILBREAK');
    violationDetails.push(
      'Compromised OS environment (Root / Jailbreak / Magisk) detected.'
    );
  }

  // Rule 2a: GPS Accuracy Enforcement
  const accuracy = telemetry.accuracy ?? 999;
  const isAccuracyAcceptable = accuracy <= MAX_ALLOWED_ACCURACY_METERS;
  if (!isAccuracyAcceptable) {
    violations.push('LOW_GPS_ACCURACY');
    violationDetails.push(
      `GPS accuracy radius (${Math.round(accuracy)}m) exceeds maximum allowed threshold (${MAX_ALLOWED_ACCURACY_METERS}m).`
    );
  }

  // Teleportation / Speed plausibility check
  if (
    typeof telemetry.speed === 'number' &&
    telemetry.speed > MAX_PLAUSIBLE_SPEED_MPS
  ) {
    violations.push('IMPLAUSIBLE_MOVEMENT_SPEED');
    violationDetails.push(
      `Implausible movement velocity (${Math.round(telemetry.speed)} m/s) indicates coordinate jump.`
    );
  }

  // Rule 6: Server-Side Timestamping & Clock Rollback Detection
  const clockDriftMs = Math.abs(authoritativeServerTimeMs - telemetry.timestamp);
  if (clockDriftMs > MAX_CLOCK_DRIFT_MS) {
    violations.push('TIME_TAMPER_DRIFT_DETECTED');
    violationDetails.push(
      `Device clock diverges from authoritative NTP server by ${Math.round(
        clockDriftMs / 1000
      )}s.`
    );
  }

  // Rule 3: Office Network Wi-Fi BSSID / BLE Beacon Verification
  const normalizedBssid = telemetry.wifiBssid?.toUpperCase().trim() ?? '';
  const wifiVerified =
    (normalizedBssid.length > 0 &&
      nearestBranch.allowedWifiBssids.includes(normalizedBssid)) ||
    telemetry.wifiSsid === nearestBranch.allowedWifiSsid;

  const bleVerified = Boolean(telemetry.bleBeaconDetected);

  // Rule 2b: Geofence Boundary Check (Allows BLE/Wi-Fi fallback only if GPS is not mocked)
  const insideGeofence = minDistance <= nearestBranch.radiusMeters;
  if (!insideGeofence && !(wifiVerified && bleVerified)) {
    violations.push('OUTSIDE_GEOFENCE_BOUNDARY');
    violationDetails.push(
      `Current position is ${minDistance}m away from ${nearestBranch.name} (allowed radius: ${nearestBranch.radiusMeters}m).`
    );
  }

  // Rule 5: Biometric Liveness Verification
  if (telemetry.biometricVerified === false) {
    violations.push('UNVERIFIED_BIOMETRIC_LIVENESS');
    violationDetails.push(
      'Biometric Face ID / Touch ID liveness check has not been completed.'
    );
  }

  // Compute composite trust score (0 - 100)
  let trustScore = 100;
  if (isMockDetected) trustScore -= 70;
  if (telemetry.isJailbrokenOrRooted) trustScore -= 60;
  if (!insideGeofence) trustScore -= 40;
  if (!isAccuracyAcceptable) trustScore -= 25;
  else if (accuracy > HIGH_CONFIDENCE_ACCURACY_METERS) trustScore -= 10;
  if (!wifiVerified) trustScore -= 10;
  if (!bleVerified) trustScore -= 5;
  if (clockDriftMs > MAX_CLOCK_DRIFT_MS) trustScore -= 30;
  trustScore = Math.max(0, Math.min(100, trustScore));

  const allowed = violations.length === 0;

  return {
    allowed,
    trustScore,
    distanceMeters: minDistance,
    insideGeofence,
    wifiVerified,
    bleVerified,
    isMockDetected,
    isAccuracyAcceptable,
    serverNtpTimestampIso: new Date(authoritativeServerTimeMs).toISOString(),
    clockDriftMs,
    nearestBranch,
    violations,
    violationDetails,
  };
}

export interface SlippyMapTile {
  key: string;
  url: string;
  leftPx: number;
  topPx: number;
}

export interface LiveSlippyMapGrid {
  zoom: number;
  tileSizePx: number;
  centerTileX: number;
  centerTileY: number;
  subTileOffsetX: number;
  subTileOffsetY: number;
  tiles: SlippyMapTile[];
}

/**
 * Computes a Web Mercator slippy-map tile grid centered on exact GPS
 * coordinates (latitude, longitude) so React Native can render real street
 * map tiles natively on iOS, Android, and Web without an API key.
 */
export function buildLiveSlippyMapGrid(
  latitude: number,
  longitude: number,
  options?: {
    zoom?: number;
    isDark?: boolean;
    viewportWidth?: number;
    viewportHeight?: number;
  }
): LiveSlippyMapGrid {
  const zoom = options?.zoom ?? 16;
  const isDark = options?.isDark ?? false;
  const viewportWidth = options?.viewportWidth ?? 420;
  const viewportHeight = options?.viewportHeight ?? 210;
  const tileSizePx = 256;

  const clampedLat = Math.max(-85.0511, Math.min(85.0511, latitude));
  const clampedLon = ((((longitude + 180) % 360) + 360) % 360) - 180;

  const n = Math.pow(2, zoom);
  const latRad = (clampedLat * Math.PI) / 180;

  const exactX = ((clampedLon + 180) / 360) * n;
  const exactY =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  const centerTileX = Math.floor(exactX);
  const centerTileY = Math.floor(exactY);

  const subTileOffsetX = Math.round((exactX - centerTileX) * tileSizePx);
  const subTileOffsetY = Math.round((exactY - centerTileY) * tileSizePx);

  const centerScreenX = viewportWidth / 2;
  const centerScreenY = viewportHeight / 2;

  // Use unwatermarked Google Maps street/hybrid tiles (zero API key required, no watermark)
  const layerParam = isDark ? 'y' : 'm';
  const tiles: SlippyMapTile[] = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const tx = ((centerTileX + dx) % n + n) % n;
      const ty = Math.max(0, Math.min(n - 1, centerTileY + dy));

      const leftPx = Math.round(
        centerScreenX - subTileOffsetX + dx * tileSizePx
      );
      const topPx = Math.round(
        centerScreenY - subTileOffsetY + dy * tileSizePx
      );

      tiles.push({
        key: `${zoom}-${tx}-${ty}-${dx}-${dy}-${layerParam}`,
        url: `https://mt1.google.com/vt/lyrs=${layerParam}&x=${tx}&y=${ty}&z=${zoom}`,
        leftPx,
        topPx,
      });
    }
  }

  return {
    zoom,
    tileSizePx,
    centerTileX,
    centerTileY,
    subTileOffsetX,
    subTileOffsetY,
    tiles,
  };
}

