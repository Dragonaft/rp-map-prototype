import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Tech } from '../../types';

interface TechsState {
  techs: Tech[];
}

const initialState: TechsState = {
  techs: [],
};

const techsSlice = createSlice({
  name: 'techs',
  initialState,
  reducers: {
    setTechs: (state, action: PayloadAction<Tech[]>) => {
      state.techs = action.payload;
    },
  },
});

export const { setTechs } = techsSlice.actions;
export default techsSlice.reducer;
