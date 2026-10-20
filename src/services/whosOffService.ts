import { WhosOffEntry } from '../types/zenhr';

export type WhosOffFilterType = 'all' | 'remote' | 'leave';

/**
 * Filters colleagues on the dashboard by All, Working Remotely, or On Leave.
 */
export function filterWhosOffEntries(
  entries: WhosOffEntry[],
  filter: WhosOffFilterType
): WhosOffEntry[] {
  if (filter === 'remote') {
    return entries.filter((e) => e.type === 'Remote Work');
  }
  if (filter === 'leave') {
    return entries.filter((e) => e.type !== 'Remote Work');
  }
  return entries;
}

export interface ColleagueAvailabilitySummary {
  isWorkingRemotely: boolean;
  isOnLeave: boolean;
  isReachable: boolean;
  statusHeadline: string;
  adviceText: string;
  badgeColor: string;
}

/**
 * Returns contact and availability advice for an employee
 * so colleagues know whether and how to reach them.
 */
export function getColleagueAvailabilitySummary(
  entry: WhosOffEntry
): ColleagueAvailabilitySummary {
  const isWorkingRemotely = entry.type === 'Remote Work';
  const isOnLeave = !isWorkingRemotely;

  if (isWorkingRemotely) {
    return {
      isWorkingRemotely: true,
      isOnLeave: false,
      isReachable: true,
      statusHeadline: 'Working Remotely (Active)',
      adviceText:
        'Available during normal business hours via Microsoft Teams, email, and phone.',
      badgeColor: '#10B981', // Emerald green
    };
  }

  if (entry.type === 'Sick Day off') {
    return {
      isWorkingRemotely: false,
      isOnLeave: true,
      isReachable: false,
      statusHeadline: 'On Sick Leave (Away)',
      adviceText:
        'Away on medical leave. Please do not disturb unless critical emergency. Contact team lead or backup.',
      badgeColor: '#EF4444', // Red
    };
  }

  // Annual Vacation / Other Leave
  return {
    isWorkingRemotely: false,
    isOnLeave: true,
    isReachable: false,
    statusHeadline: 'On Vacation (Out of Office)',
    adviceText:
      'Out of office. Limited to no access to email and chats. For urgent needs, refer to designated handover contact.',
    badgeColor: '#F59E0B', // Amber
  };
}
