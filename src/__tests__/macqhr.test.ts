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
import { buildSmoothBezierCradleGeometry } from '../services/bottomNavGeometry';
import { getMacqLogoSpec } from '../services/logoSpec';
import {
  deriveAvatarInitials,
  detectCountryFromPhoneInput,
  EditableEmployeeProfile,
  validateAndApplyProfileChanges,
} from '../services/profileSettingsService';
import {
  createInitialHydrationMap,
  filterActionsByRole,
  getAuthorizedDashboardSections,
  resolvePermissionsForRole,
} from '../services/dashboardOptimizationService';
import { INITIAL_ACTIONS } from '../data/mockData';
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

describeSuite(
  'Sprint 6: Option A Smooth Bezier Cradle Bottom Navigation Bar Geometry',
  () => {
    itCase(
      'TC-6.1: Computes flush bottom height including mobile safe-area bottom inset (Zero bottom gap)',
      () => {
        const geo = buildSmoothBezierCradleGeometry({
          width: 390,
          safeBottomInset: 34, // iPhone Home Indicator inset
          barContentHeight: 66,
          cradleHalfWidth: 58,
          cradleDepth: 36,
        });

        assertEqual(geo.width, 390);
        assertEqual(geo.centerX, 195);
        assertEqual(geo.totalHeight, 100); // 66 + 34 flush to bottom edge
        assertTrue(geo.fillPath.endsWith('L 390,100 L 0,100 Z'));
      }
    );

    itCase(
      'TC-6.2: Generates symmetrical S-curve Bezier cutout dipping under the center + FAB button',
      () => {
        const geo = buildSmoothBezierCradleGeometry({
          width: 400,
          safeBottomInset: 0,
          barContentHeight: 66,
          cradleHalfWidth: 58,
          cradleDepth: 36,
        });

        assertEqual(geo.centerX, 200);
        // Verify the Bezier curve reaches exact depth 36 at center X = 200
        assertTrue(
          geo.topStrokePath.includes('200,36'),
          'Top contour must dip to (centerX=200, depth=36)'
        );
        // Top stroke path must not close along the bottom edge (prevents bottom border/shadow line)
        assertTrue(!geo.topStrokePath.endsWith('Z'));
      }
    );
  }
);

describeSuite(
  'Sprint 7: Official MacqHR Concept A ("People + M Crown") Logo Specification',
  () => {
    itCase(
      'TC-7.1: Enforces Concept A ("People + M Crown") strict Macquires brand colors in Light & Dark modes',
      () => {
        const lightSpec = getMacqLogoSpec(false);
        const darkSpec = getMacqLogoSpec(true);

        assertEqual(lightSpec.conceptId, 'CONCEPT_A_PEOPLE_M_CROWN');
        assertEqual(lightSpec.colors.badgeBackground, MACQUIRES_PALETTE.prussianBlue);
        assertEqual(darkSpec.colors.badgeBackground, MACQUIRES_PALETTE.oxfordBlue);
        assertEqual(lightSpec.colors.badgeBorder, MACQUIRES_PALETTE.indigoDye);
        assertEqual(lightSpec.colors.accentOrange, MACQUIRES_PALETTE.orangePantone);
        assertEqual(lightSpec.colors.mStroke, MACQUIRES_PALETTE.white);
      }
    );

    itCase(
      'TC-7.2: Generates valid vector geometry for Concept A M-pillars, human apex node, and base verification bar',
      () => {
        const spec = getMacqLogoSpec(false);

        assertEqual(spec.viewBox, '0 0 48 48');
        assertEqual(spec.humanApexCircle.cx, 24);
        assertEqual(spec.humanApexCircle.cy, 12.5);
        assertEqual(spec.humanApexCircle.fill, MACQUIRES_PALETTE.orangePantone);
        assertTrue(spec.mPillarsPath.startsWith('M9 36V16'));
        assertEqual(spec.baseVerificationBarPath, 'M16 39H32');
      }
    );
  }
);

describeSuite(
  'Sprint 8: Option A Executive Sidebar Drawer & Live Profile Editor (Avatar, Name & Phone)',
  () => {
    const baseProfile: EditableEmployeeProfile = {
      id: 'EMP-1042',
      firstName: 'Rahaf',
      firstNameAr: 'رهف',
      fullName: 'Rahaf Al-Mansoor',
      fullNameAr: 'رهف المنصور',
      title: 'Senior People Operations Lead',
      titleAr: 'قائد عمليات الموارد البشرية أول',
      department: 'Human Resources & Culture',
      departmentAr: 'الموارد البشرية والثقافة المؤسسية',
      branch: 'Riyadh HQ • Kingdom of Saudi Arabia',
      email: 'rahaf.almansoor@macquires.com',
      phone: '+966 50 482 9104',
      manager: 'Tariq Al-Otaibi',
      joinDate: '14 Mar, 2022',
      gosiNumber: '4920184421',
      iban: 'SA44 8000 0000 6080 1016 7519',
      avatarInitials: 'RA',
      avatarPresetId: 'navy',
      avatarColor: MACQUIRES_PALETTE.prussianBlue,
    };

    itCase(
      'TC-8.1: Updates full name, first name, phone number, and avatar preset live when saving in Option A Sidebar',
      () => {
        const res = validateAndApplyProfileChanges(baseProfile, {
          fullName: 'Talha Jutt',
          phone: '+966 55 901 2233',
          avatarPresetId: 'orange',
        });

        assertEqual(res.valid, true);
        assertEqual(res.updatedProfile.fullName, 'Talha Jutt');
        assertEqual(res.updatedProfile.firstName, 'Talha');
        assertEqual(res.updatedProfile.avatarInitials, 'TJ');
        assertEqual(res.updatedProfile.phone, '+966 55 901 2233');
        assertEqual(res.updatedProfile.avatarPresetId, 'orange');
        assertEqual(res.updatedProfile.avatarColor, MACQUIRES_PALETTE.orangePantone);
      }
    );

    itCase(
      'TC-8.2: Rejects invalid or empty full name and preserves existing profile state',
      () => {
        const res = validateAndApplyProfileChanges(baseProfile, {
          fullName: ' ',
          phone: '+966 50 482 9104',
        });

        assertEqual(res.valid, false);
        assertEqual(res.error, 'EMPTY_NAME');
        assertEqual(res.updatedProfile.fullName, 'Rahaf Al-Mansoor');
      }
    );

    itCase(
      'TC-8.3: Automatically detects country code & flag from typed phone number via libphonenumber-js without extra validation errors',
      () => {
        const sa = detectCountryFromPhoneInput('+966504829104');
        assertEqual(sa.iso2, 'SA');
        assertEqual(sa.dialCode, '+966');
        assertEqual(sa.flag, '🇸🇦');
        assertEqual(sa.controlledValue, '+966 50 482 9104');

        const pk = detectCountryFromPhoneInput('+923001234567');
        assertEqual(pk.iso2, 'PK');
        assertEqual(pk.dialCode, '+92');
        assertEqual(pk.flag, '🇵🇰');

        const ae = detectCountryFromPhoneInput('971509988776');
        assertEqual(ae.iso2, 'AE');
        assertEqual(ae.dialCode, '+971');
        assertEqual(ae.flag, '🇦🇪');

        assertEqual(deriveAvatarInitials('Rakan Al-Otaibi'), 'RA');
        assertEqual(deriveAvatarInitials('Talha'), 'TA');
      }
    );
  }
);

describeSuite(
  'Sprint 9: Frontend Optimization, RBAC Role Filtering & Tiered Skeleton Hydration',
  () => {
    itCase(
      'TC-9.1: Resolves synchronous JWT role permissions & filters unauthorized Dashboard sections at 0ms',
      () => {
        const empSections = getAuthorizedDashboardSections('EMPLOYEE');
        const mgrSections = getAuthorizedDashboardSections('MANAGER');
        const hrSections = getAuthorizedDashboardSections('HR_ADMIN');

        // Employee does not have team_calendar:view ('whos_off' section)
        assertEqual(
          empSections.some((s) => s.id === 'whos_off'),
          false
        );
        assertEqual(empSections.length, 4);

        // Line Manager & HR Admin have team_calendar:view ('whos_off' section)
        assertEqual(
          mgrSections.some((s) => s.id === 'whos_off'),
          true
        );
        assertEqual(mgrSections.length, 5);
        assertEqual(hrSections.length, 5);
        assertTrue(
          resolvePermissionsForRole('HR_ADMIN').includes('gosi_wps:admin')
        );
      }
    );

    itCase(
      'TC-9.2: Filters Quick Action cards by role so Employees only see self-service modules while Managers/HR see Approvals & Directory',
      () => {
        const empActions = filterActionsByRole(INITIAL_ACTIONS, 'EMPLOYEE');
        const mgrActions = filterActionsByRole(INITIAL_ACTIONS, 'MANAGER');

        assertEqual(
          empActions.some((a) => a.id === 'approvals'),
          false
        );
        assertEqual(
          empActions.some((a) => a.id === 'directory'),
          false
        );
        assertEqual(
          mgrActions.some((a) => a.id === 'approvals'),
          true
        );
        assertEqual(
          mgrActions.some((a) => a.id === 'directory'),
          true
        );
      }
    );

    itCase(
      'TC-9.3: Orders progressive skeleton hydration from TIER_1_CORE (<250ms) to TIER_2_ACTIONS to TIER_3_FEED',
      () => {
        const coldMap = createInitialHydrationMap(false);
        const warmMap = createInitialHydrationMap(true);

        assertEqual(coldMap.balances, false);
        assertEqual(warmMap.balances, true);

        const sections = getAuthorizedDashboardSections('MANAGER');
        assertEqual(sections[0].id, 'balances');
        assertEqual(sections[0].tier, 'TIER_1_CORE');
        assertTrue(
          sections[0].simulatedColdLatencyMs <
            sections[1].simulatedColdLatencyMs,
          'Tier 1 Core must hydrate before Tier 2 Actions'
        );
        assertTrue(
          sections[1].simulatedColdLatencyMs <
            sections[2].simulatedColdLatencyMs,
          'Tier 2 Actions must hydrate before Tier 3 Feed'
        );
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
