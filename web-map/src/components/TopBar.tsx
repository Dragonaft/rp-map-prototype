import { AppBar, Button, Divider, Toolbar, Typography } from "@mui/material";
import { useAppSelector } from "../store/hooks.ts";

export const TopBar = () => {
  const user = useAppSelector(state => state.user);

  return (
    <AppBar position="static">
      <Toolbar className="flex justify-between space-x-3">
        {/*<IconButton*/}
        {/*  size="large"*/}
        {/*  edge="start"*/}
        {/*  color="inherit"*/}
        {/*  aria-label="menu"*/}
        {/*  sx={{ mr: 2 }}*/}
        {/*>*/}
        {/*  <MenuIcon />*/}
        {/*</IconButton>*/}
        <Typography>
          Money: {user.money} (+123)
        </Typography>
        <Divider className="h-full" orientation="vertical" variant="middle" flexItem />
        <Typography flexGrow={1}>
          Reserve troops: {user.troops}
        </Typography>
        <Divider orientation="vertical" variant="middle" flexItem />
        <Button color="inherit">Login</Button>
      </Toolbar>
    </AppBar>
  )
};
