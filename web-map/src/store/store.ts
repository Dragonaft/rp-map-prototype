import { configureStore } from '@reduxjs/toolkit';
import userReducer from './slices/userSlice.ts';
import provincesReducer from './slices/provincesSlice.ts';
import otherUsersReducer from "./slices/otherUsersSlice.ts";
import actionsReducer from "./slices/actionsSlice.ts";
import buildingsReducer from "./slices/buildingsSlice.ts";
import techsReducer from "./slices/techsSlice.ts";
import armiesReducer from "./slices/armiesSlice.ts";
import resourcesReducer from "./slices/resourcesSlice.ts";
import goodsReducer from "./slices/goodsSlice.ts";
import diplomacyReducer from "./slices/diplomacySlice.ts";
import notificationsReducer from "./slices/notificationsSlice.ts";
import newsReducer from "./slices/newsSlice.ts";
import modReducer from "./slices/modSlice.ts";
import iconsReducer from "./slices/iconsSlice.ts";

export const store = configureStore({
  reducer: {
    user: userReducer,
    otherUsers: otherUsersReducer,
    provinces: provincesReducer,
    actions: actionsReducer,
    buildings: buildingsReducer,
    techs: techsReducer,
    armies: armiesReducer,
    resources: resourcesReducer,
    goods: goodsReducer,
    diplomacy: diplomacyReducer,
    notifications: notificationsReducer,
    news: newsReducer,
    mod: modReducer,
    icons: iconsReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
