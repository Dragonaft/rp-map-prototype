import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import { Province } from "../../types.ts";

interface SelectedTroops {
  provinceId: string;
  troopCount: number;
}

interface ProvincesState {
  provinces: Province[];
  selectedProvinceId: string | null;
  selectedTroops: SelectedTroops | null;
  /** Bumped when setProvinces runs so shapes re-measure and re-register centers */
  provincesLayoutVersion: number;
  provinceCentersById: Record<string, { x: number; y: number }>;
}

const initialState: ProvincesState = {
  provinces: [],
  selectedProvinceId: null,
  selectedTroops: null,
  provincesLayoutVersion: 0,
  provinceCentersById: {},
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
    setProvinces: (state, action: PayloadAction<any[]>) => {
      state.provinces = action.payload;
      state.provinceCentersById = {};
      state.provincesLayoutVersion += 1;
    },
    setProvinceCenter: (
      state,
      action: PayloadAction<{ id: string; x: number; y: number }>,
    ) => {
      const { id, x, y } = action.payload;
      state.provinceCentersById[id] = { x, y };
    },
    updateProvinceById: (state, action: PayloadAction<{ id: string; updates: Partial<Province> }>) => {
      const { id, updates } = action.payload;
      const provinceIndex = state.provinces.findIndex((p) => p.id === id);
      if (provinceIndex !== -1) {
        state.provinces[provinceIndex] = { ...state.provinces[provinceIndex], ...updates };
      }
    },
    // updateProvinces: (state, action: PayloadAction<any[]>) => {
    //   state.provinces = action.payload;
    // },
    resetProvincesState: (state) => {
      state.selectedProvinceId = null;
      state.selectedTroops = null;
      state.provinces = [];
      state.provinceCentersById = {};
      state.provincesLayoutVersion += 1;
    },
  },
});

export const {
  setSelectedProvinceId,
  setSelectedTroops,
  setProvinces,
  setProvinceCenter,
  updateProvinceById,
  resetProvincesState,
} = provincesSlice.actions;

// Selector to get the selected province object
export const selectSelectedProvince = (state: RootState) => {
  const { selectedProvinceId, provinces } = state.provinces;
  if (!selectedProvinceId) return null;
  return provinces.find((p) => p.id === selectedProvinceId) || null;
};

export default provincesSlice.reducer;
