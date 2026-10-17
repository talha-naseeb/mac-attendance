import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import {
  evaluateAttendanceSecurity,
  GeofenceSecurityVerdict,
  MACQUIRES_BRANCHES,
  RawLocationTelemetry,
} from '../services/locationSecurity';

export type SimulationPreset =
  | 'LIVE_VERIFIED_HQ'
  | 'REAL_DEVICE_GPS'
  | 'SIMULATE_SPOOF_MOCK_GPS'
  | 'SIMULATE_OUTSIDE_GEOFENCE'
  | 'SIMULATE_POOR_ACCURACY'
  | 'SIMULATE_COMPROMISED_ROOT';

export interface UseLocationSecurityResult {
  telemetry: RawLocationTelemetry;
  verdict: GeofenceSecurityVerdict;
  permissionStatus: 'granted' | 'denied' | 'undetermined';
  loadingLocation: boolean;
  simulationPreset: SimulationPreset;
  setSimulationPreset: (preset: SimulationPreset) => void;
  refreshLiveLocation: () => Promise<void>;
  toggleBiometricVerified: () => void;
  toggleWifiConnected: () => void;
}

const DEFAULT_HQ = MACQUIRES_BRANCHES[0];

export function useLocationSecurity(): UseLocationSecurityResult {
  const [simulationPreset, setSimulationPresetState] =
    useState<SimulationPreset>('LIVE_VERIFIED_HQ');
  const [permissionStatus, setPermissionStatus] = useState<
    'granted' | 'denied' | 'undetermined'
  >('granted');
  const [loadingLocation, setLoadingLocation] = useState(false);

  const [telemetry, setTelemetry] = useState<RawLocationTelemetry>({
    latitude: DEFAULT_HQ.latitude + 0.00012, // ~14m inside Riyadh HQ geofence
    longitude: DEFAULT_HQ.longitude + 0.00008,
    accuracy: 8.4,
    altitude: 612,
    speed: 0.3,
    mocked: false,
    timestamp: Date.now(),
    wifiSsid: DEFAULT_HQ.allowedWifiSsid,
    wifiBssid: DEFAULT_HQ.allowedWifiBssids[0],
    bleBeaconDetected: true,
    isJailbrokenOrRooted: false,
    biometricVerified: true,
  });

  const applyPreset = useCallback((preset: SimulationPreset) => {
    setSimulationPresetState(preset);
    const now = Date.now();

    switch (preset) {
      case 'LIVE_VERIFIED_HQ':
        setTelemetry({
          latitude: DEFAULT_HQ.latitude + 0.00012,
          longitude: DEFAULT_HQ.longitude + 0.00008,
          accuracy: 8.4,
          altitude: 612,
          speed: 0.2,
          mocked: false,
          timestamp: now,
          wifiSsid: DEFAULT_HQ.allowedWifiSsid,
          wifiBssid: DEFAULT_HQ.allowedWifiBssids[0],
          bleBeaconDetected: true,
          isJailbrokenOrRooted: false,
          biometricVerified: true,
        });
        break;

      case 'SIMULATE_SPOOF_MOCK_GPS':
        // Simulates an employee using Fake GPS / Mock Location Provider app
        setTelemetry({
          latitude: DEFAULT_HQ.latitude,
          longitude: DEFAULT_HQ.longitude,
          accuracy: 3.0,
          altitude: 0,
          speed: 0,
          mocked: true, // OS Mock Flag triggered!
          timestamp: now,
          wifiSsid: 'Home-Fiber-WiFi',
          wifiBssid: '00:11:22:33:44:55',
          bleBeaconDetected: false,
          isJailbrokenOrRooted: false,
          biometricVerified: true,
        });
        break;

      case 'SIMULATE_OUTSIDE_GEOFENCE':
        // Employee is 1.4 km away from Riyadh HQ & not on corporate Wi-Fi
        setTelemetry({
          latitude: DEFAULT_HQ.latitude + 0.0125,
          longitude: DEFAULT_HQ.longitude + 0.0042,
          accuracy: 12.0,
          altitude: 615,
          speed: 1.1,
          mocked: false,
          timestamp: now,
          wifiSsid: 'Starbucks-Guest',
          wifiBssid: 'CC:44:E2:10:88:11',
          bleBeaconDetected: false,
          isJailbrokenOrRooted: false,
          biometricVerified: true,
        });
        break;

      case 'SIMULATE_POOR_ACCURACY':
        // GPS signal degraded / jammed (> 50m radius threshold)
        setTelemetry({
          latitude: DEFAULT_HQ.latitude + 0.0002,
          longitude: DEFAULT_HQ.longitude,
          accuracy: 84.5, // Exceeds 50m maximum allowed accuracy
          altitude: 610,
          speed: 0,
          mocked: false,
          timestamp: now,
          wifiSsid: null,
          wifiBssid: null,
          bleBeaconDetected: false,
          isJailbrokenOrRooted: false,
          biometricVerified: true,
        });
        break;

      case 'SIMULATE_COMPROMISED_ROOT':
        // Rooted / Jailbroken phone with Xposed / Magisk hook
        setTelemetry({
          latitude: DEFAULT_HQ.latitude,
          longitude: DEFAULT_HQ.longitude,
          accuracy: 10.0,
          altitude: 612,
          speed: 0,
          mocked: false,
          timestamp: now,
          wifiSsid: DEFAULT_HQ.allowedWifiSsid,
          wifiBssid: DEFAULT_HQ.allowedWifiBssids[0],
          bleBeaconDetected: false,
          isJailbrokenOrRooted: true,
          biometricVerified: true,
        });
        break;

      case 'REAL_DEVICE_GPS':
        // Will trigger hardware GPS fetch
        break;
    }
  }, []);

  const refreshLiveLocation = useCallback(async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status === 'granted' ? 'granted' : 'denied');
      if (status !== 'granted') {
        setLoadingLocation(false);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      setSimulationPresetState('REAL_DEVICE_GPS');
      setTelemetry((prev) => ({
        ...prev,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? 15,
        altitude: pos.coords.altitude,
        speed: pos.coords.speed,
        mocked: Boolean((pos as { mocked?: boolean }).mocked),
        timestamp: pos.timestamp || Date.now(),
      }));
    } catch {
      // Fallback to verified HQ telemetry if browser/simulator blocks native GPS
      applyPreset('LIVE_VERIFIED_HQ');
    } finally {
      setLoadingLocation(false);
    }
  }, [applyPreset]);

  useEffect(() => {
    if (simulationPreset === 'REAL_DEVICE_GPS') {
      refreshLiveLocation();
    }
  }, [simulationPreset, refreshLiveLocation]);

  const toggleBiometricVerified = useCallback(() => {
    setTelemetry((prev) => ({
      ...prev,
      biometricVerified: !prev.biometricVerified,
      timestamp: Date.now(),
    }));
  }, []);

  const toggleWifiConnected = useCallback(() => {
    setTelemetry((prev) => {
      const isCorp = prev.wifiBssid === DEFAULT_HQ.allowedWifiBssids[0];
      return {
        ...prev,
        wifiSsid: isCorp ? 'Public-Cellular-Data' : DEFAULT_HQ.allowedWifiSsid,
        wifiBssid: isCorp
          ? '00:00:00:00:00:00'
          : DEFAULT_HQ.allowedWifiBssids[0],
        bleBeaconDetected: !isCorp,
        timestamp: Date.now(),
      };
    });
  }, []);

  const verdict = evaluateAttendanceSecurity(
    telemetry,
    MACQUIRES_BRANCHES,
    Date.now()
  );

  return {
    telemetry,
    verdict,
    permissionStatus,
    loadingLocation,
    simulationPreset,
    setSimulationPreset: applyPreset,
    refreshLiveLocation,
    toggleBiometricVerified,
    toggleWifiConnected,
  };
}
