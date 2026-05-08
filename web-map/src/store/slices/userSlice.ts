import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Province, UserResources } from "../../types.ts";

interface UserState {
  id: string;
  login: string;
  countryName: string;
  color: string;
  money: number;
  troops: number;
  piety: number;
  class: string | null;
  projectedIncome: number;
  projectedPiety: number | null;
  projectedResearch: number;
  projectedTroops: number;
  isNew: boolean;
  provinces: Province[];
  completedResearch: string[];
  researchPoints: number;
  resources: UserResources;
}

const initialState: UserState = {
  id: '',
  login: '',
  countryName: '',
  color: '',
  money: 0,
  troops: 0,
  piety: 0,
  class: null,
  projectedIncome: 0,
  projectedPiety: null,
  projectedResearch: 0,
  projectedTroops: 0,
  isNew: false,
  provinces: [],
  completedResearch: [],
  researchPoints: 0,
  resources: { stone: 0, iron: 0, gold: 0, wood: 0 },
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
      state.piety = action.payload.piety ?? 0;
      state.class = action.payload.class ?? null;
      state.projectedIncome = action.payload.projectedIncome;
      state.projectedPiety = action.payload.projectedPiety;
      state.projectedResearch = action.payload.projectedResearch;
      state.projectedTroops = action.payload.projectedTroops;
      state.isNew = action.payload.isNew;
      state.provinces = action.payload.provinces;
      state.completedResearch = action.payload.completedResearch ?? [];
      state.researchPoints = action.payload.researchPoints;
      state.resources = action.payload.resources ?? { stone: 0, iron: 0, gold: 0, wood: 0 };
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
      state.piety = 0;
      state.class = null;
      state.isNew = false;
      state.provinces = [];
      state.completedResearch = [];
      state.researchPoints = 0;
    },
  },
});

export const { setUser, updateUserTroops, updateUserMoney, resetUserState } = userSlice.actions;
export default userSlice.reducer;
