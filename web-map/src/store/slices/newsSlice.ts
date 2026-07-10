import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { NewsAgency } from '../../types';

interface NewsState {
  agencies: NewsAgency[];
}

const initialState: NewsState = {
  agencies: [],
};

const newsSlice = createSlice({
  name: 'news',
  initialState,
  reducers: {
    setAgencies: (state, action: PayloadAction<NewsAgency[]>) => {
      state.agencies = action.payload;
    },
  },
});

export const { setAgencies } = newsSlice.actions;
export default newsSlice.reducer;
