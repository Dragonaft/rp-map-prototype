import React, { useEffect, useMemo, useState } from 'react';
import { Building } from '../types.ts';
import { useAppDispatch, useAppSelector } from '../store/hooks.ts';
import type { RootState } from '../store/store.ts';
import { setFastBuild } from '../store/slices/provincesSlice.ts';
import { GameIcon } from './GameIcon.tsx';

interface Props {
  buildings: Building[];
}

type PanelView = 'closed' | 'menu' | 'build-picker' | 'upgrade-picker';

const optionButtonClass = 'w-full text-left text-sm px-3 py-2 rounded border border-outline-variant/10 bg-gray-200 hover:bg-gray-100 flex items-center gap-2';

/**
 * Left-side shortcut for queuing BUILD/UPGRADE actions across every owned province at once,
 * instead of selecting provinces one at a time. Picking a building here dispatches
 * `setFastBuild`, which switches the map into `'fastbuild'` mode (see mapModes.ts /
 * ProvinceShape.tsx) — provinces then tint green/red/yellow by eligibility, and MapView's
 * click handler queues the action on a green/yellow click. This component only owns the
 * picker UI; all eligibility/coloring/queuing logic lives in MapView + utils/mapModes.ts so
 * both the fast-build flow and the normal per-province build menu share one source of truth.
 */
export const FastBuildPanel: React.FC<Props> = ({ buildings }) => {
  const dispatch = useAppDispatch();
  const fastBuild = useAppSelector((state: RootState) => state.provinces.fastBuild);
  const mapMode = useAppSelector((state: RootState) => state.provinces.mapMode);
  const [view, setView] = useState<PanelView>('closed');

  const isActive = mapMode === 'fastbuild' && !!fastBuild;

  // If fast-build mode is exited from elsewhere (e.g. the TopBar's own map-mode menu),
  // collapse this panel back to idle instead of showing a stale picker on next open.
  useEffect(() => {
    if (!isActive) setView('closed');
  }, [isActive]);

  // Same buildable-list conventions as SelectedProvinceHover: direct builds exclude
  // anything only reachable via upgrade; upgrade targets are exactly that excluded set.
  const buildableBuildings = useMemo(
    () => buildings.filter((b) => b.buildable && !b.requirementBuilding),
    [buildings],
  );
  const upgradeTargetBuildings = useMemo(
    () => buildings.filter((b) => b.buildable && b.requirementBuilding),
    [buildings],
  );

  const selectedBuilding = useMemo(
    () => (fastBuild ? buildings.find((b) => b.id === fastBuild.buildingId) ?? null : null),
    [fastBuild, buildings],
  );

  const handleClose = () => {
    if (isActive) dispatch(setFastBuild(null));
    setView('closed');
  };

  if (!isActive && view === 'closed') {
    return (
      <div className="absolute left-5 top-4 z-10">
        <button
          type="button"
          onClick={() => setView('menu')}
          className="w-12 h-12 text-2xl rounded-lg border border-outline-variant/10 bg-gray-400 hover:bg-gray-300 flex items-center justify-center shadow cursor-pointer"
          title="Fast build"
        >
          🔨
        </button>
      </div>
    );
  }

  return (
    <div className="w-60 bg-gray-400 rounded-lg border border-outline-variant/10 p-4 flex flex-col gap-3 absolute left-5 top-4 max-h-[90vh] overflow-y-auto z-10">
      <div className="flex items-center justify-between">
        <h2 className="font-headline text-sm font-bold tracking-widest text-on-surface uppercase">Fast Build</h2>
        <button type="button" className="text-xs underline cursor-pointer" onClick={handleClose}>
          {isActive ? 'Exit' : 'Close'}
        </button>
      </div>

      {isActive && selectedBuilding && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <GameIcon kind="building" iconKey={selectedBuilding.type} className="w-5 h-5" />
            <span className="font-semibold">
              {fastBuild!.action === 'build' ? 'Building' : 'Upgrading to'}: {selectedBuilding.name}
            </span>
          </div>
          <p className="text-xs text-gray-700">
            Green = buildable now, yellow = already queued here, red = not possible, black = not
            your territory. Click a green or yellow province to queue it; right-click a yellow
            province to cancel its pending action.
          </p>
        </div>
      )}

      {!isActive && view === 'menu' && (
        <div className="flex flex-col gap-2">
          <button type="button" className={optionButtonClass} onClick={() => setView('build-picker')}>
            <span>▸</span> Build
          </button>
          <button type="button" className={optionButtonClass} onClick={() => setView('upgrade-picker')}>
            <span>▸</span> Upgrade
          </button>
        </div>
      )}

      {!isActive && view === 'build-picker' && (
        <div className="flex flex-col gap-1">
          <button type="button" className="text-xs underline self-start cursor-pointer" onClick={() => setView('menu')}>
            ← Back
          </button>
          {buildableBuildings.map((b) => (
            <button
              key={b.id}
              type="button"
              className={optionButtonClass}
              onClick={() => dispatch(setFastBuild({ action: 'build', buildingId: b.id }))}
            >
              <GameIcon kind="building" iconKey={b.type} className="w-4 h-4" />
              <span>{b.name}</span>
            </button>
          ))}
          {buildableBuildings.length === 0 && <p className="text-xs text-gray-700">No buildings available.</p>}
        </div>
      )}

      {!isActive && view === 'upgrade-picker' && (
        <div className="flex flex-col gap-1">
          <button type="button" className="text-xs underline self-start cursor-pointer" onClick={() => setView('menu')}>
            ← Back
          </button>
          {upgradeTargetBuildings.map((b) => (
            <button
              key={b.id}
              type="button"
              className={optionButtonClass}
              onClick={() => dispatch(setFastBuild({ action: 'upgrade', buildingId: b.id }))}
            >
              <GameIcon kind="building" iconKey={b.type} className="w-4 h-4" />
              <span>{b.name}</span>
            </button>
          ))}
          {upgradeTargetBuildings.length === 0 && <p className="text-xs text-gray-700">No upgrades available.</p>}
        </div>
      )}
    </div>
  );
};
