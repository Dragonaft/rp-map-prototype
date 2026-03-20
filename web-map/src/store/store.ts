import { configureStore } from '@reduxjs/toolkit';
import mapReducer from './slices/mapSlice';

export const store = configureStore({
  reducer: {
    map: mapReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
