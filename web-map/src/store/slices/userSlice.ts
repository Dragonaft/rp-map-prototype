import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Province } from "../../types.ts";

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
  /** Net Food/turn: production (CAPITAL/FARM/GARDEN) minus every army's distance-scaled supply cost. */
  projectedFood: number;
  isNew: boolean;
  provinces: Province[];
  completedResearch: string[];
  researchPoints: number;
  activeResearch: string | null;
  role?: string | null;
  isNpc?: boolean;
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
  projectedFood: 0,
  isNew: false,
  provinces: [],
  completedResearch: [],
  researchPoints: 0,
  activeResearch: null,
  role: null,
  isNpc: false,
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
      state.projectedFood = action.payload.projectedFood ?? 0;
      state.isNew = action.payload.isNew;
      state.provinces = action.payload.provinces;
      state.completedResearch = action.payload.completedResearch ?? [];
      state.researchPoints = action.payload.researchPoints;
      state.activeResearch = action.payload.activeResearch ?? null;
      state.role = action.payload.role ?? null;
      state.isNpc = action.payload.isNpc ?? false;
    },
    updateUserTroops: (state, action: PayloadAction<number>) => {
      state.troops = action.payload;
    },
    updateUserMoney: (state, action: PayloadAction<number>) => {
      state.money = action.payload;
    },
    updateUserProfile: (state, action: PayloadAction<{ countryName: string; color: string }>) => {
      state.countryName = action.payload.countryName;
      state.color = action.payload.color;
    },
    setActiveResearch: (state, action: PayloadAction<string>) => {
      state.activeResearch = action.payload;
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
      state.activeResearch = null;
      state.role = null;
      state.isNpc = false;
    },
  },
});

export const { setUser, updateUserTroops, updateUserMoney, updateUserProfile, setActiveResearch, resetUserState } = userSlice.actions;
export default userSlice.reducer;
