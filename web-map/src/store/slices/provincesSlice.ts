import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import { Province } from "../../types.ts";

interface ProvincesState {
  provinces: Province[];
  selectedProvinceId: string | null;
}

const initialState: ProvincesState = {
  provinces: [],
  selectedProvinceId: null,
};

const provincesSlice = createSlice({
  name: 'provinces',
  initialState,
  reducers: {
    setSelectedProvinceId: (state, action: PayloadAction<string | null>) => {
      state.selectedProvinceId = action.payload;
    },
    setProvinces: (state, action: PayloadAction<any[]>) => {
      state.provinces = action.payload;
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
      state.provinces = [];
    },
  },
});

export const { setSelectedProvinceId, setProvinces, updateProvinceById, resetProvincesState } = provincesSlice.actions;

// Selector to get the selected province object
export const selectSelectedProvince = (state: RootState) => {
  const { selectedProvinceId, provinces } = state.provinces;
  if (!selectedProvinceId) return null;
  return provinces.find((p) => p.id === selectedProvinceId) || null;
};

export default provincesSlice.reducer;
