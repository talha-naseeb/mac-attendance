import { ActionItem, ActionModuleId } from '../types/zenhr';

export const DEFAULT_SELECTED_ACTIONS: ActionModuleId[] = [
  'attendance',
  'payroll',
  'transactions',
  'schedule',
];

export const MAX_SELECTED_ACTIONS = 4;
export const MIN_SELECTED_ACTIONS = 2;

/**
 * Validates and updates selection of action cards (max 4, min 2).
 */
export function toggleActionSelection(
  currentSelection: ActionModuleId[],
  targetId: ActionModuleId,
  maxLimit: number = MAX_SELECTED_ACTIONS,
  minLimit: number = MIN_SELECTED_ACTIONS
): { updatedSelection: ActionModuleId[]; error?: string } {
  const isAlreadySelected = currentSelection.includes(targetId);

  if (isAlreadySelected) {
    if (currentSelection.length <= minLimit) {
      return {
        updatedSelection: currentSelection,
        error: `MIN_REACHED:${minLimit}`,
      };
    }
    return {
      updatedSelection: currentSelection.filter((id) => id !== targetId),
    };
  }

  if (currentSelection.length >= maxLimit) {
    return {
      updatedSelection: currentSelection,
      error: `MAX_REACHED:${maxLimit}`,
    };
  }

  return {
    updatedSelection: [...currentSelection, targetId],
  };
}

/**
 * Resolves the action items to display on the dashboard based on user selection,
 * role authorization, and the 4-card maximum display constraint.
 */
export function resolveDisplayedActions(
  allActions: ActionItem[],
  selectedIds: ActionModuleId[],
  maxCards: number = MAX_SELECTED_ACTIONS
): ActionItem[] {
  const map = new Map(allActions.map((a) => [a.id, a]));
  const matched = selectedIds
    .map((id) => map.get(id))
    .filter((a): a is ActionItem => !!a);

  if (matched.length < 2) {
    return allActions.slice(0, maxCards);
  }
  return matched.slice(0, maxCards);
}
