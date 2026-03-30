import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ActionType } from "../../types.ts";

interface ActionI {
  id: string,
  userId: string,
  order: number,
  actionType: ActionType,
  actionData: any,
  status: string,
  failureReason: null,
  createdAt: string,
  updatedAt: string,
}

interface ActionState {
  actions: ActionI[];
}

const initialState: ActionState = {
  actions: []
};

const actionsSlice = createSlice({
  name: 'actions',
  initialState,
  reducers: {
    setActions: (state, action: PayloadAction<ActionI[]>) => {
      state.actions = action.payload;
    },
  },
});

export const { setActions } = actionsSlice.actions;
export default actionsSlice.reducer;
