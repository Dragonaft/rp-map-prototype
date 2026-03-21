import React, { useState, useEffect } from 'react';
import { Box, FormControl, TextField } from "@mui/material";

export const LoginPage: React.FC = () => {
  return (
    <div className="flex items-center justify-center w-full h-screen bg-neutral-600">
      <Box className="w-full max-w-sm h-56 p-8 bg-amber-200 rounded-lg shadow-lg">
        <form noValidate autoComplete="off">
          <FormControl>
            <TextField name="login" label="Outlined" variant="outlined" />
            <TextField id="password" label="Outlined" variant="outlined" />
          </FormControl>
        </form>
      </Box>
    </div>
  );
};
