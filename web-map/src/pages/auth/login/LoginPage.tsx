import React, { useEffect } from 'react';
import { Box, Button, TextField } from '@mui/material';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useMutation } from '../../../hooks/useApi.ts';
import { authApi } from '../../../api/auth.ts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';

interface ILoginFormInput {
  login: string
  password: string
}

export const LoginPage: React.FC = () => {
  const { register, handleSubmit } = useForm<ILoginFormInput>()
  const { mutate } = useMutation(authApi.login);
  const { login: setUser, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const onSubmit: SubmitHandler<ILoginFormInput> = async (data) => {
    try {
      const response = await mutate(data);
      if (response?.user) {
        setUser(response.user);
        navigate('/');
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  }

  const onRegisterClick = () => {
    navigate('/register');
  }

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated]);

  return (
    <div className="flex items-center justify-center w-full h-screen bg-neutral-600">
      <Box className="w-full max-w-sm h-56 p-8 bg-amber-200 rounded-lg shadow-lg">
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
          <Button variant="contained" color="primary" type="submit">Login</Button>
          <Button variant="contained" color="primary" type="button" onClick={onRegisterClick}>Register</Button>
        </form>
      </Box>
    </div>
  );
};
