import { AppBar, Button, Toolbar } from "@mui/material";
import { useAppSelector } from "../store/hooks.ts";
import { useMutation } from "../hooks/useApi.ts";
import { authApi } from "../api/auth.ts";

export const TopBar = () => {
  const user = useAppSelector(state => state.user);
  const { mutate } = useMutation(authApi.logout);

  const handleLogout = async () => {
    try {
      await mutate();
      window.location.reload();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  return (
    <AppBar position="static">
      <Toolbar
        className="fixed top-0 flex w-full z-50 justify-end items-center bg-[#0e0e0e]/80 backdrop-blur-xl bg-gradient-to-b from-[#1a1a1a] to-transparent shadow-[0_4px_20px_rgba(0,0,0,0.5)] border-b border-outline-variant/10">
        <div className="flex items-center gap-6">
          <div
            className="flex items-center gap-4 px-4 py-2 bg-surface-container rounded-lg border border-outline-variant/15">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-sm" data-icon="groups">groups</span>
              <span
                className="font-headline font-bold text-primary text-xs uppercase tracking-wider">Troops: {user.troops}</span>
            </div>
            <div className="w-px h-4 bg-outline-variant/30"></div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-sm" data-icon="payments">payments</span>
              <span className="font-headline font-bold text-secondary text-xs uppercase tracking-wider">Money: {user.money}</span>
            </div>
          </div>
          <Button
            className="flex items-center mr-12 gap-2 px-4 py-2 bg-error-container/20 border border-error/30 rounded hover:bg-error-container/40 transition-all active:scale-95 text-error font-headline font-bold text-[10px] uppercase tracking-widest cursor-pointer"
            onClick={handleLogout}
          >
            <span className="material-symbols-outlined text-sm" data-icon="logout">logout</span>
            Logout
          </Button>
        </div>
      </Toolbar>
    </AppBar>
  )
};
