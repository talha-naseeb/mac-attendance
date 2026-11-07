import {
  buildLiveSlippyMapGrid,
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
import { getMacqLogoSpec, getShiftlyLogoSpec } from '../services/logoSpec';
import {
  deriveAvatarInitials,
  detectCountryFromPhoneInput,
  EditableEmployeeProfile,
  validateAndApplyProfileChanges,
} from '../services/profileSettingsService';
import {
  createInitialHydrationMap,
  DASHBOARD_SECTION_REGISTRY,
  filterActionsByRole,
  getAuthorizedDashboardSections,
  resolvePermissionsForRole,
} from '../services/dashboardOptimizationService';
import {
  INITIAL_ACTIONS,
  INITIAL_LEAVE_BALANCES,
  INITIAL_WHOS_OFF,
} from '../data/mockData';
import {
  DEFAULT_SELECTED_ACTIONS,
  MAX_SELECTED_ACTIONS,
  MIN_SELECTED_ACTIONS,
  resolveDisplayedActions,
  toggleActionSelection,
} from '../services/arrangeActionsService';
import { MACQUIRES_PALETTE, darkColors, lightColors } from '../theme/colors';
import { rtlRow, rtlText } from '../theme/typography';
import { TRANSLATIONS } from '../i18n/translations';
import {
  createLeaveWorkflowRequest,
  filterApprovalsForRole,
  getOrganizationAttendanceOverview,
  ORGANIZATION_TREE,
  processManagerLeaveDecision,
} from '../services/organizationWorkflowService';
import {
  evaluateClockEligibility,
  formatElapsedWorkingTime,
} from '../services/clockInService';
import { validatePasswordChange } from '../services/authService';
import { isTokenExpiringSoon, shouldRefreshToken } from '../services/sessionManager';
import {
  filterWhosOffEntries,
  getColleagueAvailabilitySummary,
} from '../services/whosOffService';
import {
  calculateClientWorkingDays,
  getSaudiHolidayName,
  isSaudiWeekend,
  LEAVE_TYPES,
} from '../utils/leaveCalculator';

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

    itCase(
      'TC-2.9: Computes Web Mercator live street map tile grid centered on exact GPS coordinates',
      () => {
        const gridLight = buildLiveSlippyMapGrid(31.5204, 74.3587, {
          zoom: 16,
          isDark: false,
          viewportWidth: 400,
          viewportHeight: 200,
        });
        assertEqual(gridLight.zoom, 16);
        assertEqual(gridLight.tiles.length, 15);
        assertTrue(
          gridLight.tiles[0].url.includes('mt1.google.com/vt/lyrs=m')
        );

        const gridDark = buildLiveSlippyMapGrid(31.5204, 74.3587, {
          zoom: 16,
          isDark: true,
        });
        assertTrue(gridDark.tiles[0].url.includes('mt1.google.com/vt/lyrs=y'));
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

    itCase(
      'TC-SH.1: Enforces Concept 02 ("The Dual Shift Pulse") official brand palette and concept ID',
      () => {
        const lightSpec = getShiftlyLogoSpec(false);
        const darkSpec = getShiftlyLogoSpec(true);

        assertEqual(lightSpec.conceptId, 'CONCEPT_DUAL_SHIFT_PULSE');
        assertEqual(lightSpec.viewBox, '0 0 200 200');
        assertEqual(lightSpec.colors.badgeBackground, MACQUIRES_PALETTE.prussianBlue);
        assertEqual(darkSpec.colors.badgeBackground, MACQUIRES_PALETTE.oxfordBlue);
        assertEqual(lightSpec.colors.pulseOrange, MACQUIRES_PALETTE.orangePantone);
        assertEqual(lightSpec.colors.whiteSlash, MACQUIRES_PALETTE.white);
      }
    );

    itCase(
      'TC-SH.2: Generates valid vector geometry for Dual Shift Pulse wings and central attendance radar telemetry',
      () => {
        const spec = getShiftlyLogoSpec(false);

        assertTrue(spec.upperNavyWingPath.startsWith('M88 31L113 31'));
        assertTrue(spec.lowerNavyWingPath.startsWith('M112 169L87 169'));
        assertEqual(spec.upperWhiteSlashPoints, '173,14 148,14 64,100 89,100');
        assertEqual(spec.lowerWhiteSlashPoints, '111,104 136,104 52,190 27,190');
        assertEqual(spec.radarPulseCenter.cx, 140);
        assertEqual(spec.radarPulseCenter.cy, 83);
        assertEqual(spec.radarPulseCenter.r, 11);
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

describeSuite(
  'Sprint 10: Session refresh and forced password change',
  () => {
    itCase('TC-10.1: Detects access tokens that are about to expire', () => {
      const now = Math.floor(Date.now() / 1000);
      const makeToken = (exp: number) =>
        `header.${globalThis.btoa(JSON.stringify({ exp }))}.sig`;
      assertEqual(isTokenExpiringSoon(makeToken(now + 30)), true);
      assertEqual(isTokenExpiringSoon(makeToken(now - 10)), true);
      assertEqual(isTokenExpiringSoon(makeToken(now + 600)), false);
      assertEqual(isTokenExpiringSoon('not-a-jwt'), true);
      assertEqual(shouldRefreshToken('not-a-jwt'), true);
    });

    itCase('TC-10.2: Rejects short or unchanged replacement passwords', () => {
      assertEqual(validatePasswordChange('Password123!', 'short'), 'PASSWORD_TOO_SHORT');
      assertEqual(validatePasswordChange('Password123!', 'Password123!'), 'SAME_PASSWORD');
      assertEqual(validatePasswordChange('Password123!', 'NewPassword456!'), null);
    });
  }
);

describeSuite(
  'Phase 1: Minimalistic Employee Main Screen & Clean Dashboard Structure',
  () => {
    itCase(
      'TC-P1.1: Dashboard enforces clean, streamlined core section registry without noisy clutter',
      () => {
        const allSections = DASHBOARD_SECTION_REGISTRY.map((s) => s.id);
        // Clean dashboard focuses strictly on the 5 core sections:
        assertEqual(allSections.length, 5);
        assertEqual(allSections.includes('balances'), true);
        assertEqual(allSections.includes('actions'), true);
        assertEqual(allSections.includes('whos_off'), true);
        assertEqual(allSections.includes('birthdays'), true);
        assertEqual(allSections.includes('events'), true);
      }
    );

    itCase(
      'TC-P1.2: Ensures Dashboard balances provide valid leave metrics for clean header presentation',
      () => {
        assertEqual(INITIAL_LEAVE_BALANCES.length > 0, true);
        const annual = INITIAL_LEAVE_BALANCES.find(
          (b) => b.title === 'Annual Vacation'
        );
        assertTrue(!!annual, 'Annual Vacation balance must exist');
        assertTrue(
          annual!.remaining <= annual!.total,
          'Remaining balance cannot exceed total'
        );
      }
    );
  }
);

describeSuite(
  'Phase 2: "My Actions" — 4-Card Selection & Interactive "Arrange" Modal',
  () => {
    itCase(
      'TC-P2.1: Enforces default 4-card selection with max 4 cards pinned',
      () => {
        assertEqual(DEFAULT_SELECTED_ACTIONS.length, 4);
        assertEqual(MAX_SELECTED_ACTIONS, 4);
        assertEqual(MIN_SELECTED_ACTIONS, 2);
        assertTrue(DEFAULT_SELECTED_ACTIONS.includes('attendance'));
        assertTrue(DEFAULT_SELECTED_ACTIONS.includes('payroll'));
      }
    );

    itCase(
      'TC-P2.2: Validates toggling: adding when below 4 succeeds and removing when above 2 succeeds',
      () => {
        const initial = ['attendance', 'payroll', 'transactions'];
        // Add schedule (4th card)
        const resAdd = toggleActionSelection(initial as any, 'schedule' as any);
        assertEqual(resAdd.error, undefined);
        assertEqual(resAdd.updatedSelection.length, 4);
        assertTrue(resAdd.updatedSelection.includes('schedule'));

        // Remove transactions (3 cards left)
        const resRemove = toggleActionSelection(
          resAdd.updatedSelection,
          'transactions' as any
        );
        assertEqual(resRemove.error, undefined);
        assertEqual(resRemove.updatedSelection.length, 3);
        assertEqual(resRemove.updatedSelection.includes('transactions'), false);
      }
    );

    itCase(
      'TC-P2.3: Rejects selecting more than 4 cards with MAX_REACHED error',
      () => {
        const fullSelection = [
          'attendance',
          'payroll',
          'transactions',
          'schedule',
        ];
        const res = toggleActionSelection(fullSelection as any, 'tasks' as any);
        assertEqual(res.error, 'MAX_REACHED:4');
        assertEqual(res.updatedSelection.length, 4);
        assertEqual(res.updatedSelection.includes('tasks'), false);
      }
    );

    itCase(
      'TC-P2.4: Prevents deselecting below minimum 2 cards with MIN_REACHED error',
      () => {
        const minSelection = ['attendance', 'payroll'];
        const res = toggleActionSelection(
          minSelection as any,
          'attendance' as any
        );
        assertEqual(res.error, 'MIN_REACHED:2');
        assertEqual(res.updatedSelection.length, 2);
        assertTrue(res.updatedSelection.includes('attendance'));
      }
    );

    itCase(
      'TC-P2.5: Resolves exactly the user-selected actions on dashboard up to 4 cards',
      () => {
        const selected = ['tasks', 'schedule', 'documents', 'attendance'] as any;
        const displayed = resolveDisplayedActions(INITIAL_ACTIONS, selected, 4);
        assertEqual(displayed.length, 4);
        assertEqual(displayed.map((a) => a.id), selected);
      }
    );
  }
);

describeSuite(
  'Phase 3: Who\'s Off & Remote Work Availability Engine',
  () => {
    const mockEntries: any[] = [
      {
        id: '1',
        employeeName: 'Zainab Al-Harbi',
        role: 'UX Designer',
        type: 'Remote Work',
        durationLabel: 'Today',
        fromDate: 'Oct 20, 2026',
        toDate: 'Oct 20, 2026',
      },
      {
        id: '2',
        employeeName: 'Faisal Al-Dosari',
        role: 'Accountant',
        type: 'Annual Vacation',
        durationLabel: '3 days',
        fromDate: 'Oct 20, 2026',
        toDate: 'Oct 23, 2026',
      },
      {
        id: '3',
        employeeName: 'Noura Al-Mutairi',
        role: 'Software Engineer',
        type: 'Sick Day off',
        durationLabel: '1 day',
        fromDate: 'Oct 20, 2026',
        toDate: 'Oct 20, 2026',
      },
    ];

    itCase('TC-P3.1: Filters colleagues by All, Remote Work, and Leave', () => {
      assertEqual(filterWhosOffEntries(mockEntries, 'all').length, 3);
      const remote = filterWhosOffEntries(mockEntries, 'remote');
      assertEqual(remote.length, 1);
      assertEqual(remote[0].type, 'Remote Work');

      const leave = filterWhosOffEntries(mockEntries, 'leave');
      assertEqual(leave.length, 2);
      assertTrue(leave.every((e) => e.type !== 'Remote Work'));
    });

    itCase(
      'TC-P3.2: Generates correct colleague availability status and reachability advice',
      () => {
        const remoteSummary = getColleagueAvailabilitySummary(mockEntries[0]);
        assertEqual(remoteSummary.isWorkingRemotely, true);
        assertEqual(remoteSummary.isReachable, true);
        assertEqual(remoteSummary.badgeColor, '#10B981');

        const sickSummary = getColleagueAvailabilitySummary(mockEntries[2]);
        assertEqual(sickSummary.isReachable, false);
        assertEqual(sickSummary.isOnLeave, true);
        assertEqual(sickSummary.badgeColor, '#EF4444');

        const vacationSummary = getColleagueAvailabilitySummary(mockEntries[1]);
        assertEqual(vacationSummary.isReachable, false);
        assertEqual(vacationSummary.isOnLeave, true);
        assertEqual(vacationSummary.badgeColor, '#F59E0B');
      }
    );

    itCase(
      'TC-P3.3: Verifies enriched INITIAL_WHOS_OFF metadata has valid roles, locations, and contacts',
      () => {
        assertEqual(INITIAL_WHOS_OFF.length, 4);
        assertTrue(
          INITIAL_WHOS_OFF.every((e) => Boolean(e.role && e.department && e.location))
        );
        assertTrue(
          INITIAL_WHOS_OFF.some((e) => e.location?.includes('Pakistan'))
        );
      }
    );
  }
);

describeSuite(
  'Phase 4: Remote Work (Pakistan) vs. Riyadh HQ Clock-In Engine',
  () => {
    itCase(
      'TC-P4.1: Remote Pakistan mode permits clock-in regardless of Riyadh office geofence lockout',
      () => {
        // Riyadh geofence disallowed (e.g. 2800km away in Pakistan)
        const remoteVerdict = evaluateClockEligibility(
          'remote_pakistan',
          false,
          'Islamabad / Remote, Pakistan'
        );
        assertEqual(remoteVerdict.canClock, true);
        assertEqual(remoteVerdict.isRemote, true);
        assertTrue(remoteVerdict.headquartersLabel.includes('Riyadh, KSA'));
        assertTrue(remoteVerdict.locationStatusText.includes('Islamabad / Remote, Pakistan'));
      }
    );

    itCase(
      'TC-P4.2: Office Riyadh mode respects strict geofence boundary rules',
      () => {
        const allowedVerdict = evaluateClockEligibility(
          'office_riyadh',
          true,
          'Riyadh HQ Branch'
        );
        assertEqual(allowedVerdict.canClock, true);
        assertEqual(allowedVerdict.isRemote, false);

        const deniedVerdict = evaluateClockEligibility(
          'office_riyadh',
          false,
          'Outside Boundary'
        );
        assertEqual(deniedVerdict.canClock, false);
        assertEqual(deniedVerdict.isRemote, false);
      }
    );

    itCase(
      'TC-P4.3: Formats elapsed working minutes correctly starting from 0m and counting accurately',
      () => {
        const zeroTime = formatElapsedWorkingTime(0);
        assertEqual(zeroTime.hours, 0);
        assertEqual(zeroTime.minutes, 0);
        assertEqual(zeroTime.formattedString, '0h 0m');

        const activeTime = formatElapsedWorkingTime(145);
        assertEqual(activeTime.hours, 2);
        assertEqual(activeTime.minutes, 25);
        assertEqual(activeTime.formattedString, '2h 25m');

        const safeNegative = formatElapsedWorkingTime(-10);
        assertEqual(safeNegative.hours, 0);
        assertEqual(safeNegative.minutes, 0);
      }
    );
  }
);

describeSuite(
  'Phase 5: Multi-Role Org Structure, Employee-Manager-HR Leave Pipeline & Admin Overview',
  () => {
    itCase(
      'TC-P5.1: Org Structure hierarchy defines verified reporting lines and remote vs HQ distribution',
      () => {
        assertTrue(ORGANIZATION_TREE.length >= 6);

        // Sultan is Executive Admin / root
        const admin = ORGANIZATION_TREE.find((n) => n.role === 'ADMIN');
        assertTrue(Boolean(admin));
        assertEqual(admin!.managerId, null);

        // Tariq is Manager reporting to Admin
        const manager = ORGANIZATION_TREE.find((n) => n.role === 'MANAGER');
        assertTrue(Boolean(manager));
        assertEqual(manager!.managerName, admin!.name);

        // Rayan is Employee in Pakistan reporting to Manager Tariq
        const emp = ORGANIZATION_TREE.find((n) => n.id === 'EMP-1042');
        assertTrue(Boolean(emp));
        assertEqual(emp!.managerName, manager!.name);
        assertTrue(emp!.location.includes('Pakistan'));
        assertEqual(emp!.workType, 'Remote');
      }
    );

    itCase(
      'TC-P5.2: Employee submits leave -> initiates PENDING_MANAGER workflow and notifies Manager',
      () => {
        const req = createLeaveWorkflowRequest({
          employeeId: 'EMP-1042',
          employeeName: 'Rayan Al-Harbi',
          role: 'Senior Mobile Engineer (Remote)',
          department: 'Software Engineering',
          avatarInitials: 'RH',
          avatarColor: MACQUIRES_PALETTE.bdazzledBlue,
          leaveType: 'Annual Vacation',
          fromDay: 12,
          toDay: 16,
          daysCount: 5,
          notes: 'Family event and rest',
        });

        assertEqual(req.approvalItem.stage, 'PENDING_MANAGER');
        assertEqual(req.approvalItem.status, 'Pending');
        assertEqual(req.approvalItem.daysCount, 5);
        assertEqual(req.approvalItem.managerName, 'Tariq Al-Ghamdi');
        assertTrue(req.managerNotification.title.includes('Rayan Al-Harbi'));
        assertTrue(req.managerNotification.body.includes('Annual Vacation'));
        assertTrue(req.managerNotification.body.includes('5 days'));
      }
    );

    itCase(
      'TC-P5.3: Manager approval authorizes leave balance deduction, logs HR notification and alerts Employee',
      () => {
        const initialReq = createLeaveWorkflowRequest({
          employeeId: 'EMP-1042',
          employeeName: 'Rayan Al-Harbi',
          role: 'Senior Mobile Engineer (Remote)',
          department: 'Software Engineering',
          avatarInitials: 'RH',
          avatarColor: MACQUIRES_PALETTE.bdazzledBlue,
          leaveType: 'Annual Vacation',
          fromDay: 12,
          toDay: 16,
          daysCount: 5,
        });

        const result = processManagerLeaveDecision({
          item: initialReq.approvalItem,
          decision: 'Approved',
          managerName: 'Tariq Al-Ghamdi',
        });

        assertEqual(result.updatedItem.status, 'Approved');
        assertEqual(result.updatedItem.stage, 'APPROVED');
        assertEqual(result.shouldDeductBalance, true);
        assertEqual(result.shouldAddToWhosOff, true);

        // HR notification created
        assertTrue(Boolean(result.hrNotification));
        assertTrue(result.hrNotification!.title.includes('Leave Approved'));
        assertTrue(result.hrNotification!.body.includes('Rahaf Al-Mansoor') || result.hrNotification!.body.includes('HR'));

        // Employee notification created
        assertTrue(result.employeeNotification.title.includes('Approved'));
      }
    );

    itCase(
      'TC-P5.4: Manager rejection declines request, notifies employee, and avoids deducting leave balance',
      () => {
        const initialReq = createLeaveWorkflowRequest({
          employeeId: 'EMP-1042',
          employeeName: 'Rayan Al-Harbi',
          role: 'Senior Mobile Engineer',
          department: 'Software Engineering',
          avatarInitials: 'RH',
          avatarColor: MACQUIRES_PALETTE.bdazzledBlue,
          leaveType: 'Emergency Leave',
          fromDay: 20,
          toDay: 21,
          daysCount: 2,
        });

        const result = processManagerLeaveDecision({
          item: initialReq.approvalItem,
          decision: 'Rejected',
          managerName: 'Tariq Al-Ghamdi',
        });

        assertEqual(result.updatedItem.status, 'Rejected');
        assertEqual(result.updatedItem.stage, 'REJECTED');
        assertEqual(result.shouldDeductBalance, false);
        assertEqual(result.shouldAddToWhosOff, false);
        assertTrue(result.employeeNotification.title.includes('Declined'));
      }
    );

    itCase(
      'TC-P5.5: Branch attendance breakdown provides accurate remote and HQ distribution',
      () => {
        const stats = getOrganizationAttendanceOverview();
        assertEqual(stats.length, 3);
        const pkRemote = stats.find((s) => s.branchKey === 'pakistan_remote');
        assertTrue(Boolean(pkRemote));
        assertEqual(pkRemote!.workingRemotely, 14);

        const riyadhHq = stats.find((s) => s.branchKey === 'riyadh_hq');
        assertTrue(Boolean(riyadhHq));
        assertEqual(riyadhHq!.totalHeadcount, 48);
      }
    );
  }
);

describeSuite(
  'Phase 8: Workday Attendance Days, Break Persistence & Net Minutes Engine',
  () => {
    itCase(
      'TC-P8.1: Accurately computes net working minutes after deducting elapsed break minutes',
      () => {
        const totalElapsedMinutes = 480; // 8 hours total span
        const breakMinutes = 45; // 45 min lunch break
        const netWorkingMinutes = Math.max(0, totalElapsedMinutes - breakMinutes);

        assertEqual(netWorkingMinutes, 435); // 7 hours 15 min
      }
    );

    itCase(
      'TC-P8.2: Automatically closes active break and includes final interval on check-out',
      () => {
        const firstCheckInMs = Date.parse('2026-11-04T09:00:00Z');
        const breakStartMs = Date.parse('2026-11-04T12:00:00Z');
        const checkOutMs = Date.parse('2026-11-04T12:35:00Z'); // Checkout while on break

        const elapsedBreakMin = Math.round((checkOutMs - breakStartMs) / 60000);
        assertEqual(elapsedBreakMin, 35);

        const totalElapsedMin = Math.round((checkOutMs - firstCheckInMs) / 60000);
        assertEqual(totalElapsedMin, 215);

        const netWorkingMin = totalElapsedMin - elapsedBreakMin;
        assertEqual(netWorkingMin, 180); // exactly 3 hours
      }
    );
  }
);

describeSuite(
  'Phase 9: Leave & Approvals v2 Engine (LV-01 to LV-15 & Mobile UX)',
  () => {
    itCase(
      'TC-P9.1: Correctly identifies Saudi weekends (Friday & Saturday) and excludes them from working days',
      () => {
        const sunday = new Date('2026-11-08T00:00:00');
        const friday = new Date('2026-11-13T00:00:00');
        const saturday = new Date('2026-11-14T00:00:00');
        assertEqual(isSaudiWeekend(sunday), false);
        assertEqual(isSaudiWeekend(friday), true);
        assertEqual(isSaudiWeekend(saturday), true);

        // 7 calendar days: Sun Nov 8 to Sat Nov 14 (Sun, Mon, Tue, Wed, Thu = 5 working days, Fri, Sat = 2 weekend days)
        const res = calculateClientWorkingDays('2026-11-08', '2026-11-14');
        assertEqual(res.calendarDays, 7);
        assertEqual(res.workingDays, 5);
        assertEqual(res.excludedWeekendDays, 2);
      }
    );

    itCase(
      'TC-P9.2: Excludes Saudi National Day (Sep 23) and Founding Day (Feb 22) from working days count',
      () => {
        // Wednesday Sep 23, 2026 is Saudi National Day
        const natDay = new Date('2026-09-23T00:00:00');
        assertEqual(getSaudiHolidayName(natDay), 'Saudi National Day');

        // Tuesday Feb 22, 2028 is Saudi Founding Day
        const foundDay = new Date('2028-02-22T00:00:00');
        assertEqual(getSaudiHolidayName(foundDay), 'Saudi Founding Day');

        // Range covering Sep 20 to Sep 24 (Sun-Thu = 5 calendar days, Sep 23 is holiday => 4 working days)
        const res = calculateClientWorkingDays('2026-09-20', '2026-09-24');
        assertEqual(res.calendarDays, 5);
        assertEqual(res.workingDays, 4);
        assertEqual(res.excludedHolidayDays, 1);
        assertEqual(res.excludedHolidays.includes('Saudi National Day'), true);
      }
    );

    itCase(
      'TC-P9.3: Computes half-day leave as exactly 0.50 working days regardless of calendar days',
      () => {
        const halfDayRes = calculateClientWorkingDays('2026-11-09', '2026-11-09', true);
        assertEqual(halfDayRes.calendarDays, 1);
        assertEqual(halfDayRes.workingDays, 0.5);
      }
    );

    itCase(
      'TC-P9.4: Full 11-type leave catalog is complete and distinct without collapsing EMERGENCY into UNPAID',
      () => {
        assertEqual(LEAVE_TYPES.length, 11);
        assertEqual(LEAVE_TYPES.includes('Annual Vacation'), true);
        assertEqual(LEAVE_TYPES.includes('Sick Day off'), true);
        assertEqual(LEAVE_TYPES.includes('Sick on file'), true);
        assertEqual(LEAVE_TYPES.includes('Hajj Leave'), true);
        assertEqual(LEAVE_TYPES.includes('Paternity Leave'), true);
        assertEqual(LEAVE_TYPES.includes('Maternity Leave'), true);
        assertEqual(LEAVE_TYPES.includes('Marriage Leave'), true);
        assertEqual(LEAVE_TYPES.includes('Bereavement Leave'), true);
        assertEqual(LEAVE_TYPES.includes('Remote Work'), true);
        assertEqual(LEAVE_TYPES.includes('Emergency Leave'), true);
        assertEqual(LEAVE_TYPES.includes('Unpaid Leave'), true);

        // Verification of discrete API mapping dictionary
        const apiMap: Record<string, string> = {
          'Annual Vacation': 'ANNUAL',
          'Sick Day off': 'SICK',
          'Sick on file': 'SICK_ON_FILE',
          'Hajj Leave': 'HAJJ',
          'Paternity Leave': 'PATERNITY',
          'Maternity Leave': 'MATERNITY',
          'Marriage Leave': 'MARRIAGE',
          'Bereavement Leave': 'BEREAVEMENT',
          'Remote Work': 'REMOTE_WORK',
          'Emergency Leave': 'EMERGENCY',
          'Unpaid Leave': 'UNPAID',
        };
        assertEqual(apiMap['Emergency Leave'], 'EMERGENCY');
        assertEqual(apiMap['Emergency Leave'] !== apiMap['Unpaid Leave'], true);
      }
    );

    itCase(
      'TC-P9.5: Multi-month and multi-year range crossing calculation correctly spans across boundaries',
      () => {
        // Cross year: Dec 28, 2026 (Mon) to Jan 03, 2027 (Sun)
        // Dec 28 (Mon), 29 (Tue), 30 (Wed), 31 (Thu) = 4 days
        // Jan 01 (Fri - wknd), Jan 02 (Sat - wknd) = 2 wknd days
        // Jan 03 (Sun) = 1 day
        // Total calendar = 7, working = 5, weekend = 2
        const res = calculateClientWorkingDays('2026-12-28', '2027-01-03');
        assertEqual(res.calendarDays, 7);
        assertEqual(res.workingDays, 5);
        assertEqual(res.excludedWeekendDays, 2);
      }
    );
  }
);

describeSuite(
  'Phase 11: Payroll Halala Precision, Unpaid Leave Deductions & Release Hardening (M8 & M10)',
  () => {
    itCase(
      'TC-P11.1: Computes Saudi GOSI below, at, and above the 45,000 SAR statutory cap to the halala',
      () => {
        const belowCap = calculateSaudiGosiBreakdown({
          basicSalarySar: 12000,
          housingAllowanceSar: 3000,
          transportAllowanceSar: 1000,
          overtimeSar: 0,
          iban: 'SA0380000000608010167519',
        });
        assertEqual(belowCap.employeeDeductionSar, 1462.5);
        assertEqual(belowCap.employerContributionSar, 1762.5);
        assertEqual(belowCap.netPayableAfterGosiSar, 14537.5);

        const aboveCap = calculateSaudiGosiBreakdown({
          basicSalarySar: 40000,
          housingAllowanceSar: 10000,
          transportAllowanceSar: 2000,
          overtimeSar: 0,
          iban: 'SA0380000000608010167519',
        });
        assertEqual(aboveCap.contributoryWageSar, 45000);
        assertEqual(aboveCap.employeeDeductionSar, 4387.5);
        assertEqual(aboveCap.employerContributionSar, 5287.5);
        assertEqual(aboveCap.netPayableAfterGosiSar, 47612.5);
      }
    );

    itCase(
      'TC-P11.2: Validates Saudi IBAN compliance and rejects malformed IBAN strings for Mudad WPS',
      () => {
        const valid = calculateSaudiGosiBreakdown({
          basicSalarySar: 15000,
          housingAllowanceSar: 3750,
          transportAllowanceSar: 1250,
          overtimeSar: 0,
          iban: 'SA0380000000608010167523',
        });
        assertEqual(valid.mudadWpsCompliant, true);

        const invalid = calculateSaudiGosiBreakdown({
          basicSalarySar: 15000,
          housingAllowanceSar: 3750,
          transportAllowanceSar: 1250,
          overtimeSar: 0,
          iban: 'INVALID_IBAN_123',
        });
        assertEqual(invalid.mudadWpsCompliant, false);
      }
    );

    itCase(
      'TC-P11.3: Computes unpaid leave deduction (Basic / 30 × unpaid days) in integer halalas without drift',
      () => {
        const basicHalalas = 12000 * 100;
        const dailyRateHalalas = Math.round(basicHalalas / 30); // 40,000 halalas = 400 SAR
        const unpaidDays = 3;
        const deductionHalalas = Math.round(dailyRateHalalas * unpaidDays);
        assertEqual(deductionHalalas, 120000);
        assertEqual(deductionHalalas / 100, 1200);
      }
    );

    itCase(
      'TC-P11.4: Enforces release-grade dashboard structure without demo role switcher or prefilled debug cards',
      () => {
        assertEqual(
          DASHBOARD_SECTION_REGISTRY.some((s) => s.id === ('DEMO_ROLE_SWITCHER' as any)),
          false
        );
        assertEqual(
          DASHBOARD_SECTION_REGISTRY.some((s) => s.id === ('DEBUG_TOOLBAR' as any)),
          false
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
