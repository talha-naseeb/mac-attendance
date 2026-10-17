import { AsYouType, CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js';
import { MACQUIRES_PALETTE } from '../theme/colors';

export type AvatarPresetId = 'navy' | 'orange' | 'indigo' | 'bdazzled' | 'dark';

export interface AvatarPreset {
  id: AvatarPresetId;
  labelEn: string;
  labelAr: string;
  backgroundColor: string;
  ringColor: string;
}

export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  {
    id: 'navy',
    labelEn: 'Prussian Navy',
    labelAr: 'كحلي بروسي',
    backgroundColor: MACQUIRES_PALETTE.prussianBlue,
    ringColor: MACQUIRES_PALETTE.orangePantone,
  },
  {
    id: 'orange',
    labelEn: 'Orange Pantone',
    labelAr: 'برتقالي ماكوايرز',
    backgroundColor: MACQUIRES_PALETTE.orangePantone,
    ringColor: MACQUIRES_PALETTE.white,
  },
  {
    id: 'indigo',
    labelEn: 'Indigo Dye',
    labelAr: 'نيلي داكن',
    backgroundColor: MACQUIRES_PALETTE.indigoDye,
    ringColor: MACQUIRES_PALETTE.orangePantone,
  },
  {
    id: 'bdazzled',
    labelEn: 'Steel Blue',
    labelAr: 'أزرق فولاذي',
    backgroundColor: MACQUIRES_PALETTE.bdazzledBlue,
    ringColor: MACQUIRES_PALETTE.white,
  },
  {
    id: 'dark',
    labelEn: 'Oxford Executive',
    labelAr: 'أكسفورد تنفيذي',
    backgroundColor: MACQUIRES_PALETTE.oxfordBlue,
    ringColor: MACQUIRES_PALETTE.orangePantone,
  },
] as const;

export interface DetectedPhoneState {
  iso2: CountryCode;
  dialCode: string;
  flag: string;
  controlledValue: string;
}

/**
 * Converts any ISO 3166-1 alpha-2 code (e.g. 'SA', 'PK', 'AE', 'US') into its Unicode flag emoji.
 */
export function iso2ToFlagEmoji(iso2?: string): string {
  if (!iso2 || iso2.length !== 2) return '🇸🇦';
  return iso2
    .toUpperCase()
    .replace(/./g, (char) =>
      String.fromCodePoint(127397 + char.charCodeAt(0))
    );
}

// Primary country for shared calling codes (e.g. +1 -> US, +44 -> GB, +7 -> RU)
const CALLING_CODE_PRIMARY_ISO2: Record<string, CountryCode> = {
  '1': 'US',
  '7': 'RU',
  '20': 'EG',
  '27': 'ZA',
  '33': 'FR',
  '34': 'ES',
  '39': 'IT',
  '44': 'GB',
  '49': 'DE',
  '60': 'MY',
  '61': 'AU',
  '62': 'ID',
  '63': 'PH',
  '81': 'JP',
  '82': 'KR',
  '86': 'CN',
  '90': 'TR',
  '91': 'IN',
  '92': 'PK',
  '961': 'LB',
  '962': 'JO',
  '963': 'SY',
  '964': 'IQ',
  '965': 'KW',
  '966': 'SA',
  '967': 'YE',
  '968': 'OM',
  '971': 'AE',
  '973': 'BH',
  '974': 'QA',
};

/**
 * Uses `libphonenumber-js` (`AsYouType` & `parsePhoneNumberFromString`) to automatically
 * detect the country code, render the country flag, and format the phone number as the user types.
 */
export function detectCountryFromPhoneInput(
  rawInput: string,
  defaultCountry: CountryCode = 'SA'
): DetectedPhoneState {
  const cleaned = rawInput.replace(/[^\d+]/g, '');

  if (!cleaned) {
    return {
      iso2: defaultCountry,
      dialCode: '+966',
      flag: iso2ToFlagEmoji(defaultCountry),
      controlledValue: '',
    };
  }

  // Ensure leading '+' so libphonenumber-js AsYouType automatically detects international calling codes
  const normalizedInput = cleaned.startsWith('+')
    ? cleaned
    : cleaned.startsWith('00')
    ? '+' + cleaned.slice(2)
    : '+' + cleaned;

  const typer = new AsYouType(defaultCountry);
  const formatted = typer.input(normalizedInput);
  const callingCode = typer.getCallingCode();
  const parsed = parsePhoneNumberFromString(normalizedInput, defaultCountry);

  const detectedIso2: CountryCode =
    typer.getCountry() ??
    parsed?.country ??
    (callingCode ? CALLING_CODE_PRIMARY_ISO2[callingCode] : undefined) ??
    defaultCountry;

  const dialCode = callingCode ? `+${callingCode}` : '+966';

  return {
    iso2: detectedIso2,
    dialCode,
    flag: iso2ToFlagEmoji(detectedIso2),
    controlledValue: formatted || normalizedInput,
  };
}

export interface EditableEmployeeProfile {
  id: string;
  firstName: string;
  firstNameAr: string;
  fullName: string;
  fullNameAr: string;
  title: string;
  titleAr: string;
  department: string;
  departmentAr: string;
  branch: string;
  email: string;
  phone: string;
  manager: string;
  joinDate: string;
  gosiNumber: string;
  iban: string;
  avatarInitials: string;
  avatarPresetId: AvatarPresetId;
  avatarColor: string;
}

export interface ProfileUpdateDraft {
  fullName?: string;
  fullNameAr?: string;
  phone?: string;
  avatarPresetId?: AvatarPresetId;
}

export interface ProfileUpdateResult {
  valid: boolean;
  error?: 'EMPTY_NAME';
  updatedProfile: EditableEmployeeProfile;
  detectedPhone: DetectedPhoneState;
}

export function deriveAvatarInitials(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  if (parts.length === 0) return 'MQ';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const first = parts[0][0] ?? 'M';
  const last = parts[parts.length - 1][0] ?? 'Q';
  return `${first}${last}`.toUpperCase();
}

export function deriveFirstName(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  return parts[0] ?? fullName.trim();
}

export function getAvatarPresetById(id: AvatarPresetId): AvatarPreset {
  return AVATAR_PRESETS.find((p) => p.id === id) ?? AVATAR_PRESETS[0];
}

export function validateAndApplyProfileChanges(
  current: EditableEmployeeProfile,
  draft: ProfileUpdateDraft
): ProfileUpdateResult {
  const nextFullName =
    draft.fullName !== undefined ? draft.fullName.trim() : current.fullName;
  const detectedPhone = detectCountryFromPhoneInput(
    draft.phone !== undefined ? draft.phone : current.phone
  );

  if (nextFullName.length < 2) {
    return {
      valid: false,
      error: 'EMPTY_NAME',
      updatedProfile: current,
      detectedPhone,
    };
  }

  const nextPhone = detectedPhone.controlledValue.trim() || current.phone;

  const nextFullNameAr =
    draft.fullNameAr !== undefined && draft.fullNameAr.trim().length > 0
      ? draft.fullNameAr.trim()
      : current.fullNameAr;

  const nextPresetId = draft.avatarPresetId ?? current.avatarPresetId;
  const preset = getAvatarPresetById(nextPresetId);

  const updatedProfile: EditableEmployeeProfile = {
    ...current,
    fullName: nextFullName,
    firstName: deriveFirstName(nextFullName),
    fullNameAr: nextFullNameAr,
    firstNameAr: deriveFirstName(nextFullNameAr),
    phone: nextPhone,
    avatarInitials: deriveAvatarInitials(nextFullName),
    avatarPresetId: preset.id,
    avatarColor: preset.backgroundColor,
  };

  return {
    valid: true,
    updatedProfile,
    detectedPhone,
  };
}
