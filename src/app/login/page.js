'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Shield, RefreshCw, AlertCircle, Mail, Lock, Eye, EyeOff, KeyRound, Send } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const getFriendlyErrorMessage = (error) => {
  if (!error) return "An unknown error occurred.";
  const rawMsg = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
  
  if (error.code === 'auth/invalid-credential' || rawMsg.includes('INVALID_LOGIN_CREDENTIALS') || rawMsg.includes('invalid-credential')) {
    return "Invalid email or password. Please verify your credentials and try again (for local sandbox access, click 'Quick Dev Sign-In').";
  }
  if (error.code === 'auth/user-disabled' || rawMsg.includes('user-disabled')) {
    return "This account has been deactivated. Please contact an administrator.";
  }
  if (error.code === 'auth/too-many-requests' || rawMsg.includes('too-many-requests')) {
    return "Too many failed login attempts. Please try again later.";
  }
  if (error.code === 'auth/network-request-failed' || rawMsg.includes('network-request-failed')) {
    return "Network connection issue. Please check your internet connection and try again.";
  }
  if (error.code === 'auth/invalid-email' || rawMsg.includes('invalid-email')) {
    return "The email address entered is invalid.";
  }
  if (error.code === 'auth/user-not-found' || rawMsg.includes('user-not-found')) {
    return "No account found with this email address.";
  }
  if (error.code === 'auth/wrong-password' || rawMsg.includes('wrong-password')) {
    return "Incorrect password. Please try again.";
  }
  if (error.code === 'auth/popup-closed-by-user') {
    return "Google Sign-In popup was closed before completing authentication.";
  }
  
  const clean = rawMsg.replace(/^Firebase:\s*/i, '').replace(/^Error\s*\(auth\/[^\)]+\):\s*/i, '');
  return clean || "Failed to sign in. Verify credentials.";
};

// Global in-memory lock to prevent duplicate dispatches across mounting/Strict Mode runs
let global2FaSentLock = {};

export default function LoginPage() {
  const { login, loginWithGoogle, logout, user, is2FaVerified, setIs2FaVerified, sandbox } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isStaging = 
    process.env.NEXT_PUBLIC_USE_STAGING_FIREBASE === 'true' || 
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview';

  // 2FA States
  const [show2Fa, setShow2Fa] = useState(false);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [otpSent, setOtpSent] = useState(false);

  React.useEffect(() => {
    if (user && !is2FaVerified) {
      setShow2Fa(true);
      setLoading(false);
      // NOTE: We intentionally DO NOT automatically dispatch OTP codes here.
      // The user must click "Send OTP to My Email" intentionally.
    } else if (user && is2FaVerified) {
      router.push('/');
      setLoading(false);
    }
  }, [user, is2FaVerified]);

  React.useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldown]);

  const send2FaCode = async (targetEmail) => {
    if (!targetEmail) return;
    const cleanEmail = targetEmail.trim().toLowerCase();
    const now = Date.now();

    // In-flight & cooldown deduplication: prevent any duplicate send within 15 seconds
    if (global2FaSentLock[cleanEmail] && (now - global2FaSentLock[cleanEmail] < 15000)) {
      console.log('[2FA] Debounced duplicate dispatch for', cleanEmail);
      return;
    }
    global2FaSentLock[cleanEmail] = now;
    sessionStorage.setItem(`hp_2fa_sent_time_${cleanEmail}`, now.toString());
    setResending(true);

    try {
      const res = await fetch('/api/send-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      
      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
        throw new Error('Server returned an invalid response. Please try again.');
      }

      if (!res.ok || !data.success) {
        if (res.status !== 429) {
          delete global2FaSentLock[cleanEmail];
        }
        throw new Error(data.error || 'Failed to send verification code.');
      }

      setOtpSent(true);
      toast.success('Verification code sent to your email.');
      setCooldown(60); // 60 seconds cooldown on success
    } catch (err) {
      console.error('2FA Send Error:', err);
      setError(err.message || 'Failed to send verification code. Please check your network.');
      toast.error(err.message || 'Failed to send verification code.');
    } finally {
      setResending(false);
    }
  };

  const handleResendCode = async () => {
    if (resending || cooldown > 0 || !user) return;
    setError('');
    const emailKey = user.email?.toLowerCase() || '';
    if (emailKey) {
      delete global2FaSentLock[emailKey];
    }
    await send2FaCode(user.email);
  };

  const handleVerify2Fa = async (e) => {
    e.preventDefault();
    if (!user) return;

    if (twoFaCode.length !== 6) {
      setError('Verification code must be exactly 6 digits.');
      return;
    }

    setError('');
    setTwoFaLoading(true);

    try {
      const res = await fetch('/api/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, code: twoFaCode })
      });
      
      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
        throw new Error('Server returned an invalid response. Please try again.');
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Incorrect code. Please try again.');
      }

      const nowTimestamp = Date.now().toString();
      localStorage.setItem(`hp_2fa_verified_${user.uid}`, nowTimestamp);
      sessionStorage.setItem(`hp_2fa_verified_${user.uid}`, nowTimestamp);
      setIs2FaVerified(true);
      toast.success('Verification successful!');
      router.push('/');
    } catch (err) {
      console.error('Verification Error:', err);
      setError(err.message || 'A network error occurred. Please try again.');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleCancel2Fa = async () => {
    setError('');
    setLoading(false);
    setTwoFaCode('');
    setShow2Fa(false);
    setOtpSent(false);
    if (user?.email) {
      delete global2FaSentLock[user.email.toLowerCase()];
    }
    await logout();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validations
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Email address is required.');
      return;
    }

    // Allow mock/sandbox usernames without '@' in sandbox mode or if forced, otherwise require a valid email format
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const isSandboxAllowed = sandbox || isLocalhost;
    if (!isSandboxAllowed && !trimmedEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setError('Password is required.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      await login(trimmedEmail, password);
      // Login succeeded; transition to 2FA screen
      // Do NOT send OTP automatically - user will click "Send OTP to My Email"
      setShow2Fa(true);
      setLoading(false);
    } catch (err) {
      console.warn("Login failure:", err?.message || err);
      setError(getFriendlyErrorMessage(err));
      setLoading(false);
    }
  };


  return (
    <div className="flex min-h-screen w-full font-sans bg-white overflow-hidden">
      
      {/* Left Panel: Graphic & Brand Statement (40% width) */}
      <div className="hidden md:flex md:w-5/12 p-5 bg-white">
        <div className="w-full h-full bg-black rounded-[32px] relative flex flex-col justify-between p-12 overflow-hidden select-none">
          {/* Background Video */}
          <video 
            autoPlay 
            muted 
            loop 
            playsInline 
            className="absolute inset-0 w-full h-full object-cover z-0 opacity-60"
          >
            <source src="https://thehoneypalaceafrica.com/assets/hero-bg.mp4" type="video/mp4" />
          </video>
          {/* Dark overlay to ensure text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/50 z-10" />
          
          {/* Tagline */}
          <div className="relative z-20 my-auto">
            <h2 className="text-white text-4xl lg:text-5xl font-display font-bold leading-tight tracking-tight">
              Pure organic honey<br />
              from the heart<br />
              of Africa.
            </h2>
          </div>

          {/* Brand identity footer */}
          <div className="relative z-20 flex items-center gap-2.5">
            <img
              src="/icon.png"
              alt="The Honey Palace Africa Icon"
              className="w-6 h-6 object-contain rounded"
            />
            <span className="text-white/60 font-semibold text-xs tracking-wider uppercase">
              The Honey Palace Africa
            </span>
          </div>
        </div>
      </div>

      {/* Right Panel: Sign-In Form (60% width) */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 md:px-16 lg:px-24 py-4 bg-white relative">
        <div className="max-w-md w-full mx-auto space-y-6">
          
          {show2Fa ? (
            <>
              {/* 2FA Header */}
              <div className="space-y-3 -mt-12">
                <div className="flex items-center mb-10">
                  <img
                    src="/assets/honey-palace-logo.png"
                    alt="Honey Palace Logo"
                    className="h-12 w-auto object-contain"
                  />
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tight text-black font-display">
                    {otpSent ? 'Enter Verification Code' : 'Two-Factor Security'}
                  </h1>
                  <p className="text-xs text-black/50 font-medium leading-relaxed">
                    {otpSent ? (
                      <>We sent a 6-digit code to <strong className="text-black font-semibold">{user?.email || email}</strong>. Please check your inbox.</>
                    ) : (
                      <>Security verification required for <strong className="text-black font-semibold">{user?.email || email}</strong>.</>
                    )}
                  </p>
                </div>
              </div>

              <div className="h-[1px] bg-black/5 w-full" />

              {error && (
                <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold leading-relaxed">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              {!otpSent ? (
                /* Intentional Send OTP Trigger */
                <div className="space-y-5 pt-1">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-900">
                      <Mail className="w-4 h-4 text-amber-600" />
                      Two-Factor Authentication
                    </div>
                    <p className="text-gray-700 leading-relaxed">
                      To complete your sign in, click below to send a secure 6-digit verification code to your email.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => send2FaCode(user?.email || email)}
                      disabled={resending || cooldown > 0}
                      className="w-full py-3.5 bg-[#ffa200] hover:bg-[#e08f00] active:scale-[0.98] text-black font-extrabold rounded-full text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/15 cursor-pointer disabled:opacity-50"
                    >
                      {resending ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-black" />
                      ) : (
                        <Send className="w-4 h-4 text-black" />
                      )}
                      <span>{resending ? 'Sending Code...' : cooldown > 0 ? `Wait ${cooldown}s` : 'Send OTP to My Email'}</span>
                    </button>

                    <div className="flex items-center justify-between text-xs px-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setOtpSent(true)}
                        className="text-gray-500 hover:text-black font-semibold underline text-[11px] cursor-pointer"
                      >
                        Already have a code? Enter it here →
                      </button>
                      
                      <button
                        type="button"
                        onClick={handleCancel2Fa}
                        className="text-gray-400 hover:text-gray-700 text-[11px] cursor-pointer"
                      >
                        Cancel / Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* 2FA Form */
                <form onSubmit={handleVerify2Fa} className="space-y-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-black/50 font-bold tracking-wide">Enter Code</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-3 w-4.5 h-4.5 text-black/20" />
                      <input
                        type="text"
                        required
                        maxLength={6}
                        placeholder="••••••"
                        className="w-full bg-white border border-black/10 focus:border-[#ffa200] focus:ring-1 focus:ring-[#ffa200] focus:outline-none pl-11 pr-4 py-2.5 rounded-full text-base text-black placeholder-black/20 font-bold tracking-[6px] text-center transition-all shadow-none"
                        value={twoFaCode}
                        onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                    {isStaging && (
                      <div className="text-[11px] text-amber-900 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-xl font-medium mt-1 text-center flex items-center justify-center gap-1">
                        <span>💡 Staging Mode: Use code sent to email or</span>
                        <button 
                          type="button" 
                          onClick={() => setTwoFaCode('123456')} 
                          className="font-mono font-bold underline cursor-pointer text-amber-950 hover:text-black"
                        >
                          123456
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-2">
                    <button
                      type="submit"
                      disabled={twoFaLoading}
                      className="w-full py-3 bg-[#ffa200] hover:bg-[#e08f00] active:scale-[0.98] text-white font-bold rounded-full text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10 cursor-pointer"
                    >
                      {twoFaLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <>
                          <Shield className="w-4 h-4 text-white" />
                          Verify & Log In
                        </>
                      )}
                    </button>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={resending || cooldown > 0}
                        className="flex-1 py-2.5 bg-white hover:bg-black/5 border border-black/10 text-black font-bold rounded-full text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {resending ? 'Sending...' : cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend Code'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel2Fa}
                        className="flex-1 py-2.5 bg-white hover:bg-black/5 border border-black/10 text-black font-bold rounded-full text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        Back to Sign In
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Sandbox 2FA Bypass Help */}
              {sandbox && (
                <div className="p-4 bg-[#ffa200]/5 border border-[#ffa200]/15 rounded-2xl text-xs space-y-2">
                  <p className="font-bold text-[#ffa200]">Sandbox 2FA Bypass</p>
                  <p className="text-black/50 text-[11px] font-medium leading-relaxed">
                    In Sandbox Mode, use the verification code <code className="bg-black/5 px-1.5 py-0.5 rounded font-mono text-[#ffa200] border border-[#ffa200]/10">123456</code> to complete sign in.
                  </p>
                </div>
              )}
            </>

          ) : (
            <>
              {/* Logo & Header */}
              <div className="space-y-3 -mt-12">
                <div className="flex items-center mb-10">
                  <img
                    src="/assets/honey-palace-logo.png"
                    alt="Honey Palace Logo"
                    className="h-12 w-auto object-contain"
                  />
                </div>
                
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tight text-black font-display">
                    Sign In
                  </h1>
                  <p className="text-xs text-black/40 font-medium">
                    Welcome back to Honey Palace — Sign in to manage operations
                  </p>
                </div>
              </div>

              <div className="h-[1px] bg-black/5 w-full" />

              {error && (
                <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold leading-relaxed">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* Email Field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-black/50 font-bold tracking-wide">Your email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4.5 h-4.5 text-black/20" />
                    <input
                      type="email"
                      required
                      placeholder="staff@thehoneypalaceafrica.com"
                      className="w-full bg-white border border-black/10 focus:border-[#ffa200] focus:ring-1 focus:ring-[#ffa200] focus:outline-none pl-11 pr-4 py-2.5 rounded-full text-sm text-black placeholder-black/20 font-semibold transition-all shadow-none"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-black/50 font-bold tracking-wide">Your password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4.5 h-4.5 text-black/20" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••••••"
                      className="w-full bg-white border border-black/10 focus:border-[#ffa200] focus:ring-1 focus:ring-[#ffa200] focus:outline-none pl-11 pr-12 py-2.5 rounded-full text-sm text-black placeholder-black/20 font-semibold transition-all shadow-none"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-3 text-black/20 hover:text-black/50 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-[#ffa200] hover:bg-[#e08f00] active:scale-[0.98] text-white font-bold rounded-full text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10 cursor-pointer"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <>
                        <Shield className="w-4 h-4 text-white" />
                        Sign In to Portal
                      </>
                    )}
                  </button>

                  {process.env.NODE_ENV === 'development' && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('thehoneypalace2022@gmail.com');
                        setPassword('admin123');
                        setError('');
                      }}
                      className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-[#d07b00] font-bold rounded-full text-xs border border-amber-200/60 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      ⚡ Quick Dev Sign-In (Auto-fill Mock Credentials)
                    </button>
                  )}
                </div>
              </form>

              {/* Sandbox Credentials Help */}
              {sandbox && (
                <div className="p-4 bg-[#ffa200]/5 border border-[#ffa200]/15 rounded-2xl text-xs space-y-2">
                  <p className="font-bold text-[#ffa200]">Sandbox Login Credentials</p>
                  <p className="text-black/50 text-[11px] font-medium leading-relaxed">
                    Use any of these mock emails with password <code className="bg-black/5 px-1.5 py-0.5 rounded font-mono text-[#ffa200] border border-[#ffa200]/10">admin123</code>:
                  </p>
                  <ul className="list-disc pl-4 text-[10px] text-black/60 font-semibold space-y-0.5">
                    <li>thehoneypalace2022@gmail.com (CEO/Admin)</li>
                    <li>sales@honeypalace.com (Sales Exec)</li>
                    <li>inventory@honeypalace.com (Inventory)</li>
                    <li>accountant@honeypalace.com (Accountant)</li>
                  </ul>
                </div>
              )}
            </>
          ) }

        </div>
      </div>
    </div>
  );
}
