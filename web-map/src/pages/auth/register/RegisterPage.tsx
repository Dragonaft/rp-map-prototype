import React, { useEffect, useState } from 'react';
import { Box, Button } from '@mui/material';
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
  const { register, handleSubmit, watch, formState: { errors } } = useForm<IRegisterFormInput>()
  const { mutate } = useMutation(authApi.register);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isCheck, setIsCheck] = useState<boolean>(false);
  const colorValue = watch('color', '');

  const onSubmit: SubmitHandler<IRegisterFormInput> = async (data) => {
    try {
      await mutate(data);
    } catch (e) {
      console.log(e)
    } finally {
      navigate('/login');
    }
  }

  // const onBackToLogin = () => {
  //   navigate('/login');
  // }

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated]);

  return (
    <div className="relative z-20 flex-1 flex items-center justify-center p-6">
      <Box className="w-full max-w-md">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[120px]"></div>
        <div
          className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-secondary/5 rounded-full blur-[120px]"></div>
        <div className="flex flex-col items-center mb-10 text-center">
          <div
            className="mb-4 px-4 py-2 border border-outline-variant/20 bg-surface-container/40 backdrop-blur-md rounded-lg">
          <span
            className="command-font text-2xl font-bold tracking-tighter text-primary drop-shadow-[0_0_8px_rgba(129,236,255,0.4)]">PR_PROTOTYPE</span>
          </div>
          <h1 className="command-font text-3xl font-medium tracking-tight text-on-surface mb-2">INITIALIZE_ACCOUNT</h1>
        </div>
        <form
          noValidate
          autoComplete="off"
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col space-y-5 bg-surface-container/60 backdrop-blur-xl p-8 rounded-xl border border-outline-variant/15 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        >
          <div className="space-y-1.5">
            <label
              className="command-font text-[10px] uppercase font-bold tracking-[0.2em] text-primary-dim ml-1"
              htmlFor="username">
              Username
            </label>
            <div className="relative group">
              <span
                className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg group-focus-within:text-primary transition-colors">person</span>
              <input
                {...register("login", {required: true})}
                className="w-[83%] bg-surface-container-lowest border-none py-3.5 pl-11 pr-4 text-sm text-on-surface focus:ring-0 focus:outline-none placeholder:text-outline-variant rounded-lg transition-all border-b-2 border-transparent focus:border-primary"
                id="username"
                placeholder="USER_NAME"
                type="text"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label
              className="command-font text-[10px] uppercase font-bold tracking-[0.2em] text-primary-dim ml-1"
              htmlFor="countryName"
            >
              Country name
            </label>
            <div className="relative group">
              <span
                className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg group-focus-within:text-primary transition-colors">person</span>
              <input
                {...register("countryName", {required: true})}
                className="w-[83%] bg-surface-container-lowest border-none py-3.5 pl-11 pr-4 text-sm text-on-surface focus:ring-0 focus:outline-none placeholder:text-outline-variant rounded-lg transition-all border-b-2 border-transparent focus:border-primary"
                id="countryName"
                placeholder="COUNTRY_NAME"
                type="text"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label
              className="command-font text-[10px] uppercase font-bold tracking-[0.2em] text-primary-dim ml-1"
              htmlFor="color"
            >
              Hex color
            </label>
            <div className="relative group flex items-center gap-2">
              <span
                className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg group-focus-within:text-primary transition-colors">palette</span>
              <input
                {...register("color", {
                  required: 'Color is required',
                  pattern: {
                    value: /^#[0-9a-fA-F]{6}$/,
                    message: 'Must be a valid hex color (e.g. #2f528a)',
                  },
                })}
                className="w-[83%] bg-surface-container-lowest border-none py-3.5 pl-11 pr-4 text-sm text-on-surface focus:ring-0 focus:outline-none placeholder:text-outline-variant rounded-lg transition-all border-b-2 border-transparent focus:border-primary"
                id="color"
                placeholder="#2f528a"
                type="text"
              />
              <div
                className="w-7 h-7 rounded-md border border-outline-variant/30 flex-shrink-0 transition-colors"
                style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(colorValue) ? colorValue : 'transparent' }}
              />
            </div>
            {errors.color && (
              <p className="text-[11px] text-red-400 ml-1 mt-1">{errors.color.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label
              className="command-font text-[10px] uppercase font-bold tracking-[0.2em] text-primary-dim ml-1"
              htmlFor="password"
            >
              Password
            </label>
            <div className="relative group">
                <span
                  className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg group-focus-within:text-primary transition-colors">lock_open</span>
              <input
                {...register("password", {required: true})}
                className="w-[83%] bg-surface-container-lowest border-none py-3.5 pl-11 pr-4 text-sm text-on-surface focus:ring-0 focus:outline-none placeholder:text-outline-variant rounded-lg transition-all border-b-2 border-transparent focus:border-primary"
                id="password"
                placeholder="••••••••"
                type="password"
              />
            </div>
          </div>
          <div className="flex items-center space-x-3 py-2">
            <div className="relative flex items-center h-5">
              <input
                className="w-4 h-4 text-primary bg-surface-container-lowest border-outline-variant/30 rounded focus:ring-primary/20 focus:ring-offset-0 ring-offset-transparent cursor-pointer"
                id="terms"
                type="checkbox"
                checked={isCheck}
                onChange={() => setIsCheck(!isCheck)}
              />
            </div>
            <label
              className="text-[11px] text-on-surface-variant leading-tight"
              htmlFor="terms"
            >
              I acknowledge that its just half made prototype and i will tell that creator is a very good person
            </label>
          </div>
          <Button
            className="w-full bg-gradient-to-r from-primary to-primary-dim py-4 rounded-lg text-on-primary-fixed command-font font-bold tracking-widest text-sm uppercase transition-all hover:shadow-[0_0_20px_rgba(129,236,255,0.4)] active:scale-95 mt-4"
            type="submit"
            disabled={!isCheck}
          >
            Register
          </Button>
          <div className="mt-1 pt-6 border-t border-outline-variant/10 text-center">
            <p className="text-xs text-on-surface-variant">
              Already have account? <a className="text-secondary font-semibold hover:underline transition-all"
                                      href="login">LOGIN</a>
            </p>
          </div>
        </form>
      </Box>
    </div>
  );
};
