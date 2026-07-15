import { AppBar, Badge, Button, Menu, MenuItem, Toolbar, Tooltip } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../store/hooks.ts";
import { useMutation } from "../hooks/useApi.ts";
import { authApi } from "../api/auth.ts";
import { useMemo, useState } from "react";
import { TechsModal } from "./Modals/TechsModal.tsx";
import { ProfileModal } from "./Modals/ProfileModal.tsx";
import { NotificationsModal } from "./Modals/NotificationsModal.tsx";
import { DiplomacyModal } from "./Modals/DiplomacyModal.tsx";
import { ActionType, ProvinceBuilding, TreatyStatus, UserClasses } from "../types.ts";
import { MAP_MODE_OPTIONS } from "../utils/mapModes.ts";
import { setMapMode } from "../store/slices/provincesSlice.ts";
import { RESOURCE_ICONS } from "../constants/buildingIcons.ts";

export const TopBar = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.user);
  const techs = useAppSelector(state => state.techs.techs);
  const actions = useAppSelector(state => state.actions.actions);
  const buildings = useAppSelector(state => state.buildings.buildings);
  const provinces = useAppSelector(state => state.provinces.provinces);
  const myResources = useAppSelector(state => state.resources.mine);
  const myGoods = useAppSelector(state => state.goods.mine);
  const treaties = useAppSelector(state => state.diplomacy.treaties);
  const notifications = useAppSelector(state => state.notifications.mine);
  const mapMode = useAppSelector(state => state.provinces.mapMode);
  const { mutate } = useMutation(authApi.logout);
  const [openTechModal, setOpenTechModal] = useState(false);
  const [openProfileModal, setOpenProfileModal] = useState(false);
  const [openNotificationsModal, setOpenNotificationsModal] = useState(false);
  const [openDiplomacyModal, setOpenDiplomacyModal] = useState(false);

  const pendingTreatyCount = useMemo(
    () => treaties.filter(t => t.status === TreatyStatus.PENDING && t.receiver_id === user.id && !t.view_only).length,
    [treaties, user.id],
  );
  const unreadNotificationCount = useMemo(
    () => notifications.filter(n => !n.is_read).length,
    [notifications],
  );
  const activeResearchTech = useMemo(
    () => techs.find(t => t.key === user.activeResearch) ?? null,
    [techs, user.activeResearch],
  );
  const [mapModeAnchorEl, setMapModeAnchorEl] = useState<HTMLElement | null>(null);
  const activeMapModeLabel = MAP_MODE_OPTIONS.find(option => option.value === mapMode)?.label ?? 'Normal';

  // The resource ledger (myResources) already nets out built buildings — this is
  // only a forward-looking preview of BUILD actions still queued for next turn.
  const pendingResourceUsage = useMemo(() => {
    const used: Record<string, number> = {};
    const buildingById = new Map(buildings.map(b => [String(b.id), b]));
    for (const action of actions) {
      if (action.actionType !== ActionType.BUILD) continue;
      const bid = action.actionData?.building_id ?? action.actionData?.buildingId;
      const template = buildingById.get(String(bid));
      if (template?.requirementResource && template?.requirementResourceAmount) {
        used[template.requirementResource] = (used[template.requirementResource] ?? 0) + template.requirementResourceAmount;
      }
    }
    return used;
  }, [actions, buildings]);

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
              className="flex items-center gap-2 px-4 py-2 bg-inverse-primary border rounded hover:bg-on-primary-fixed-variant transition-all active:scale-95 text-white font-headline font-bold text-[10px] uppercase tracking-widest cursor-pointer"
              onClick={() => setOpenTechModal(true)}
            >
              Research
            </Button>
            <Button
              className="flex items-center gap-2 px-4 py-2 bg-inverse-primary border rounded hover:bg-on-primary-fixed-variant transition-all active:scale-95 text-white font-headline font-bold text-[10px] uppercase tracking-widest cursor-pointer"
              onClick={() => setOpenDiplomacyModal(true)}
            >
              <span className="material-symbols-outlined text-sm" data-icon="handshake">handshake</span>
              Diplomacy
            </Button>
            <Button
              id="map-mode-button"
              className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant/20 rounded hover:bg-surface-container-high transition-all active:scale-95 text-white font-headline font-bold text-[10px] uppercase tracking-widest cursor-pointer"
              onClick={(event) => setMapModeAnchorEl(event.currentTarget)}
              aria-controls={mapModeAnchorEl ? 'map-mode-menu' : undefined}
              aria-haspopup="menu"
              aria-expanded={mapModeAnchorEl ? 'true' : undefined}
            >
              <span className="material-symbols-outlined text-sm" data-icon="map">map</span>
              Map: {activeMapModeLabel}
            </Button>
            <Menu
              id="map-mode-menu"
              anchorEl={mapModeAnchorEl}
              open={Boolean(mapModeAnchorEl)}
              onClose={() => setMapModeAnchorEl(null)}
              MenuListProps={{ 'aria-labelledby': 'map-mode-button' }}
            >
              {MAP_MODE_OPTIONS.map((option) => (
                <MenuItem
                  key={option.value}
                  selected={option.value === mapMode}
                  onClick={() => {
                    dispatch(setMapMode(option.value));
                    setMapModeAnchorEl(null);
                  }}
                >
                  {option.label}
                </MenuItem>
              ))}
            </Menu>
          </div>
          <div className="flex items-center gap-6">
            <Tooltip
              title={
                <div className="flex flex-col gap-2 p-1" style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  {myResources.length === 0 && <div>No resources yet</div>}
                  {myResources.map((holding) => {
                    const key = holding.resource.key;
                    const icon = RESOURCE_ICONS[key] ?? '📦';
                    const pending = pendingResourceUsage[key] ?? 0;
                    const free = holding.quantity - pending;
                    return (
                      <div key={holding.id}>
                        {icon} {holding.resource.name}: {holding.quantity}
                        {pending > 0 && (
                          <span style={{ color: free <= 0 ? '#ffb3b3' : '#ffd580' }}> ({pending} queued, {Math.max(0, free)} free)</span>
                        )}
                      </div>
                    );
                  })}
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
            <Tooltip
              title={
                <div className="flex flex-col gap-2 p-1" style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  {myGoods.length === 0 && <div>No goods yet</div>}
                  {myGoods.map((holding) => (
                    <div key={holding.id}>
                      {holding.good.type === 'military' ? '⚔️' : '📦'} {holding.good.name}: {holding.quantity}
                    </div>
                  ))}
                </div>
              }
              arrow
              placement="bottom"
              componentsProps={{ tooltip: { sx: { fontSize: '14px', p: 1.5 } } }}
            >
              <Button
                className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant/20 rounded hover:bg-surface-container-high transition-all active:scale-95 text-white font-headline font-bold text-xs uppercase tracking-widest cursor-pointer"
              >
                Goods
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
                {activeResearchTech && (
                  <Tooltip title={`${activeResearchTech.name}: ${activeResearchTech.progress}/${activeResearchTech.cost}`}>
                    <div className="w-16 h-1.5 bg-outline-variant/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-tertiary rounded-full"
                        style={{ width: `${Math.min(100, (activeResearchTech.progress / activeResearchTech.cost) * 100)}%` }}
                      />
                    </div>
                  </Tooltip>
                )}
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
              onClick={() => setOpenNotificationsModal(true)}
            >
              <Badge badgeContent={pendingTreatyCount + unreadNotificationCount} color="error">
                <span className="material-symbols-outlined text-sm" data-icon="notifications">notifications</span>
              </Badge>
            </Button>
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
      <NotificationsModal
        open={openNotificationsModal}
        onClose={() => setOpenNotificationsModal(false)}
      />
      <DiplomacyModal
        open={openDiplomacyModal}
        onClose={() => setOpenDiplomacyModal(false)}
      />
    </AppBar>
  )
};
