import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import { MapMode, Province } from '../../types.ts';

interface SelectedTroops {
  provinceId: string;
  troopCount: number;
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ProvincesState {
  provinces: Province[];
  selectedProvinceId: string | null;
  selectedTroops: SelectedTroops | null;
  mapMode: MapMode;
  mapModeFilterValue: string | null;
  provinceCentersById: Record<string, { x: number; y: number }>;
  provinceBBoxById: Record<string, BBox>;
  mapWidth: number;
  mapHeight: number;
}

/**
 * Parses an SVG path string and returns its axis-aligned bounding box.
 * Works for rectangular grid paths (M/H/V/Z) and arbitrary polygons (M/L).
 * Pure math — no DOM access.
 */
function parseBBox(polygon: string): BBox {
  const nums = polygon.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i], y = nums[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

const initialState: ProvincesState = {
  provinces: [],
  selectedProvinceId: null,
  selectedTroops: null,
  mapMode: 'normal',
  mapModeFilterValue: null,
  provinceCentersById: {},
  provinceBBoxById: {},
  mapWidth: 0,
  mapHeight: 0,
};

const provincesSlice = createSlice({
  name: 'provinces',
  initialState,
  reducers: {
    setSelectedProvinceId: (state, action: PayloadAction<string | null>) => {
      state.selectedProvinceId = action.payload;
    },
    setSelectedTroops: (state, action: PayloadAction<SelectedTroops | null>) => {
      state.selectedTroops = action.payload;
    },
    setMapMode: (state, action: PayloadAction<MapMode>) => {
      state.mapMode = action.payload;
      state.mapModeFilterValue = null;
    },
    setMapModeFilterValue: (state, action: PayloadAction<string | null>) => {
      state.mapModeFilterValue = action.payload;
    },
    setProvinces: (state, action: PayloadAction<any[]>) => {
      state.provinces = action.payload;
      const centersById: Record<string, { x: number; y: number }> = {};
      const bboxById: Record<string, BBox> = {};
      let maxX = 0, maxY = 0;
      for (const p of action.payload) {
        if (!p?.polygon) continue;
        const bbox = parseBBox(p.polygon);
        centersById[p.id] = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
        bboxById[p.id] = bbox;
        if (bbox.x + bbox.width > maxX) maxX = bbox.x + bbox.width;
        if (bbox.y + bbox.height > maxY) maxY = bbox.y + bbox.height;
      }
      state.provinceCentersById = centersById;
      state.provinceBBoxById = bboxById;
      state.mapWidth = maxX;
      state.mapHeight = maxY;
    },
    updateProvinceById: (state, action: PayloadAction<{ id: string; updates: Partial<Province> }>) => {
      const { id, updates } = action.payload;
      const idx = state.provinces.findIndex((p) => p.id === id);
      if (idx !== -1) {
        state.provinces[idx] = { ...state.provinces[idx], ...updates };
      }
    },
    resetProvincesState: (state) => {
      state.selectedProvinceId = null;
      state.selectedTroops = null;
      state.provinces = [];
      state.mapMode = 'normal';
      state.mapModeFilterValue = null;
      state.provinceCentersById = {};
      state.provinceBBoxById = {};
      state.mapWidth = 0;
      state.mapHeight = 0;
    },
  },
});

export const {
  setSelectedProvinceId,
  setSelectedTroops,
  setMapMode,
  setMapModeFilterValue,
  setProvinces,
  updateProvinceById,
  resetProvincesState,
} = provincesSlice.actions;

export const selectSelectedProvince = (state: RootState) => {
  const { selectedProvinceId, provinces } = state.provinces;
  if (!selectedProvinceId) return null;
  return provinces.find((p) => p.id === selectedProvinceId) || null;
};

export default provincesSlice.reducer;
