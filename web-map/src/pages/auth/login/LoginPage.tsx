import React, { useEffect } from 'react';
import { Box, Button } from '@mui/material';
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
    <div className="relative z-20 flex-1 flex items-center justify-center p-6">
      <img className="absolute top-0 -z-10 w-full h-[100vh] object-cover opacity-40 grayscale-[0.5]"
           alt="bg-cinematic"
           data-alt="cinematic deep space nebula with ethereal teal and violet gaseous clouds and distant glowing stars in high definition"
           src="https://lh3.googleusercontent.com/aida-public/AB6AXuCz1dUT2y9PaCFa_uQGV_x9cFyoYw09z0-z0XoMOjYORnJTHQUomumY5khd5ZnVMXnJoyZnogQqPZIClyLGsNjqTLQaSoAqmwK6q7qhD7Yi-DF8LdjvGFPvsLyCePhdLMOPyZvmqxZyCMhUIE-bmXrPlainfFuozI40glBzX3oQTE4pWddpeZHB4VIAoLRPbaEVNsDUPsYpuwiWSYoHA_QFSC-WZInSzW9UKlQXw21zWvqM5wMgFZNJEwn-M1OH2pgysI8_72s5nZs"
      />
      <Box className="w-full max-w-md">
        <div className="mb-10 text-center">
          <h1
            className="font-headline text-4xl font-bold tracking-tighter text-primary glow-text-primary uppercase mb-2">
            PR_PROTOTYPE
          </h1>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant">
            v0.5_TEST
          </p>
        </div>
        <form
          noValidate
          autoComplete="off"
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col space-y-6 glass-panel border border-outline-variant/15 p-8 lg:p-10 rounded-lg shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative group overflow-hidden"
        >
          <div
            className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent"></div>
          <header className="mb-0 !mt-0">
            <h2
              className="font-headline !mb-1 text-xl font-medium text-white tracking-wide">AUTHENTICATION_REQUIRED</h2>
            <p className="text-on-surface-variant text-sm mt-1">Initialize link to strategic network</p>
          </header>
          <div className="space-y-2">
            <label className="block font-label text-[10px] uppercase tracking-widest text-primary/70 font-bold px-1">
              USER_ID
            </label>
            <div className="relative">
              <span
                className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary-dim text-lg"
                data-icon="person">person</span>
              <input
                {...register("login", {required: true})}
                className="w-[83%] bg-surface-container-lowest border-0 border-b border-outline-variant/30 py-3 pl-11 pr-4 text-on-surface placeholder:text-outline-variant/50 focus:ring-0 focus:border-primary transition-all duration-300 font-body text-sm"
                placeholder="ENTER_ID..." type="text"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block font-label text-[10px] uppercase tracking-widest text-primary/70 font-bold px-1">
              PASSWORD
            </label>
            <div className="relative">
              <span
                className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary-dim text-lg"
                data-icon="lock">lock</span>
              <input
                {...register("password", {required: true})}
                className="w-[83%] bg-surface-container-lowest border-0 border-b border-outline-variant/30 py-3 pl-11 pr-4 text-on-surface placeholder:text-outline-variant/50 focus:ring-0 focus:border-primary transition-all duration-300 font-body text-sm"
                placeholder="••••••••" type="password"
              />
            </div>
          </div>
          <Button
            className="w-full bg-gradient-to-r from-primary to-primary-dim py-4 rounded-lg font-headline font-bold text-on-primary-fixed uppercase tracking-widest text-sm glow-primary hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            type="submit"
          >
            INITIALIZE_LOGIN
            <span className="material-symbols-outlined text-lg" data-icon="login">login</span>
          </Button>
          <div className="mt-10 pt-8 border-t border-outline-variant/10 text-center">
            <p className="text-on-surface-variant text-xs mb-1">Not user?</p>
            <Button
              className="inline-flex items-center gap-2 px-6 py-2 border border-secondary/30 text-secondary font-headline text-xs tracking-widest uppercase hover:bg-secondary/10 transition-all rounded-full"
              onClick={onRegisterClick}
            >
              REGISTER_ACCOUNT
              <span className="material-symbols-outlined text-sm" data-icon="arrow_forward">arrow_forward</span>
            </Button>
          </div>
        </form>
        <div className="mt-8 flex justify-between items-center px-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(129,236,255,1)]"></div>
              <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-tighter">Server status</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_8px_rgba(255,215,9,0.6)] animate-pulse"></div>
              <span
                className="font-label text-[10px] text-on-surface-variant uppercase tracking-tighter">Queue status</span>
            </div>
          </div>
        </div>
      </Box>
    </div>
  );
};
