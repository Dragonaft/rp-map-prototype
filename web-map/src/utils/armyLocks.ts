import { ActionType } from '../types';

/** Loose shape shared with the `actions` Redux slice — avoids importing its private row type. */
export interface LockableAction {
  id: string;
  actionType: ActionType | string;
  actionData: any;
}

export type ArmyLockKind = 'move' | 'merge' | 'transfer';

export interface ArmyLock {
  /** The pending action holding this lock — pass to `actionsApi.removeAction` to cancel it. */
  actionId: string;
  kind: ArmyLockKind;
}

export const ARMY_LOCK_LABELS: Record<ArmyLockKind, string> = {
  move: 'Move',
  merge: 'Merge',
  transfer: 'Transfer',
};

/**
 * Maps every army id already committed to a pending ARMY_MOVE / ARMY_MERGE / ARMY_TRANSFER to
 * the action locking it — mirrors the backend's mutual per-turn lock
 * (`ActionsService.assertNotDuplicate`): an army may have at most one of {move, merge,
 * transfer} pending at a time. Shared by MapView (gate queuing a move), SelectedProvinceHover
 * and ArmyBlock (surface + cancel the pending lock), and ManageArmiesModal (gate merge/transfer
 * army selection) so none of them can drift out of sync.
 */
export const getArmyLocks = (actions: LockableAction[]): Map<string, ArmyLock> => {
  const locks = new Map<string, ArmyLock>();
  for (const a of actions) {
    if (a.actionType === ActionType.ARMY_MOVE) {
      if (a.actionData?.army_id) locks.set(a.actionData.army_id, { actionId: a.id, kind: 'move' });
    } else if (a.actionType === ActionType.ARMY_MERGE) {
      if (a.actionData?.source_army_id) locks.set(a.actionData.source_army_id, { actionId: a.id, kind: 'merge' });
      if (a.actionData?.target_army_id) locks.set(a.actionData.target_army_id, { actionId: a.id, kind: 'merge' });
    } else if (a.actionType === ActionType.ARMY_TRANSFER) {
      if (a.actionData?.army_a_id) locks.set(a.actionData.army_a_id, { actionId: a.id, kind: 'transfer' });
      if (a.actionData?.army_b_id) locks.set(a.actionData.army_b_id, { actionId: a.id, kind: 'transfer' });
    }
  }
  return locks;
};

/** Convenience wrapper over {@link getArmyLocks} for call sites that only need membership. */
export const getLockedArmyIds = (actions: LockableAction[]): Set<string> =>
  new Set(getArmyLocks(actions).keys());
