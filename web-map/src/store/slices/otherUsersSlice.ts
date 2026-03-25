import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PartialUser } from "../../types.ts";

interface OtherUserStateI {
  otherUsers: PartialUser[];
}

const initialState: OtherUserStateI = {
  otherUsers: [],
};

const otherUsersSlice = createSlice({
  name: 'otherUsers',
  initialState,
  reducers: {
    setOtherUsers: (state, action: PayloadAction<PartialUser[]>) => {
      state.otherUsers = action.payload;
    },
  },
});

export const { setOtherUsers } = otherUsersSlice.actions;
export default otherUsersSlice.reducer;
