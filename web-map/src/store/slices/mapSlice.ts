import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface MapState {
  selectedProvinceId: string | null;
  zoom: number;
  center: { x: number; y: number };
}

const initialState: MapState = {
  selectedProvinceId: null,
  zoom: 1,
  center: { x: 0, y: 0 },
};

const mapSlice = createSlice({
  name: 'map',
  initialState,
  reducers: {
    setSelectedProvince: (state, action: PayloadAction<string | null>) => {
      state.selectedProvinceId = action.payload;
    },
    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = action.payload;
    },
    setCenter: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.center = action.payload;
    },
    resetMapState: (state) => {
      state.selectedProvinceId = null;
      state.zoom = 1;
      state.center = { x: 0, y: 0 };
    },
  },
});

export const { setSelectedProvince, setZoom, setCenter, resetMapState } = mapSlice.actions;
export default mapSlice.reducer;
