import { AppBar, Button, Toolbar, Tooltip } from "@mui/material";
import { useAppSelector } from "../store/hooks.ts";
import { useMutation } from "../hooks/useApi.ts";
import { authApi } from "../api/auth.ts";
import { useMemo, useState } from "react";
import { TechsModal } from "./Modals/TechsModal.tsx";
import { ProfileModal } from "./Modals/ProfileModal.tsx";
import { ActionType, ProvinceBuilding, UserClasses } from "../types.ts";

export const TopBar = () => {
  const user = useAppSelector(state => state.user);
  const actions = useAppSelector(state => state.actions.actions);
  const buildings = useAppSelector(state => state.buildings.buildings);
  const provinces = useAppSelector(state => state.provinces.provinces);
  const { mutate } = useMutation(authApi.logout);
  const [openTechModal, setOpenTechModal] = useState(false);
  const [openProfileModal, setOpenProfileModal] = useState(false);

  // Sum gold cost of all queued actions that have a known upfront cost.
  // BUILD: building.cost, UPGRADE: building.cost + 100, COLONIZE: 500.
  const pendingMoneyCost = useMemo(() => {
    if (!actions.length) return 0;
    const buildingById = new Map(buildings.map(b => [String(b.id), b]));
    // UPGRADE targets a specific building instance (province_building_id), so
    // resolve it through the province buildings to estimate its cost.
    const instanceById = new Map<string, ProvinceBuilding>();
    for (const p of provinces) {
      for (const b of p.buildings ?? []) instanceById.set(b.instanceId, b);
    }
    let total = 0;
    for (const action of actions) {
      if (action.actionType === ActionType.BUILD) {
        const bid = action.actionData?.building_id ?? action.actionData?.buildingId;
        const b = buildingById.get(String(bid));
        if (b) total += b.cost;
      } else if (action.actionType === ActionType.UPGRADE) {
        const inst = instanceById.get(String(action.actionData?.province_building_id));
        if (inst) total += inst.cost + 100;
      } else if (action.actionType === ActionType.COLONIZE) {
        total += 500;
      }
    }
    return total;
  }, [actions, buildings, provinces]);

  const handleLogout = async () => {
    try {
      await mutate();
      window.location.reload();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  return (
    <AppBar position="static">
      <Toolbar
        className="fixed top-0 flex w-full z-50 items-center bg-[#0e0e0e]/80 backdrop-blur-xl bg-gradient-to-b from-[#1a1a1a] to-transparent shadow-[0_4px_20px_rgba(0,0,0,0.5)] border-b border-outline-variant/10">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              className="flex items-center mr-12 gap-2 px-4 py-2 bg-inverse-primary border rounded hover:bg-on-primary-fixed-variant transition-all active:scale-95 text-white font-headline font-bold text-[10px] uppercase tracking-widest cursor-pointer"
              onClick={() => setOpenTechModal(true)}
            >
              Research
            </Button>
          </div>
          <div className="flex items-center gap-6">
            <Tooltip
              title={
                <div className="flex flex-col gap-2 p-1" style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  <div>🪨 Stone: {user.resources?.stone ?? 0}</div>
                  <div>⚙ Iron: {user.resources?.iron ?? 0}</div>
                  <div>🪙 Gold: {user.resources?.gold ?? 0}</div>
                  <div>🪵 Wood: {user.resources?.wood ?? 0}</div>
                </div>
              }
              arrow
              placement="bottom"
              componentsProps={{ tooltip: { sx: { fontSize: '14px', p: 1.5 } } }}
            >
              <Button
                className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant/20 rounded hover:bg-surface-container-high transition-all active:scale-95 text-white font-headline font-bold text-xs uppercase tracking-widest cursor-pointer"
              >
                Resources
              </Button>
            </Tooltip>
            <div
              className="flex items-center gap-4 px-4 py-2 bg-surface-container rounded-lg border border-outline-variant/15">
              {user.class === UserClasses.HOLY && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-white text-sm" data-icon="church">church</span>
                    <span className="font-headline font-bold text-white text-xs uppercase tracking-wider">Piety: {user.piety}</span>
                    <span className={`${user.projectedPiety && user.projectedPiety > 0 ? "text-green-500" : "text-red-500"} font-headline font-bold text-xs uppercase tracking-wider`}>({user.projectedPiety && user.projectedPiety > 0 ? + user.projectedPiety : user.projectedPiety})</span>
                  </div>
                  <div className="w-px h-4 bg-outline-variant/30"></div>
                </>
              )}
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary text-sm" data-icon="science">science</span>
                <span className="font-headline font-bold text-tertiary text-xs uppercase tracking-wider">Research: {user.researchPoints}</span>
                <span className={`${user.projectedResearch > 0 ? "text-green-500" : "text-red-500"} font-headline font-bold text-xs uppercase tracking-wider`}>({user.projectedResearch > 0 ? + user.projectedResearch : user.projectedResearch})</span>
              </div>
              <div className="w-px h-4 bg-outline-variant/30"></div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-sm" data-icon="groups">groups</span>
                <span
                  className="font-headline font-bold text-primary text-xs uppercase tracking-wider">Troops: {user.troops}</span>
                <span className={`${user.projectedTroops > 0 ? "text-green-500" : "text-red-500"} font-headline font-bold text-xs uppercase tracking-wider`}>({user.projectedTroops > 0 ? + user.projectedTroops : user.projectedTroops})</span>
              </div>
              <div className="w-px h-4 bg-outline-variant/30"></div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-sm" data-icon="payments">payments</span>
                <span className="font-headline font-bold text-secondary text-xs uppercase tracking-wider">Money: {user.money}</span>
                {pendingMoneyCost > 0 && (
                  <Tooltip title={`${pendingMoneyCost} gold committed to queued actions`} arrow placement="bottom">
                    <span className="font-headline font-bold text-orange-400 text-xs uppercase tracking-wider cursor-help">
                      [{user.money - pendingMoneyCost} free]
                    </span>
                  </Tooltip>
                )}
                <span className={`${user.projectedIncome > 0 ? "text-green-500" : "text-red-500"} font-headline font-bold text-xs uppercase tracking-wider`}>({user.projectedIncome > 0 ? + user.projectedIncome : user.projectedIncome})</span>
              </div>
            </div>
            <Button
              className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant/20 rounded hover:bg-surface-container-high transition-all active:scale-95 text-white font-headline font-bold text-[10px] uppercase tracking-widest cursor-pointer"
              onClick={() => setOpenProfileModal(true)}
            >
              <span className="material-symbols-outlined text-sm" data-icon="manage_accounts">manage_accounts</span>
              Profile
            </Button>
            <Button
              className="flex items-center mr-12 gap-2 px-4 py-2 bg-error-container/20 border border-error/30 rounded hover:bg-error-container/40 transition-all active:scale-95 text-error font-headline font-bold text-[10px] uppercase tracking-widest cursor-pointer"
              onClick={handleLogout}
            >
              <span className="material-symbols-outlined text-sm" data-icon="logout">logout</span>
              Logout
            </Button>
          </div>
        </div>
      </Toolbar>
      <TechsModal
        open={openTechModal}
        onClose={() => setOpenTechModal(false)}
      />
      <ProfileModal
        open={openProfileModal}
        onClose={() => setOpenProfileModal(false)}
      />
    </AppBar>
  )
};
