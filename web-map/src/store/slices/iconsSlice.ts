import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GameIconMeta } from '../../types';

interface IconsState {
  icons: GameIconMeta[];
}

const initialState: IconsState = {
  icons: [],
};

const iconsSlice = createSlice({
  name: 'icons',
  initialState,
  reducers: {
    setIcons: (state, action: PayloadAction<GameIconMeta[]>) => {
      state.icons = action.payload;
    },
  },
});

export const { setIcons } = iconsSlice.actions;
export default iconsSlice.reducer;
