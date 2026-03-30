import { useAppSelector, useAppDispatch } from "../store/hooks.ts";
import type { RootState } from "../store/store.ts";

export const UserActionsHover = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state: RootState) => state.user);
  const userActions = useAppSelector((state: RootState) => state.actions.actions);

  if (!userActions) return null;

  return (
    <div className="w-60 h-80 p-2 bg-white absolute left-1 top-1">
    </div>
  );
};
