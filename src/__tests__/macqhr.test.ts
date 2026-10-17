import {
  calculateHaversineDistanceMeters,
  evaluateAttendanceSecurity,
  MACQUIRES_BRANCHES,
  MAX_ALLOWED_ACCURACY_METERS,
  RawLocationTelemetry,
} from '../services/locationSecurity';
import {
  buildTeamsApprovalAdaptiveCard,
  createOutlookLeaveCalendarEvent,
  resolveTeamsPresenceFromAttendance,
} from '../services/microsoftGraph';
import {
  calculateSaudiGosiBreakdown,
  createSignedOfflinePunch,
  verifyPunchSignature,
} from '../services/offlineSyncAndCompliance';
import { MACQUIRES_PALETTE, darkColors, lightColors } from '../theme/colors';
import { rtlRow, rtlText } from '../theme/typography';
import { TRANSLATIONS } from '../i18n/translations';

// Lightweight zero-dependency test harness compatible with strict TypeScript & Node
let passedCount = 0;
let failedCount = 0;

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(
      `${message ? message + ' — ' : ''}Expected ${b}, but received ${a}`
    );
  }
}

function assertTrue(condition: boolean, message?: string): void {
  if (!condition) {
    throw new Error(message || 'Expected condition to be true, received false');
  }
}

function describeSuite(suiteName: string, fn: () => void): void {
  console.log(`\n▶ SUITE: ${suiteName}`);
  fn();
}

function itCase(testName: string, fn: () => void): void {
  try {
    fn();
    passedCount++;
    console.log(`  ✓ PASS: ${testName}`);
  } catch (err) {
    failedCount++;
    console.error(`  ✗ FAIL: ${testName}`);
    console.error(`    Reason: ${(err as Error).message}`);
  }
}

const RIYADH_HQ = MACQUIRES_BRANCHES[0];

describeSuite(
  'Sprint 1 & 4: Official Macquires Design System & Bilingual RTL Rules',
  () => {
    itCase('TC-1.1: Enforces exact Macquires official hex palette tokens', () => {
      assertEqual(MACQUIRES_PALETTE.oxfordBlue, '#001629');
      assertEqual(MACQUIRES_PALETTE.prussianBlue, '#002C52');
      assertEqual(MACQUIRES_PALETTE.indigoDye, '#293F66');
      assertEqual(MACQUIRES_PALETTE.bdazzledBlue, '#3F5678');
      assertEqual(MACQUIRES_PALETTE.davysGrey, '#555555');
      assertEqual(MACQUIRES_PALETTE.spanishGrey, '#999999');
      assertEqual(MACQUIRES_PALETTE.orangePantone, '#FE5800');
    });

    itCase(
      'TC-1.2: Maintains complete translation parity between English (en) and Arabic (ar)',
      () => {
        const enKeys = Object.keys(TRANSLATIONS.en).sort();
        const arKeys = Object.keys(TRANSLATIONS.ar).sort();
        assertEqual(enKeys, arKeys);
        for (const key of enKeys) {
          const k = key as keyof typeof TRANSLATIONS.en;
          assertTrue(
            TRANSLATIONS.en[k].length > 0,
            `EN key ${key} should not be empty`
          );
          assertTrue(
            TRANSLATIONS.ar[k].length > 0,
            `AR key ${key} should not be empty`
          );
        }
      }
    );

    itCase(
      'TC-1.3: Returns proper bidirectional layout styles for LTR and RTL',
      () => {
        assertEqual(rtlRow(false), { flexDirection: 'row' });
        assertEqual(rtlRow(true), { flexDirection: 'row-reverse' });
        assertEqual(rtlText(false).textAlign, 'left');
        assertEqual(rtlText(true).textAlign, 'right');
        assertEqual(lightColors.isDark, false);
        assertEqual(darkColors.isDark, true);
      }
    );
  }
);

describeSuite(
  'Sprint 2: Geofence Attendance & 6-Layer Anti-Spoofing Engine',
  () => {
    const baseValidTelemetry: RawLocationTelemetry = {
      latitude: RIYADH_HQ.latitude + 0.0001, // ~11m from Riyadh HQ center
      longitude: RIYADH_HQ.longitude + 0.0001,
      accuracy: 8.5,
      altitude: 612,
      speed: 0.4,
      mocked: false,
      timestamp: 1700000000000,
      wifiSsid: RIYADH_HQ.allowedWifiSsid,
      wifiBssid: RIYADH_HQ.allowedWifiBssids[0],
      bleBeaconDetected: true,
      isJailbrokenOrRooted: false,
      biometricVerified: true,
    };

    itCase('TC-2.1: Calculates accurate Haversine distance in meters', () => {
      const zeroDist = calculateHaversineDistanceMeters(
        RIYADH_HQ.latitude,
        RIYADH_HQ.longitude,
        RIYADH_HQ.latitude,
        RIYADH_HQ.longitude
      );
      assertEqual(zeroDist, 0);

      const dist = calculateHaversineDistanceMeters(
        24.7136,
        46.6753,
        24.7146,
        46.6753
      );
      assertTrue(
        dist > 105 && dist < 115,
        `Expected ~111m, got ${dist}m`
      );
    });

    itCase(
      'TC-2.2: ALLOWS attendance when employee is inside geofence with genuine hardware GPS, corporate Wi-Fi, and biometric liveness',
      () => {
        const verdict = evaluateAttendanceSecurity(
          baseValidTelemetry,
          MACQUIRES_BRANCHES,
          1700000000000
        );
        assertEqual(verdict.allowed, true);
        assertEqual(verdict.violations.length, 0);
        assertEqual(verdict.insideGeofence, true);
        assertEqual(verdict.wifiVerified, true);
        assertEqual(verdict.isMockDetected, false);
        assertEqual(verdict.trustScore, 100);
      }
    );

    itCase(
      'TC-2.3: BLOCKS attendance when OS Mock Location / Fake GPS app flag is detected (Rule 2.1)',
      () => {
        const spoofed: RawLocationTelemetry = {
          ...baseValidTelemetry,
          mocked: true,
        };
        const verdict = evaluateAttendanceSecurity(
          spoofed,
          MACQUIRES_BRANCHES,
          1700000000000
        );
        assertEqual(verdict.allowed, false);
        assertEqual(verdict.isMockDetected, true);
        assertTrue(
          verdict.violations.includes('MOCK_LOCATION_PROVIDER_DETECTED')
        );
      }
    );

    itCase(
      'TC-2.4: BLOCKS attendance when employee is outside the 150m office geofence without beacon/Wi-Fi fallback (Rule 2.2)',
      () => {
        const outside: RawLocationTelemetry = {
          ...baseValidTelemetry,
          latitude: RIYADH_HQ.latitude + 0.015, // ~1.66 km away
          wifiSsid: 'Home-WiFi',
          wifiBssid: '11:22:33:44:55:66',
          bleBeaconDetected: false,
        };
        const verdict = evaluateAttendanceSecurity(
          outside,
          MACQUIRES_BRANCHES,
          1700000000000
        );
        assertEqual(verdict.allowed, false);
        assertEqual(verdict.insideGeofence, false);
        assertTrue(verdict.violations.includes('OUTSIDE_GEOFENCE_BOUNDARY'));
      }
    );

    itCase(
      'TC-2.5: BLOCKS attendance when GPS accuracy radius exceeds 50m threshold (Rule 2.2)',
      () => {
        const poorAccuracy: RawLocationTelemetry = {
          ...baseValidTelemetry,
          accuracy: MAX_ALLOWED_ACCURACY_METERS + 25, // 75m radius
        };
        const verdict = evaluateAttendanceSecurity(
          poorAccuracy,
          MACQUIRES_BRANCHES,
          1700000000000
        );
        assertEqual(verdict.allowed, false);
        assertEqual(verdict.isAccuracyAcceptable, false);
        assertTrue(verdict.violations.includes('LOW_GPS_ACCURACY'));
      }
    );

    itCase(
      'TC-2.6: BLOCKS attendance on rooted/jailbroken devices (Rule 2.4)',
      () => {
        const rooted: RawLocationTelemetry = {
          ...baseValidTelemetry,
          isJailbrokenOrRooted: true,
        };
        const verdict = evaluateAttendanceSecurity(
          rooted,
          MACQUIRES_BRANCHES,
          1700000000000
        );
        assertEqual(verdict.allowed, false);
        assertTrue(
          verdict.violations.includes('COMPROMISED_DEVICE_ROOT_JAILBREAK')
        );
      }
    );

    itCase(
      'TC-2.7: BLOCKS attendance if client device clock is rolled back or drifts > 5 mins from Server NTP (Rule 2.6)',
      () => {
        const serverTime = 1700000000000;
        const rolledBackClient: RawLocationTelemetry = {
          ...baseValidTelemetry,
          timestamp: serverTime - 15 * 60 * 1000, // 15 minutes behind server
        };
        const verdict = evaluateAttendanceSecurity(
          rolledBackClient,
          MACQUIRES_BRANCHES,
          serverTime
        );
        assertEqual(verdict.allowed, false);
        assertTrue(verdict.violations.includes('TIME_TAMPER_DRIFT_DETECTED'));
      }
    );

    itCase(
      'TC-2.8: BLOCKS attendance when Biometric Face ID liveness is unverified (Rule 2.5)',
      () => {
        const unverifiedBio: RawLocationTelemetry = {
          ...baseValidTelemetry,
          biometricVerified: false,
        };
        const verdict = evaluateAttendanceSecurity(
          unverifiedBio,
          MACQUIRES_BRANCHES,
          1700000000000
        );
        assertEqual(verdict.allowed, false);
        assertTrue(
          verdict.violations.includes('UNVERIFIED_BIOMETRIC_LIVENESS')
        );
      }
    );
  }
);

describeSuite(
  'Sprint 3: Microsoft 365, Teams Presence, Adaptive Cards & Outlook Sync',
  () => {
    itCase(
      'TC-3.1: Maps attendance states accurately to Microsoft Teams Presence (Rule 3.2)',
      () => {
        const inOffice = resolveTeamsPresenceFromAttendance({
          isClockedIn: true,
          isOnBreak: false,
        });
        assertEqual(inOffice.availability, 'Available');
        assertEqual(inOffice.activity, 'Available');

        const onBreak = resolveTeamsPresenceFromAttendance({
          isClockedIn: true,
          isOnBreak: true,
        });
        assertEqual(onBreak.availability, 'BeRightBack');

        const clockedOut = resolveTeamsPresenceFromAttendance({
          isClockedIn: false,
          isOnBreak: false,
        });
        assertEqual(clockedOut.availability, 'Away');
        assertEqual(clockedOut.activity, 'OffWork');

        const onLeave = resolveTeamsPresenceFromAttendance({
          isClockedIn: false,
          isOnBreak: false,
          isOnLeave: true,
        });
        assertEqual(onLeave.activity, 'OutOfOffice');
      }
    );

    itCase(
      'TC-3.2: Generates valid Microsoft Teams Adaptive Card v1.5 payload for manager approvals',
      () => {
        const card = buildTeamsApprovalAdaptiveCard({
          id: 'app-101',
          employeeName: 'Omar Al-Zahrani',
          role: 'Product Designer',
          category: 'Overtime',
          headline: 'Weekend Release Overtime',
          startDate: '17 Oct 2026',
          endDate: '17 Oct 2026',
          amountSar: 650,
          decision: 'Approved',
        });

        assertEqual(card.type, 'message');
        assertEqual(card.attachments.length, 1);
        assertEqual(
          card.attachments[0].contentType,
          'application/vnd.microsoft.card.adaptive'
        );
        assertEqual(card.attachments[0].content.version, '1.5');
        assertEqual(card.attachments[0].content.actions.length, 2);
      }
    );

    itCase(
      'TC-3.3: Creates Exchange Online / Outlook Calendar Out-Of-Office event for leave requests (Rule 3.3)',
      () => {
        const ev = createOutlookLeaveCalendarEvent({
          employeeName: 'Rahaf Al-Mansoor',
          leaveType: 'Annual Vacation',
          fromDay: 12,
          toDay: 16,
        });

        assertTrue(ev.subject.includes('Rahaf Al-Mansoor'));
        assertTrue(ev.subject.includes('Annual Vacation'));
        assertEqual(ev.showAs, 'oof');
        assertEqual(ev.syncedToExchange, true);
        assertEqual(ev.startIso, '2026-06-12T08:00:00+03:00');
        assertEqual(ev.endIso, '2026-06-16T17:00:00+03:00');
      }
    );
  }
);

describeSuite(
  'Sprint 4 & 5: Offline Anti-Tamper Queue & Saudi Labor Law GOSI / Mudad WPS',
  () => {
    itCase(
      'TC-4.1: Signs offline attendance punches and detects any coordinate or timestamp tampering (Rule 4.3)',
      () => {
        const punch = createSignedOfflinePunch({
          employeeId: 'EMP-1042',
          action: 'CLOCK_IN',
          latitude: 24.7136,
          longitude: 46.6753,
          accuracyMeters: 9.2,
          wifiBssid: 'A4:83:E7:2F:91:C0',
          timestampIso: '2026-10-17T08:00:00.000Z',
        });

        assertEqual(verifyPunchSignature(punch), true);

        // Tamper with coordinates in local storage
        const tamperedCoords = { ...punch, latitude: 25.0 };
        assertEqual(verifyPunchSignature(tamperedCoords), false);

        // Tamper with timestamp in local storage
        const tamperedTime = {
          ...punch,
          clientTimestampIso: '2026-10-17T07:45:00.000Z',
        };
        assertEqual(verifyPunchSignature(tamperedTime), false);
      }
    );

    itCase(
      'TC-5.1: Computes Saudi GOSI (9.75% Employee / 11.75% Employer) and Mudad WPS IBAN compliance (Rule 5.2)',
      () => {
        const breakdown = calculateSaudiGosiBreakdown({
          basicSalarySar: 16000,
          housingAllowanceSar: 4000, // Subject wage = 20,000 SAR
          transportAllowanceSar: 1600,
          overtimeSar: 450,
          iban: 'SA44 8000 0000 6080 1016 7519',
        });

        assertEqual(breakdown.contributoryWageSar, 20000);
        assertEqual(breakdown.employeeDeductionSar, 1950); // 9.75% of 20,000
        assertEqual(breakdown.employerContributionSar, 2350); // 11.75% of 20,000
        assertEqual(breakdown.netPayableAfterGosiSar, 20100); // (16000+4000+1600+450) - 1950
        assertEqual(breakdown.mudadWpsCompliant, true);
      }
    );
  }
);

console.log(
  `\n==================================================\nTEST SUMMARY: ${passedCount} passed, ${failedCount} failed (${
    passedCount + failedCount
  } total)\n==================================================`
);

if (failedCount > 0) {
  throw new Error(`${failedCount} test case(s) failed.`);
}
