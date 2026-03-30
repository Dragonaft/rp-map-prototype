import React, { useEffect } from 'react';
import { Box, Button, TextField } from '@mui/material';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useMutation } from '../../../hooks/useApi.ts';
import { authApi } from '../../../api/auth.ts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../../../context/AuthContext.tsx";

interface IRegisterFormInput {
  login: string
  password: string
  countryName: string
  color: string
}

export const RegisterPage: React.FC = () => {
  const { register, handleSubmit } = useForm<IRegisterFormInput>()
  const { mutate } = useMutation(authApi.register);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const onSubmit: SubmitHandler<IRegisterFormInput> = async (data) => {
    await mutate(data);
  }

  const onBackToLogin = () => {
    navigate('/login');
  }

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated]);

  return (
    <div className="flex items-center justify-center w-full h-screen bg-neutral-600">
      <Box className="w-full max-w-sm h-1/3 p-8 bg-amber-200 rounded-lg shadow-lg">
        <Button size="small" variant="contained" color="primary" type="button" onClick={onBackToLogin}>Back</Button>
        <span className="w-full text-center">Register</span>
        <form noValidate autoComplete="off" onSubmit={handleSubmit(onSubmit)} className="flex flex-col space-y-4">
          <TextField
            {...register("login", { required: true })}
            label="Login"
            variant="outlined"
          />
          <TextField
            {...register("password", { required: true })}
            label="Password"
            variant="outlined"
            type="password"
          />
          <TextField
            {...register("countryName", { required: true })}
            label="countryName"
            variant="outlined"
          />
          <TextField
            {...register("color", { required: true })}
            label="color"
            variant="outlined"
          />
          <Button variant="contained" color="primary" type="submit">Register</Button>
        </form>
      </Box>
    </div>
  );
};
