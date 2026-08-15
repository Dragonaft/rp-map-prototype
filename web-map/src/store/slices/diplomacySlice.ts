import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DiplomaticRelation, Treaty, War } from '../../types';

interface DiplomacyState {
  relations: DiplomaticRelation[];
  wars: War[];
  treaties: Treaty[];
}

const initialState: DiplomacyState = {
  relations: [],
  wars: [],
  treaties: [],
};

const diplomacySlice = createSlice({
  name: 'diplomacy',
  initialState,
  reducers: {
    setRelations: (state, action: PayloadAction<DiplomaticRelation[]>) => {
      state.relations = action.payload;
    },
    setWars: (state, action: PayloadAction<War[]>) => {
      state.wars = action.payload;
    },
    setTreaties: (state, action: PayloadAction<Treaty[]>) => {
      state.treaties = action.payload;
    },
  },
});

export const { setRelations, setWars, setTreaties } = diplomacySlice.actions;
export default diplomacySlice.reducer;
