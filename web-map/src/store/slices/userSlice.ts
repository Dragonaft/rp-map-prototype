import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UserState {
  id: string;
  login: string;
  countryName: string;
  color: string;
  money: number;
  troops: number;
  isNew: boolean;
}

const initialState: UserState = {
  id: '',
  login: '',
  countryName: '',
  color: '',
  money: 0,
  troops: 0,
  isNew: false,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<UserState>) => {
      state.id = action.payload.id;
      state.login = action.payload.login;
      state.countryName = action.payload.countryName;
      state.color = action.payload.color;
      state.money = action.payload.money;
      state.troops = action.payload.troops;
      state.isNew = action.payload.isNew;
    },
    updateUserTroops: (state, action: PayloadAction<number>) => {
      state.troops = action.payload;
    },
    updateUserMoney: (state, action: PayloadAction<number>) => {
      state.money = action.payload;
    },
    resetUserState: (state) => {
      state.id = '';
      state.login = '';
      state.countryName = '';
      state.color = '';
      state.money = 0;
      state.troops = 0;
      state.isNew = false;
    },
  },
});

export const { setUser, updateUserTroops, updateUserMoney, resetUserState } = userSlice.actions;
export default userSlice.reducer;
