import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Province } from '../types';
import { ActionType, BuildingTypes } from '../types';
import { Box, Button, Modal, Typography } from '@mui/material';
import { ProvinceShape } from './ProvinceShape';
import { SelectedProvinceHover } from "./SelectedProvinceHover.tsx";
import { TroopMovementModal } from './TroopMovementModal';
import { ArmyBlock } from './ArmyBlock.tsx';
import { CreateArmyModal } from './CreateArmyModal.tsx';
import { ManageArmiesModal } from './ManageArmiesModal.tsx';
import { setMapModeFilterValue, setSelectedProvinceId, setSelectedTroops } from '../store/slices/provincesSlice';
import type { RootState } from '../store/store';
import { useAppDispatch, useAppSelector } from "../store/hooks.ts";
import { actionsApi } from '../api/actions.ts';
import { addAction, removeActionById } from '../store/slices/actionsSlice.ts';
import { useSnackbar } from '../context/SnackbarContext.tsx';
import { FastBuildPanel } from './FastBuildPanel.tsx';
import {
  getFastBuildCell,
  getPendingBuildActionsByProvinceId,
  getPendingBuildCountsByProvinceId,
  getPendingGoodUsage,
  getPendingProvinceBuildingIdsByProvinceId,
  getPendingResourceUsage,
  getPendingUpgradeActionIdByInstanceId,
  getProvinceBuildingSlots,
  getProvinceEconomy,
  getProvinceRecruits,
  provinceHasWaterNeighbor,
} from '../utils/mapModes.ts';
import type { MapModeRenderData } from '../utils/mapModes.ts';
import { getLockedArmyIds } from '../utils/armyLocks.ts';


export const MapView = ({ loading, error }: { loading: boolean, error: string | null }) => {
  const dispatch = useAppDispatch();
  const provinces = useAppSelector((state: RootState) => state.provinces.provinces);
  const selectedProvinceId = useAppSelector((state: RootState) => state.provinces.selectedProvinceId);
  const userActions = useAppSelector((state: RootState) => state.actions.actions);
  const provinceCentersById = useAppSelector((state: RootState) => state.provinces.provinceCentersById);
  const provinceBBoxById = useAppSelector((state: RootState) => state.provinces.provinceBBoxById);
  const mapWidth  = useAppSelector((state: RootState) => state.provinces.mapWidth);
  const mapHeight = useAppSelector((state: RootState) => state.provinces.mapHeight);
  const armies = useAppSelector((state: RootState) => state.armies.armies);
  const currentUserId = useAppSelector((state: RootState) => state.user.id);
  const currentUserMoney = useAppSelector((state: RootState) => state.user.money);
  const completedResearch = useAppSelector((state: RootState) => state.user.completedResearch);
  const buildings = useAppSelector((state: RootState) => state.buildings.buildings);
  const resources = useAppSelector((state: RootState) => state.resources.resources);
  const mapMode = useAppSelector((state: RootState) => state.provinces.mapMode);
  const mapModeFilterValue = useAppSelector((state: RootState) => state.provinces.mapModeFilterValue);
  const fastBuild = useAppSelector((state: RootState) => state.provinces.fastBuild);
  const myResourceHoldings = useAppSelector((state: RootState) => state.resources.mine);
  const myGoodHoldings = useAppSelector((state: RootState) => state.goods.mine);
  const { showError } = useSnackbar();

  // Camera state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const hasCenteredCameraRef = useRef(false);

  // Modal state
  const [modalState, setModalState] = useState<{
    open: boolean;
    armyId: string;
    armyName: string;
    toProvinceId: string;
  } | null>(null);
  const [cancelActionId, setCancelActionId] = useState<string | null>(null);
  const [isCancellingAction, setIsCancellingAction] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [selectedArmyId, setSelectedArmyId] = useState<string | null>(null);
  const [showCreateArmy, setShowCreateArmy] = useState(false);
  const [showManageArmies, setShowManageArmies] = useState(false);

  // Armies already committed to a pending move/merge/transfer this turn — mirrors the
  // backend's mutual per-turn lock (see ActionsService.assertNotDuplicate).
  const lockedArmyIds = useMemo(() => getLockedArmyIds(userActions), [userActions]);

  // Player's resource ledger (GET /resources/mine) / goods ledger (GET /goods/mine), keyed
  // for quick lookup — feeds fast-build mode's requirement checks. Mirrors
  // SelectedProvinceHover's build-menu computation so the two share one source of truth.
  const userResourcesByKey = useMemo(
    () => Object.fromEntries(myResourceHoldings.map((h) => [h.resource.key, h.quantity])),
    [myResourceHoldings],
  );
  const userGoodsById = useMemo(
    () => Object.fromEntries(myGoodHoldings.map((h) => [h.good_id, h.quantity])),
    [myGoodHoldings],
  );
  const pendingResourceUsage = useMemo(
    () => getPendingResourceUsage(userActions, buildings),
    [userActions, buildings],
  );
  const pendingGoodUsage = useMemo(
    () => getPendingGoodUsage(userActions, buildings),
    [userActions, buildings],
  );
  const provinceTypeById = useMemo(
    () => new Map(provinces.map((p) => [p.id, p.type])),
    [provinces],
  );

  const plainIncomeByResourceKey = useMemo(
    () => Object.fromEntries(resources.map((r) => [r.key, r.plainIncome])),
    [resources],
  );

  const mapModeRenderData = useMemo<MapModeRenderData>(() => {
    const pendingBuildCountsByProvinceId = getPendingBuildCountsByProvinceId(userActions);
    const pendingUpgradeBuildingIdsByProvinceId = getPendingProvinceBuildingIdsByProvinceId(userActions, ActionType.UPGRADE);
    const pendingRemoveBuildingIdsByProvinceId = getPendingProvinceBuildingIdsByProvinceId(userActions, ActionType.REMOVE);
    const pendingBuildActionsByProvinceId = getPendingBuildActionsByProvinceId(userActions, buildings);
    const pendingUpgradeActionIdByInstanceId = getPendingUpgradeActionIdByInstanceId(userActions);
    const economyByProvinceId: MapModeRenderData['economyByProvinceId'] = {};
    const recruitsByProvinceId: MapModeRenderData['recruitsByProvinceId'] = {};
    const buildingSlotsByProvinceId: MapModeRenderData['buildingSlotsByProvinceId'] = {};
    const fastBuildByProvinceId: MapModeRenderData['fastBuildByProvinceId'] = {};
    let economyMaxAbs = 0;
    let recruitsMax = 0;

    const fastBuildTargetBuilding = mapMode === 'fastbuild' && fastBuild
      ? buildings.find((b) => b.id === fastBuild.buildingId) ?? null
      : null;
    const fastBuildActionKind = fastBuild?.action ?? 'build';

    for (const province of provinces) {
      if (province.type === 'water') continue;

      if (province.userId !== currentUserId) continue;

      const slots = getProvinceBuildingSlots(
        province,
        pendingBuildCountsByProvinceId[province.id] ?? 0,
        {
          pendingUpgradeBuildingIds: pendingUpgradeBuildingIdsByProvinceId[province.id],
          pendingRemoveBuildingIds: pendingRemoveBuildingIdsByProvinceId[province.id],
          buildingTemplates: buildings,
          userMoney: currentUserMoney,
          completedResearch,
        },
      );
      buildingSlotsByProvinceId[province.id] = slots;

      const economy = getProvinceEconomy(province, completedResearch, plainIncomeByResourceKey);
      economyByProvinceId[province.id] = economy;
      economyMaxAbs = Math.max(economyMaxAbs, Math.abs(economy.net));

      const recruits = getProvinceRecruits(province);
      recruitsByProvinceId[province.id] = recruits;
      recruitsMax = Math.max(recruitsMax, recruits);

      if (fastBuildTargetBuilding) {
        fastBuildByProvinceId[province.id] = getFastBuildCell(
          province,
          fastBuildTargetBuilding,
          fastBuildActionKind,
          provinceHasWaterNeighbor(province, provinceTypeById),
          {
            buildingTemplates: buildings,
            pendingBuildActionsInProvince: pendingBuildActionsByProvinceId[province.id] ?? [],
            pendingUpgradeBuildingIds: pendingUpgradeBuildingIdsByProvinceId[province.id],
            pendingRemoveBuildingIds: pendingRemoveBuildingIdsByProvinceId[province.id],
            pendingUpgradeActionIdByInstanceId,
            freeSlots: slots.free,
            buildRequirementCtx: {
              userMoney: currentUserMoney,
              completedResearch,
              userResourcesByKey,
              pendingResourceUsage,
              userGoodsById,
              pendingGoodUsage,
            },
          },
        );
      }
    }

    return {
      mode: mapMode,
      filterValue: mapModeFilterValue,
      economyByProvinceId,
      economyMaxAbs,
      recruitsByProvinceId,
      recruitsMax,
      buildingSlotsByProvinceId,
      fastBuildByProvinceId,
    };
  }, [
    userActions, provinces, currentUserId, currentUserMoney, completedResearch, buildings,
    plainIncomeByResourceKey, mapMode, mapModeFilterValue, fastBuild, provinceTypeById,
    userResourcesByKey, pendingResourceUsage, userGoodsById, pendingGoodUsage,
  ]);

  // Fast-build mode: a click on a green/yellow province queues BUILD/UPGRADE immediately
  // through the normal action-queue API — same call pattern as SelectedProvinceHover's
  // handleBuildAction/handleUpgradeAction.
  const handleFastBuildClick = useCallback(async (prov: Province) => {
    if (!fastBuild) return;
    const cell = mapModeRenderData.fastBuildByProvinceId[prov.id];
    if (!cell || !cell.canQueue) {
      // Yellow-but-full or a fresh money/requirement change since the last render — red
      // stays a silent no-op (matches "click a red province → nothing happens").
      if (cell?.status === 'yellow') {
        showError('Already queued here — no slot left to queue another this turn.');
      }
      return;
    }
    try {
      if (fastBuild.action === 'build') {
        const response = await actionsApi.createAction({
          type: ActionType.BUILD,
          actionData: { province_id: prov.id, building_id: fastBuild.buildingId },
        });
        dispatch(addAction(response));
      } else if (cell.upgradeInstanceId) {
        const response = await actionsApi.createAction({
          type: ActionType.UPGRADE,
          actionData: { province_id: prov.id, province_building_id: cell.upgradeInstanceId },
        });
        dispatch(addAction(response));
      }
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to queue action');
    }
  }, [fastBuild, mapModeRenderData, dispatch, showError]);

  // Fast-build mode: right-clicking a yellow province (one already queuing a BUILD/UPGRADE
  // of the selected building) cancels that pending action — same call pattern as
  // SelectedProvinceHover's handleCancelAction/handleCancelColonize.
  const handleFastBuildCancel = useCallback(async (prov: Province) => {
    if (!fastBuild) return;
    const cell = mapModeRenderData.fastBuildByProvinceId[prov.id];
    if (!cell || cell.status !== 'yellow' || !cell.cancelActionId) return;
    try {
      await actionsApi.removeAction(cell.cancelActionId);
      dispatch(removeActionById(cell.cancelActionId));
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to cancel action');
    }
  }, [fastBuild, mapModeRenderData, dispatch, showError]);

  const toggleSelect = useCallback((prov: Province) => {
    if (hasDraggedRef.current) return;
    if (mapMode === 'fastbuild' && fastBuild) {
      handleFastBuildClick(prov);
      return;
    }
    if (mapMode === 'landscape' || mapMode === 'resource') {
      const nextFilter = prov.type === 'water'
        ? null
        : mapMode === 'landscape'
          ? prov.landscape
          : prov.resourceType;
      dispatch(setMapModeFilterValue(nextFilter));
    }
    dispatch(setSelectedProvinceId(selectedProvinceId === prov.id ? null : prov.id));
    setSelectedArmyId(null);
  }, [dispatch, selectedProvinceId, mapMode, fastBuild, handleFastBuildClick]);

  // ── Reachable provinces from selected army (BFS matching BE logic) ────────
  const reachableFromSelectedArmy = useMemo((): Set<string> | null => {
    if (!selectedArmyId) return null;
    const army = armies.find(a => a.id === selectedArmyId);
    if (!army) return null;
    const fromProvince = provinces.find(p => p.id === army.province_id);
    if (!fromProvince) return null;

    const reachable = new Set<string>();
    // Direct neighbors always reachable
    for (const nId of (fromProvince.neighbors ?? [])) reachable.add(nId);

    // Road extension
    const hasRoad = fromProvince.buildings?.some(b => b.type === BuildingTypes.ROAD);
    if (hasRoad) {
      const maxHops = completedResearch.includes('military.best_logistics') ? 3 : 2;
      const visited = new Set<string>([fromProvince.id]);
      let frontier: Province[] = [fromProvince];
      for (let hop = 0; hop < maxHops; hop++) {
        const nextFrontier: Province[] = [];
        for (const current of frontier) {
          for (const neighborId of (current.neighbors ?? [])) {
            if (visited.has(neighborId)) continue;
            visited.add(neighborId);
            const neighbor = provinces.find(p => p.id === neighborId);
            const neighborHasRoad = neighbor?.buildings?.some(b => b.type === BuildingTypes.ROAD) ?? false;
            if (neighborHasRoad && neighbor?.userId === currentUserId) {
              reachable.add(neighborId);
              if (hop < maxHops - 1) {
                nextFrontier.push(neighbor);
              }
            }
          }
        }
        frontier = nextFrontier;
        if (!frontier.length) break;
      }
    }
    reachable.delete(army.province_id);
    return reachable;
  }, [selectedArmyId, armies, provinces, currentUserId, completedResearch]);

  const handleProvinceRightClick = useCallback((targetProvince: Province) => {
    if (mapMode === 'fastbuild' && fastBuild) {
      handleFastBuildCancel(targetProvince);
      return;
    }
    if (!selectedArmyId || !reachableFromSelectedArmy) return;
    if (!reachableFromSelectedArmy.has(targetProvince.id)) return;
    const army = armies.find(a => a.id === selectedArmyId);
    if (!army) return;
    if (army.user_id !== currentUserId) return;
    // An army with a pending merge/transfer (or an already-queued move) can't queue another move.
    if (lockedArmyIds.has(selectedArmyId)) {
      showError('This army already has a pending move, merge, or transfer this turn');
      return;
    }
    setModalState({
      open: true,
      armyId: selectedArmyId,
      armyName: army.name ?? 'Unnamed Army',
      toProvinceId: targetProvince.id,
    });
  }, [mapMode, fastBuild, handleFastBuildCancel, selectedArmyId, armies, reachableFromSelectedArmy, currentUserId, lockedArmyIds, showError]);

  const handleCloseModal = useCallback(() => setModalState(null), []);

  const handleOpenCancelModal = useCallback((actionId: string) => {
    setCancelError(null);
    setCancelActionId(actionId);
  }, []);

  const handleCloseCancelModal = useCallback(() => {
    if (isCancellingAction) return;
    setCancelActionId(null);
    setCancelError(null);
  }, [isCancellingAction]);

  const handleConfirmCancelAction = useCallback(async () => {
    if (!cancelActionId) return;
    setIsCancellingAction(true);
    setCancelError(null);
    try {
      // ActionsService.retractAction always returns `province: null` (actions.service.ts),
      // so there was never a province update to apply from this response — removed along
      // with the now-gone `localTroops` field it read.
      await actionsApi.removeAction(cancelActionId);
      dispatch(removeActionById(cancelActionId));
      setCancelActionId(null);
    } catch (err: any) {
      setCancelError(err?.response?.data?.message || 'Failed to cancel action');
    } finally {
      setIsCancellingAction(false);
    }
  }, [cancelActionId, dispatch]);

  // ── Action index lookups ──────────────────────────────────────────────────

  const troopMovementOverlays = useMemo(() => {
    if (!userActions?.length) return [];
    return userActions.filter(a => a.actionType === ActionType.ARMY_MOVE);
  }, [userActions]);

  // ── Army troop counts per province ───────────────────────────────────────
  const armyTroopsByProvinceId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const army of armies) {
      if (army.user_id !== currentUserId) continue;
      const total = army.units.reduce((s, u) => s + u.count, 0);
      map[army.province_id] = (map[army.province_id] ?? 0) + total;
    }
    return map;
  }, [armies, currentUserId]);

  const armiesByProvinceId = useMemo(() => {
    const map: Record<string, typeof armies> = {};
    for (const army of armies) {
      if (!map[army.province_id]) map[army.province_id] = [];
      map[army.province_id].push(army);
    }
    return map;
  }, [armies]);

  // Enemy army presence per province: null = present/unknown count, number = spy-revealed total
  const enemyArmyInfoByProvinceId = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const army of armies) {
      if (army.user_id === currentUserId) continue;
      const prev = map[army.province_id];
      if (army.totalTroops != null) {
        map[army.province_id] = prev === undefined ? army.totalTroops : (prev === null ? null : prev + army.totalTroops);
      } else {
        map[army.province_id] = null; // present but count unknown
      }
    }
    return map;
  }, [armies, currentUserId]);

  // First enemy army owner per province (used for color indicator)
  const enemyArmyOwnerByProvinceId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const army of armies) {
      if (army.user_id === currentUserId) continue;
      if (!map[army.province_id]) map[army.province_id] = army.user_id;
    }
    return map;
  }, [armies, currentUserId]);

  // ── Road lines (center-to-center for neighboring road provinces) ─────────
  const roadLines = useMemo(() => {
    const roadProvinceIds = new Set(
      provinces
        .filter(p => p.buildings?.some(b => b.type === BuildingTypes.ROAD))
        .map(p => p.id),
    );
    const lines: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];
    const drawn = new Set<string>();
    for (const p of provinces) {
      if (!roadProvinceIds.has(p.id)) continue;
      for (const neighborId of (p.neighbors ?? [])) {
        if (!roadProvinceIds.has(neighborId)) continue;
        const key = [p.id, neighborId].sort().join('|');
        if (drawn.has(key)) continue;
        drawn.add(key);
        const c1 = provinceCentersById[p.id];
        const c2 = provinceCentersById[neighborId];
        if (!c1 || !c2) continue;
        lines.push({ x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, key });
      }
    }
    return lines;
  }, [provinces, provinceCentersById]);

  const handleArmyCountClick = useCallback((provinceId: string) => {
    dispatch(setSelectedProvinceId(provinceId));
    const provincArmies = armiesByProvinceId[provinceId] ?? [];
    if (provincArmies.length === 1) {
      setSelectedArmyId(provincArmies[0].id);
    } else {
      setSelectedArmyId(null);
    }
  }, [dispatch, armiesByProvinceId]);

  const selectedArmy = useMemo(
    () => (selectedArmyId ? armies.find((a) => a.id === selectedArmyId) ?? null : null),
    [selectedArmyId, armies],
  );

  // ── Dynamic tile indices based on current viewBox position ───────────────
  // viewBox.x is never normalized — it grows/shrinks unboundedly as the user
  // pans. We derive which integer tile indices are visible each frame, then
  // render only those copies. This eliminates the discrete jump (flicker) that
  // happened when viewBox.x was snapped back to [0, mapWidth].
  const tileIndices = useMemo(() => {
    if (mapWidth <= 0) return [0];
    const firstTile = Math.floor(viewBox.x / mapWidth) - 1;
    const lastTile  = Math.ceil((viewBox.x + viewBox.width) / mapWidth) + 1;
    const tiles: number[] = [];
    for (let m = firstTile; m <= lastTile; m++) tiles.push(m);
    return tiles;
  }, [viewBox.x, viewBox.width, mapWidth]);

  // ── Viewport culling with wrap-x ──────────────────────────────────────────
  // For each visible tile copy, collect only provinces whose shifted bbox
  // intersects the viewBox.
  const provincesByOffset = useMemo(() => {
    const mw = mapWidth;
    const result = new Map<number, Province[]>(tileIndices.map(m => [m * mw, []]));
    if (!provinces?.length) return result;

    for (const p of provinces) {
      const bb = provinceBBoxById[p.id];
      for (const m of tileIndices) {
        const offsetX = m * mw;
        if (!bb) {
          // No bbox: include in the tile that contains offset 0
          if (m === 0) result.get(0)!.push(p);
          continue;
        }
        const sx = bb.x + offsetX;
        if (sx + bb.width  < viewBox.x) continue;
        if (sx             > viewBox.x + viewBox.width) continue;
        if (bb.y + bb.height < viewBox.y) continue;
        if (bb.y             > viewBox.y + viewBox.height) continue;
        result.get(offsetX)!.push(p);
      }
    }
    return result;
  }, [provinces, provinceBBoxById, viewBox, mapWidth, tileIndices]);

  // ── Keep viewBox aspect ratio matched to the rendered element ─────────────
  // The viewBox starts as a fixed 800x600 (4:3) box. Without this, the SVG's
  // default preserveAspectRatio="xMidYMid meet" scales that box to fit inside
  // the actual container while preserving its aspect ratio, pillarboxing
  // whenever the screen isn't 4:3 (i.e. almost always). Re-deriving height
  // from the current width + the element's real aspect ratio keeps content
  // scaled uniformly (no distortion) while eliminating the letterbox bars.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || loading) return;

    const syncAspectRatio = (clientWidth: number, clientHeight: number) => {
      if (clientWidth <= 0 || clientHeight <= 0) return;
      setViewBox(prev => {
        const targetHeight = prev.width / (clientWidth / clientHeight);
        if (Math.abs(targetHeight - prev.height) < 0.5) return prev;
        const centerY = prev.y + prev.height / 2;
        return { ...prev, height: targetHeight, y: centerY - targetHeight / 2 };
      });
    };

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      syncAspectRatio(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [loading]);

  // ── Initial camera position (once, on first load) ─────────────────────────
  // Point at the centroid of the player's own provinces if they have any;
  // otherwise fall back to the center of the map (new/unclaimed player).
  // Guarded to run exactly once so it doesn't fight the user's own panning
  // on later re-renders (e.g. after claiming a starting province mid-session).
  useEffect(() => {
    if (hasCenteredCameraRef.current) return;
    if (loading || !currentUserId || !provinces.length) return;

    hasCenteredCameraRef.current = true;

    const ownedCenters = provinces
      .filter(p => p.userId === currentUserId)
      .map(p => provinceCentersById[p.id])
      .filter((c): c is { x: number; y: number } => !!c);

    const center = ownedCenters.length
      ? {
          x: ownedCenters.reduce((sum, c) => sum + c.x, 0) / ownedCenters.length,
          y: ownedCenters.reduce((sum, c) => sum + c.y, 0) / ownedCenters.length,
        }
      : { x: mapWidth / 2, y: mapHeight / 2 };

    setViewBox(prev => ({ ...prev, x: center.x - prev.width / 2, y: center.y - prev.height / 2 }));
  }, [loading, currentUserId, provinces, provinceCentersById, mapWidth, mapHeight]);

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || loading) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setViewBox(prev => {
        const mouseXInViewBox = prev.x + (mouseX / rect.width) * prev.width;
        const mouseYInViewBox = prev.y + (mouseY / rect.height) * prev.height;
        const newWidth = prev.width * zoomFactor;
        const newHeight = prev.height * zoomFactor;
        const x = mouseXInViewBox - (mouseX / rect.width) * newWidth;
        return { x, y: mouseYInViewBox - (mouseY / rect.height) * newHeight, width: newWidth, height: newHeight };
      });
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [loading]);

  // ── Drag-to-pan ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !lastMousePosRef.current || !svgRef.current) return;
      const deltaX = e.clientX - lastMousePosRef.current.x;
      const deltaY = e.clientY - lastMousePosRef.current.y;

      if (!hasDraggedRef.current && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
        hasDraggedRef.current = true;
      }

      if (hasDraggedRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const scaleX = viewBox.width / rect.width;
        const scaleY = viewBox.height / rect.height;
        setViewBox(prev => ({
          ...prev,
          x: prev.x - deltaX * scaleX,
          y: prev.y - deltaY * scaleY,
        }));
      }
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        dragStartRef.current = null;
        lastMousePosRef.current = null;
        setTimeout(() => { hasDraggedRef.current = false; }, 50);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, viewBox.width, viewBox.height]);

  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    hasDraggedRef.current = false;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: 'white' }}>
        Loading provinces...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: 'red' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '93vh', marginTop: '65px', background: '#1e293b' }}>
      <FastBuildPanel buildings={buildings} />
      <SelectedProvinceHover
        selectedArmyId={selectedArmyId}
        onSelectArmy={(id) => setSelectedArmyId(id)}
        onCreateArmy={() => setShowCreateArmy(true)}
        onManageArmies={() => setShowManageArmies(true)}
      />
      {selectedArmy && (
        <div style={{ position: 'absolute', top: '1rem', right: '310px' }}>
          <ArmyBlock army={selectedArmy} onClose={() => setSelectedArmyId(null)} />
        </div>
      )}
      {showCreateArmy && selectedProvinceId && (
        <CreateArmyModal
          open={showCreateArmy}
          provinceId={selectedProvinceId}
          onClose={() => setShowCreateArmy(false)}
          onCreated={() => setShowCreateArmy(false)}
        />
      )}
      {showManageArmies && selectedProvinceId && (
        <ManageArmiesModal
          open={showManageArmies}
          provinceId={selectedProvinceId}
          onClose={() => setShowManageArmies(false)}
        />
      )}

      {modalState && (
        <TroopMovementModal
          open={modalState.open}
          onClose={handleCloseModal}
          armyId={modalState.armyId}
          armyName={modalState.armyName}
          toProvinceId={modalState.toProvinceId}
          onConfirmed={() => setSelectedArmyId(null)}
        />
      )}

      <Modal open={Boolean(cancelActionId)} onClose={handleCloseCancelModal}>
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 360, bgcolor: 'background.paper',
          border: '2px solid #000', boxShadow: 24, p: 3,
        }}>
          <Typography variant="h6" component="h2" gutterBottom>
            Are you sure you want to cancel this action?
          </Typography>
          {cancelError && (
            <Typography sx={{ color: 'error.main', mt: 1 }}>{cancelError}</Typography>
          )}
          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Button variant="contained" color="error" onClick={handleConfirmCancelAction}
              disabled={isCancellingAction} fullWidth>
              {isCancellingAction ? 'Cancelling...' : 'Yes'}
            </Button>
            <Button variant="outlined" onClick={handleCloseCancelModal}
              disabled={isCancellingAction} fullWidth>
              No
            </Button>
          </Box>
        </Box>
      </Modal>

      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        style={{
          width: '100%', height: '100%',
          cursor: isDragging ? 'grabbing' : 'grab',
          background: '#334155',
        }}
        onMouseDown={handleSvgMouseDown}
        onClick={(e) => {
          if (e.target instanceof SVGSVGElement) {
            dispatch(setSelectedProvinceId(null));
            dispatch(setSelectedTroops(null));
            dispatch(setMapModeFilterValue(null));
            setSelectedArmyId(null);
          }
        }}
      >
        <defs>
        </defs>

        {/* Dynamic tile copies for seamless X-axis wrapping.
            viewBox.x is never normalized so there are no discrete jumps.
            tileIndices are computed each frame from the current viewBox position.
            Viewport culling (provincesByOffset) keeps active node count low. */}
        {/* Pass 1: all province shapes and roads across all tile copies */}
        {tileIndices.map(m => {
          const offsetX = m * mapWidth;
          const copy = provincesByOffset.get(offsetX) ?? [];
          const copyRoads = mapWidth > 0
            ? roadLines.filter(l => Math.abs(l.x2 - l.x1) <= mapWidth / 2)
            : roadLines;
          return (
            <g key={offsetX} transform={`translate(${offsetX}, 0)`}>
              {copy.map(p => (
                <ProvinceShape
                  key={p.id}
                  province={p}
                  bbox={provinceBBoxById[p.id] ?? { x: 0, y: 0, width: 0, height: 0 }}
                  isSelected={selectedProvinceId === p.id}
                  onSelect={toggleSelect}
                  onRightClick={handleProvinceRightClick}
                  armyTroopCount={armyTroopsByProvinceId[p.id]}
                  onArmyCountClick={handleArmyCountClick}
                  enemyArmyTroopCount={enemyArmyInfoByProvinceId[p.id]}
                  enemyArmyOwnerId={enemyArmyOwnerByProvinceId[p.id]}
                  mapModeRenderData={mapModeRenderData}
                />
              ))}
              <g pointerEvents="none">
                {copyRoads.map(l => (
                  <line key={l.key}
                    x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                    stroke="#92400e" strokeWidth={3} strokeDasharray="6 4" opacity={0.7}
                  />
                ))}
              </g>
            </g>
          );
        })}

        {/* Pass 2: army move arrows rendered after all provinces so they're always on top */}
        {tileIndices.map(m => {
          const offsetX = m * mapWidth;
          const copyArrows = troopMovementOverlays.filter(action => {
            const army = armies.find(a => a.id === action.actionData?.army_id);
            if (!army) return false;
            const fromC = provinceCentersById[army.province_id];
            if (!fromC) return false;
            const sx = fromC.x + offsetX;
            return sx >= viewBox.x - viewBox.width && sx <= viewBox.x + 2 * viewBox.width;
          });
          if (!copyArrows.length) return null;
          return (
            <g key={`arrows-${offsetX}`} transform={`translate(${offsetX}, 0)`}>
              {copyArrows.map(action => {
                const raw = action.actionData as { army_id?: string; to_province_id?: string } | undefined;
                const toId = raw?.to_province_id;
                const army = armies.find(a => a.id === raw?.army_id);
                const fromId = army?.province_id;
                if (!fromId || !toId) return null;
                const fromC = provinceCentersById[fromId];
                const toC   = provinceCentersById[toId];
                if (!fromC || !toC) return null;
                const dx = toC.x - fromC.x;
                const toCx = mapWidth > 0 && Math.abs(dx) > mapWidth / 2
                  ? toC.x + (dx > 0 ? -mapWidth : mapWidth)
                  : toC.x;
                const mx = (fromC.x + toCx) / 2;
                const my = (fromC.y + toC.y) / 2;
                const label = army?.name ?? '⚔';
                const boxW = Math.max(28, 8 + label.length * 7);
                return (
                  <g key={action.id}>
                    <line x1={fromC.x} y1={fromC.y} x2={toCx} y2={toC.y}
                      stroke="#fbbf24" strokeWidth={2}
                      style={{ pointerEvents: 'none' }} />
                    <rect x={mx - boxW / 2} y={my - 10} width={boxW} height={20}
                      fill="#fbbf24" stroke="#92400e" strokeWidth={1} rx={3} ry={3}
                      style={{ cursor: 'pointer' }}
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); handleOpenCancelModal(action.id); }} />
                    <text x={mx} y={my} fontSize={11} fill="#1c1917"
                      textAnchor="middle" dominantBaseline="middle" fontWeight="bold"
                      style={{ userSelect: 'none', cursor: 'pointer' }}
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); handleOpenCancelModal(action.id); }}>
                      {label}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

      </svg>
    </div>
  );
};
