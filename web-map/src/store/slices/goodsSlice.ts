import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserGoodHolding } from '../../types';

interface GoodsState {
  mine: UserGoodHolding[];
}

const initialState: GoodsState = {
  mine: [],
};

const goodsSlice = createSlice({
  name: 'goods',
  initialState,
  reducers: {
    setMyGoods: (state, action: PayloadAction<UserGoodHolding[]>) => {
      state.mine = action.payload;
    },
  },
});

export const { setMyGoods } = goodsSlice.actions;
export default goodsSlice.reducer;
