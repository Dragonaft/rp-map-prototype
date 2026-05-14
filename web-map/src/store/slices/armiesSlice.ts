import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Army, TroopType } from '../../types';

interface ArmiesState {
  armies: Army[];
  troopTypes: TroopType[];
}

const initialState: ArmiesState = {
  armies: [],
  troopTypes: [],
};

const armiesSlice = createSlice({
  name: 'armies',
  initialState,
  reducers: {
    setArmies: (state, action: PayloadAction<Army[]>) => {
      state.armies = action.payload;
    },
    addArmy: (state, action: PayloadAction<Army>) => {
      state.armies = [...state.armies, action.payload];
    },
    updateArmy: (state, action: PayloadAction<Army>) => {
      const idx = state.armies.findIndex((a) => a.id === action.payload.id);
      if (idx !== -1) state.armies[idx] = action.payload;
    },
    removeArmyById: (state, action: PayloadAction<string>) => {
      state.armies = state.armies.filter((a) => a.id !== action.payload);
    },
    setTroopTypes: (state, action: PayloadAction<TroopType[]>) => {
      state.troopTypes = action.payload;
    },
  },
});

export const { setArmies, addArmy, updateArmy, removeArmyById, setTroopTypes } = armiesSlice.actions;
export default armiesSlice.reducer;
