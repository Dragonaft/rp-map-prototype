import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Province } from "../../types.ts";

interface UserState {
  id: string;
  login: string;
  countryName: string;
  color: string;
  money: number;
  troops: number;
  isNew: boolean;
  provinces: Province[];
  completedResearch: string[];
  researchPoints: number;
}

const initialState: UserState = {
  id: '',
  login: '',
  countryName: '',
  color: '',
  money: 0,
  troops: 0,
  isNew: false,
  provinces: [],
  completedResearch: [],
  researchPoints: 0
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
      state.provinces = action.payload.provinces;
      state.completedResearch = action.payload.completedResearch ?? [];
      state.researchPoints = action.payload.researchPoints;
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
      state.provinces = [];
      state.completedResearch = [];
      state.researchPoints = 0;
    },
  },
});

export const { setUser, updateUserTroops, updateUserMoney, resetUserState } = userSlice.actions;
export default userSlice.reducer;
