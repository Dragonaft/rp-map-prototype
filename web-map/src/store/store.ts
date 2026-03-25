import { configureStore } from '@reduxjs/toolkit';
import userReducer from './slices/userSlice.ts';
import provincesReducer from './slices/provincesSlice.ts';

export const store = configureStore({
  reducer: {
    user: userReducer,
    provinces: provincesReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
