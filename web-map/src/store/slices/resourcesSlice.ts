import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Resource } from '../../types';

interface ResourcesState {
  resources: Resource[];
}

const initialState: ResourcesState = {
  resources: [],
};

const resourcesSlice = createSlice({
  name: 'resources',
  initialState,
  reducers: {
    setResources: (state, action: PayloadAction<Resource[]>) => {
      state.resources = action.payload;
    },
  },
});

export const { setResources } = resourcesSlice.actions;
export default resourcesSlice.reducer;
