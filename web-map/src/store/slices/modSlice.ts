import { createSlice, PayloadAction } from '@reduxjs/toolkit';
// Type-only import: avoids a runtime circular dependency (api/mod.ts -> api/config.ts -> store.ts -> this file).
import type { ModNpc } from '../../api/mod.ts';

const SWITCH_KEY = 'mod.switchOn';
const ACTING_AS_KEY = 'mod.actingAsUserId';

interface ModState {
  /** MOD switch — when ON, the instant god-mode tools are exposed in the game UI. */
  switchOn: boolean;
  /** The NPC (or own) country id the mod is currently "playing" as, or null for the mod's own country. */
  actingAsUserId: string | null;
  npcs: ModNpc[];
}

// The client reloads on every turn tick (SSE-driven), so this context has to survive a
// full page reload — it's not just in-memory React state.
const readBool = (key: string): boolean => localStorage.getItem(key) === 'true';
const readString = (key: string): string | null => localStorage.getItem(key) || null;

const initialState: ModState = {
  switchOn: readBool(SWITCH_KEY),
  actingAsUserId: readString(ACTING_AS_KEY),
  npcs: [],
};

const modSlice = createSlice({
  name: 'mod',
  initialState,
  reducers: {
    setModSwitch: (state, action: PayloadAction<boolean>) => {
      state.switchOn = action.payload;
      localStorage.setItem(SWITCH_KEY, String(action.payload));
    },
    setActingAsUserId: (state, action: PayloadAction<string | null>) => {
      state.actingAsUserId = action.payload;
      if (action.payload) {
        localStorage.setItem(ACTING_AS_KEY, action.payload);
      } else {
        localStorage.removeItem(ACTING_AS_KEY);
      }
    },
    setNpcs: (state, action: PayloadAction<ModNpc[]>) => {
      state.npcs = action.payload;
    },
  },
});

export const { setModSwitch, setActingAsUserId, setNpcs } = modSlice.actions;
export default modSlice.reducer;
