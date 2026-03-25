import { configureStore } from '@reduxjs/toolkit';
import userReducer from './slices/userSlice.ts';
import provincesReducer from './slices/provincesSlice.ts';
import otherUsersReducer from "./slices/otherUsersSlice.ts";

export const store = configureStore({
  reducer: {
    user: userReducer,
    otherUsers: otherUsersReducer,
    provinces: provincesReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
