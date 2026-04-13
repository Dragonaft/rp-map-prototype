import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Building } from '../../types';

interface BuildingsState {
  buildings: Building[];
}

const initialState: BuildingsState = {
  buildings: [],
};

const buildingsSlice = createSlice({
  name: 'buildings',
  initialState,
  reducers: {
    setBuildings: (state, action: PayloadAction<Building[]>) => {
      state.buildings = action.payload;
    },
  },
});

export const { setBuildings } = buildingsSlice.actions;
export default buildingsSlice.reducer;
