import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Resource, UserResourceHolding } from '../../types';

interface ResourcesState {
  resources: Resource[];
  mine: UserResourceHolding[];
}

const initialState: ResourcesState = {
  resources: [],
  mine: [],
};

const resourcesSlice = createSlice({
  name: 'resources',
  initialState,
  reducers: {
    setResources: (state, action: PayloadAction<Resource[]>) => {
      state.resources = action.payload;
    },
    setMyResources: (state, action: PayloadAction<UserResourceHolding[]>) => {
      state.mine = action.payload;
    },
  },
});

export const { setResources, setMyResources } = resourcesSlice.actions;
export default resourcesSlice.reducer;
