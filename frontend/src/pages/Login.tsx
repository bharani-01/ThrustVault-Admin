import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Shield, AlertTriangle, ArrowRight } from 'lucide-react';

type LoginView = 'signin' | 'forgot-email' | 'forgot-otp' | 'reset-password';

export const Login: React.FC = () => {
  const { session, login } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState<LoginView>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Forgot password & reset password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Caps lock state
  const [capsLockActive, setCapsLockActive] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (session) {
      navigate('/dashboard');
    }
  }, [session, navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      setCapsLockActive(true);
    } else {
      setCapsLockActive(false);
    }
  };

  const evaluatePasswordStrength = (pw: string) => {
    let score = 0;
    if (!pw) return { score, text: 'Weak', color: 'bg-rose-500 text-rose-500', width: 'w-0' };
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    switch(score) {
      case 0:
      case 1:
        return { score, text: 'Weak', color: 'bg-rose-500 text-rose-500', width: 'w-1/4' };
      case 2:
        return { score, text: 'Fair', color: 'bg-orange-500 text-orange-500', width: 'w-2/4' };
      case 3:
        return { score, text: 'Good', color: 'bg-blue-500 text-blue-500', width: 'w-3/4' };
      case 4:
      default:
        return { score, text: 'Strong', color: 'bg-emerald-500 text-emerald-500', width: 'w-full' };
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        alert("Login failed: " + (data.error || "Unknown error"));
        setIsLoading(false);
        return;
      }

      login({
        email: data.email,
        role: data.role,
      });

      // Log activity
      await fetch('/api/log-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: data.email, 
          role: data.role, 
          action: 'Login', 
          details: 'Logged in successfully via React client.' 
        })
      }).catch(err => console.error("Error posting log:", err));

      navigate('/dashboard');
    } catch (err: any) {
      console.error("Login request failed:", err);
      alert("Verification failed: " + err.message);
      setIsLoading(false);
    }
  };

  const handleForgotEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() })
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        alert("Failed to send code: " + (data.error || "Unknown error"));
        setIsLoading(false);
        return;
      }

      setView('forgot-otp');
    } catch (err: any) {
      alert("Error requesting password reset: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim(), token: otpCode.trim() })
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        alert("Verification failed: " + (data.error || "Invalid code"));
        setIsLoading(false);
        return;
      }

      setView('reset-password');
    } catch (err: any) {
      alert("Error verifying code: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword !== newPasswordConfirm) {
      alert("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: forgotEmail.trim(), 
          token: otpCode.trim(), 
          password: newPassword 
        })
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        alert("Password reset failed: " + (data.error || "Unknown error"));
        setIsLoading(false);
        return;
      }

      alert("Password reset successfully. Please sign in with your new password.");
      setView('signin');
    } catch (err: any) {
      alert("Error resetting password: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const strength = evaluatePasswordStrength(newPassword);

  return (
    <div className="flex min-h-screen w-full select-none relative z-10">
      {/* LEFT SPLIT PANEL: Dashboard Design Hero Banner */}
      <div className="hidden lg:flex relative flex-1 flex-col justify-between p-12 bg-[#001228] text-white overflow-hidden border-r border-[#003366]/20">
        {/* Blueprint background shader grid overlay */}
        <div className="absolute inset-0 w-full h-full pointer-events-none blueprint-grid z-0 opacity-40"></div>
        
        <div className="relative z-10 flex items-center gap-2">
          <Shield className="w-8 h-8 text-blue-500" />
          <span className="font-extrabold text-2xl tracking-tight">Thrust<span className="text-blue-500">Vault</span></span>
        </div>

        <div className="relative z-10 my-auto max-w-xl space-y-6">
          <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase tracking-wider bg-blue-900/30 text-blue-400 border border-blue-900/50 inline-block">
            Propulsion Intelligence
          </span>
          <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
            High-Performance Drone Propulsion Database
          </h1>
          <p className="text-slate-400 font-medium text-sm leading-relaxed">
            ThrustVault consolidates motor specifications, ESC ratings, propeller performance, and battery load results into an intuitive platform for UAV design engineers.
          </p>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs font-semibold text-slate-500 border-t border-slate-800 pt-6">
          <span>&copy; {new Date().getFullYear()} ThrustVault Inc.</span>
          <a href="/docs" className="hover:text-blue-400 transition-colors">Documentation</a>
        </div>
      </div>

      {/* RIGHT SPLIT PANEL: Form inputs */}
      <div className="flex-1 flex flex-col justify-center items-center px-4 md:px-12 py-10 bg-slate-50 dark:bg-slate-950 relative">
        {/* Blueprint background shader grid overlay for mobile */}
        <div className="lg:hidden absolute inset-0 w-full h-full pointer-events-none blueprint-grid z-0 opacity-15"></div>

        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-xl p-8 relative z-10 flex flex-col gap-6">
          
          {/* Form Header */}
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-extrabold text-[#001e40] dark:text-slate-100 tracking-tight">
              {view === 'signin' && <>Welcome to <span className="text-[#003366] dark:text-blue-500">ThrustVault</span></>}
              {view === 'forgot-email' && <>Forgot <span className="text-[#003366] dark:text-blue-500">Password</span></>}
              {view === 'forgot-otp' && <>Verify <span className="text-[#003366] dark:text-blue-500">Code</span></>}
              {view === 'reset-password' && <>Reset <span className="text-[#003366] dark:text-blue-500">Password</span></>}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
              {view === 'signin' && 'Sign in to access the UAV motor database console.'}
              {view === 'forgot-email' && 'Enter your email to receive a verification code.'}
              {view === 'forgot-otp' && `We sent a 6-digit verification code to ${forgotEmail}.`}
              {view === 'reset-password' && 'Enter your new credentials to reset password.'}
            </p>
          </div>

          {/* VIEW: SIGN IN */}
          {view === 'signin' && (
            <form onSubmit={handleSignInSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider mb-2">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyDown}
                  disabled={isLoading}
                  required
                  placeholder="name@company.com" 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3.5 text-sm outline-none transition-all focus:border-[#003366] focus:dark:border-blue-500 focus:bg-white focus:dark:bg-slate-900 focus:ring-4 focus:ring-[#003366]/10 placeholder-slate-400 font-medium"
                />
              </div>

              <div className="flex flex-col relative">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider">Password</label>
                  <button 
                    type="button"
                    onClick={(e) => { e.preventDefault(); setView('forgot-email'); }}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onKeyUp={handleKeyDown}
                    disabled={isLoading}
                    required
                    placeholder="Enter your password"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-3.5 pr-10 text-sm outline-none transition-all focus:border-[#003366] focus:dark:border-blue-500 focus:bg-white focus:dark:bg-slate-900 focus:ring-4 focus:ring-[#003366]/10 placeholder-slate-400 font-medium"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {capsLockActive && (
                  <div className="flex items-center gap-1.5 mt-2 text-[10px] text-amber-600 font-bold uppercase tracking-wide">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Warning: Caps Lock is on!
                  </div>
                )}
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#003366] hover:bg-[#002244] dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Signing In...' : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* VIEW: FORGOT EMAIL */}
          {view === 'forgot-email' && (
            <form onSubmit={handleForgotEmailSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider mb-2">Registered Email Address</label>
                <input 
                  type="email" 
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  disabled={isLoading}
                  required
                  placeholder="name@company.com" 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3.5 text-sm outline-none transition-all focus:border-[#003366] focus:dark:border-blue-500 focus:bg-white focus:dark:bg-slate-900 focus:ring-4 focus:ring-[#003366]/10 placeholder-slate-400 font-medium"
                />
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#003366] hover:bg-[#002244] dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Sending...' : 'Send Verification Code'}
              </button>

              <button 
                type="button" 
                onClick={() => setView('signin')}
                className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:underline cursor-pointer"
              >
                Back to Sign In
              </button>
            </form>
          )}

          {/* VIEW: VERIFY OTP */}
          {view === 'forgot-otp' && (
            <form onSubmit={handleForgotOtpSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider mb-2">Verification Code</label>
                <input 
                  type="text" 
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  disabled={isLoading}
                  required
                  placeholder="Enter 6-digit code" 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3.5 text-sm outline-none transition-all focus:border-[#003366] focus:dark:border-blue-500 focus:bg-white focus:dark:bg-slate-900 focus:ring-4 focus:ring-[#003366]/10 placeholder-slate-400 font-medium text-center font-mono letter-spacing-lg"
                />
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#003366] hover:bg-[#002244] dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Verifying...' : 'Verify Code'}
              </button>

              <button 
                type="button" 
                onClick={() => setView('signin')}
                className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:underline cursor-pointer"
              >
                Back to Sign In
              </button>
            </form>
          )}

          {/* VIEW: RESET PASSWORD */}
          {view === 'reset-password' && (
            <form onSubmit={handleResetPasswordSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider mb-2">New Password</label>
                <div className="relative">
                  <input 
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    placeholder="Enter new password" 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-3.5 pr-10 text-sm outline-none transition-all focus:border-[#003366] focus:dark:border-blue-500 focus:bg-white focus:dark:bg-slate-900 focus:ring-4 focus:ring-[#003366]/10 placeholder-slate-400 font-medium"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Password Strength bar */}
                {newPassword && (
                  <div className="mt-2 flex flex-col gap-1">
                    <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${strength.color.split(' ')[0]} ${strength.width}`}></div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${strength.color.split(' ')[1]}`}>
                      Password Strength: {strength.text}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider mb-2">Confirm New Password</label>
                <input 
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  disabled={isLoading}
                  required
                  placeholder="Confirm new password" 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3.5 text-sm outline-none transition-all focus:border-[#003366] focus:dark:border-blue-500 focus:bg-white focus:dark:bg-slate-900 focus:ring-4 focus:ring-[#003366]/10 placeholder-slate-400 font-medium"
                />
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#003366] hover:bg-[#002244] dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>

              <button 
                type="button" 
                onClick={() => setView('signin')}
                className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:underline cursor-pointer"
              >
                Cancel and Back to Sign In
              </button>
            </form>
          )}

          {/* Access Request link footer */}
          <div className="border-t border-slate-100 dark:border-slate-800/60 pt-4 flex flex-col items-center gap-1 text-center">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold font-mono uppercase tracking-wider">
              Need database access?
            </span>
            <Link 
              to="/request_access" 
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline"
            >
              Request Access Credentials
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
