import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  LockSimple,
  User,
  WarningCircle,
} from '@phosphor-icons/react';
import { supabase } from '../../lib/supabase';
import { OnyxOrb } from '../common/OnyxOrb';

interface AuthScreenProps {
  onContinueAsGuest: () => void;
  onAuthSuccess?: () => void;
}

type AuthMode = 'signin' | 'signup';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function AuthScreen({
  onContinueAsGuest,
  onAuthSuccess,
}: AuthScreenProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  async function handleForgotPassword() {
    setErrorMessage(null);
    setInfoMessage(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setErrorMessage("Enter your valid email address above first to reset password.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
      if (error) {
        setErrorMessage(error.message);
      } else {
        setInfoMessage("Password reset link sent! Check your email inbox.");
      }
    } catch {
      setErrorMessage("Could not send reset link. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Enter your email address to continue.');
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setErrorMessage(
        'Enter a valid email address (for example, name@domain.com).'
      );
      return;
    }
    if (!password) {
      setErrorMessage('Enter your password to continue.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (authMode === 'signin') {
        const trimmedName = fullName.trim();
        if (trimmedName) {
          try { window.localStorage.setItem("onyx_user_display_name", trimmedName); } catch {}
        }
        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (!error && data.session && trimmedName) {
          await supabase.auth.updateUser({ data: { full_name: trimmedName } }).catch(() => {});
        }
        if (error) {
          setErrorMessage(error.message);
        } else if (data.session) {
          onAuthSuccess?.();
        }
      } else {
        const trimmedName = fullName.trim();
        if (trimmedName) {
          try { window.localStorage.setItem("onyx_user_display_name", trimmedName); } catch {}
        }
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: trimmedName ? { data: { full_name: trimmedName } } : undefined,
        });
        if (error) {
          setErrorMessage(error.message);
        } else if (data.session) {
          onAuthSuccess?.();
        } else {
          setInfoMessage(
            'Account created. Check your inbox to confirm your email, then sign in.'
          );
          setAuthMode('signin');
        }
      }
    } catch {
      setErrorMessage(
        'Could not reach authentication service. Check your connection or continue as Guest.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-[#000000] px-4 py-8 text-white">
      {/* Top-center sapphire atmospheric aura behind Orb */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="absolute -top-24 left-1/2 h-[320px] w-[min(520px,125vw)] -translate-x-1/2 rounded-full bg-[#1D4ED8]/24 blur-[110px]" />
        <div className="absolute -bottom-32 left-1/2 h-[220px] w-[min(460px,115vw)] -translate-x-1/2 rounded-full onyx-accent-btn/14 blur-[100px]" />
      </div>

      <main className="relative z-10 w-full max-w-[404px] onyx-fade-up">
        {/* Breathing Onyx Orb & Brand Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <OnyxOrb size="auth" animate />
          <h1 className="mt-4 font-serif text-2xl font-medium tracking-tight text-white">
            Onyx AI OS
          </h1>
          <p className="mt-1 font-sans text-sm text-zinc-400">
            Sign in to sync your persistent workspace
          </p>
        </div>

        {/* Sleek Dark Glass Auth Card */}
        <div className="rounded-3xl border border-white/10 bg-[#121215]/90 p-6 shadow-2xl backdrop-blur-xl">
          {/* Animated Sliding Mode Toggle */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="relative mb-5 grid grid-cols-2 rounded-2xl border border-white/[0.08] bg-[#18181D] p-1"
          >
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl onyx-accent-btn shadow-md shadow-blue-600/25 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                authMode === 'signup' ? 'translate-x-full' : 'translate-x-0'
              }`}
            />
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'signin'}
              onClick={() => {
                setAuthMode('signin');
                setErrorMessage(null);
                setInfoMessage(null);
              }}
              className={`relative z-10 flex h-10 items-center justify-center rounded-xl text-sm font-medium whitespace-nowrap active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onyx-accent)]/50 transition-transform duration-150 ${
                authMode === 'signin'
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'signup'}
              onClick={() => {
                setAuthMode('signup');
                setErrorMessage(null);
                setInfoMessage(null);
              }}
              className={`relative z-10 flex h-10 items-center justify-center rounded-xl text-sm font-medium whitespace-nowrap active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onyx-accent)]/50 transition-transform duration-150 ${
                authMode === 'signup'
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Inline notices */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-2xl border border-red-500/25 bg-[#1C1214] p-3.5 text-xs leading-relaxed text-red-100"
            >
              <WarningCircle
                size={17}
                weight="regular"
                className="mt-0.5 shrink-0 text-red-400"
              />
              <span>{errorMessage}</span>
            </div>
          )}

          {infoMessage && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2.5 rounded-2xl border border-blue-400/25 bg-[#101828] p-3.5 text-xs leading-relaxed text-blue-100"
            >
              <CheckCircle
                size={17}
                weight="regular"
                className="mt-0.5 shrink-0 text-[var(--onyx-accent)]"
              />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="onyx-auth-name"
                className="block text-xs font-medium text-zinc-300"
              >
                Your Name
              </label>
              <input
                id="onyx-auth-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Enter your name"
                className="h-11 w-full rounded-2xl border border-white/10 bg-[#18181D] px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/25 transition-colors duration-200"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="onyx-auth-email"
                className="block text-xs font-medium text-zinc-300"
              >
                Email
              </label>
              <div className="relative">
                <EnvelopeSimple
                  size={17}
                  weight="regular"
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-500"
                />
                <input
                  id="onyx-auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (errorMessage) {
                      setErrorMessage(null);
                    }
                  }}
                  placeholder="you@domain.com"
                  className="h-11 w-full rounded-2xl border border-white/10 bg-[#18181D] py-2.5 pr-4 pl-10 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/25 transition-colors duration-200"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="onyx-auth-password"
                  className="block text-xs font-medium text-zinc-300"
                >
                  Password
                </label>
                {authMode === "signin" && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleForgotPassword()}
                    className="text-xs font-medium text-[var(--onyx-accent)] hover:text-[var(--onyx-accent-soft)] disabled:opacity-50"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <LockSimple
                  size={17}
                  weight="regular"
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-500"
                />
                <input
                  id="onyx-auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={
                    authMode === 'signin' ? 'current-password' : 'new-password'
                  }
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (errorMessage) {
                      setErrorMessage(null);
                    }
                  }}
                  placeholder={
                    authMode === 'signin'
                      ? 'Enter password'
                      : 'At least 6 characters'
                  }
                  className="h-11 w-full rounded-2xl border border-white/10 bg-[#18181D] py-2.5 pr-11 pl-10 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/25 transition-colors duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-zinc-400 hover:bg-[#272727] hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onyx-accent)]/50 transition-transform duration-150"
                >
                  {showPassword ? (
                    <EyeSlash size={17} weight="regular" />
                  ) : (
                    <Eye size={17} weight="regular" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl onyx-accent-btn px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/25  active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 disabled:cursor-not-allowed disabled:opacity-60 transition-transform duration-150"
            >
              <span>
                {isSubmitting
                  ? authMode === 'signin'
                    ? 'Signing in...'
                    : 'Creating account...'
                  : authMode === 'signin'
                    ? 'Sign In'
                    : 'Create Account'}
              </span>
              {!isSubmitting && <ArrowRight size={16} weight="bold" />}
            </button>
          </form>

          {/* Local Guest bypass */}
          <div className="mt-4 space-y-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                const trimmedName = fullName.trim();
                if (trimmedName) {
                  try { window.localStorage.setItem("onyx_user_display_name", trimmedName); } catch {}
                }
                onContinueAsGuest();
              }}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-[#1C1C22] px-4 text-sm font-medium text-white/85 hover:bg-[#27272F] hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-transform duration-150"
            >
              <User size={16} weight="regular" />
              <span>Continue as Guest (Local)</span>
            </button>

            <p className="text-center font-mono text-[11px] text-zinc-500">
              Persistent sessions stay signed in across reloads
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-zinc-500/80">
          Onyx AI OS • Engineered by Abdullah Al Hadi
        </p>
      </main>
    </div>
  );
}
