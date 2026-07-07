import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Check, ArrowLeft, ArrowRight, User, Mail, FileText } from 'lucide-react';

export const RequestAccess: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [justification, setJustification] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !justification) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/public/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email: email.trim(), justification })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setIsSuccess(true);
    } catch (err: any) {
      alert("Failed to submit request: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full select-none relative z-10">
      {/* LEFT SPLIT PANEL: Info Banner */}
      <div className="hidden lg:flex relative flex-1 flex-col justify-between p-12 bg-[#001228] text-white overflow-hidden border-r border-[#003366]/20">
        {/* Blueprint background shader grid overlay */}
        <div className="absolute inset-0 w-full h-full pointer-events-none blueprint-grid z-0 opacity-40"></div>
        
        <div className="relative z-10 flex items-center gap-2">
          <Shield className="w-8 h-8 text-blue-500" />
          <span className="font-extrabold text-2xl tracking-tight">Thrust<span className="text-blue-500">Vault</span></span>
        </div>

        <div className="relative z-10 my-auto max-w-xl space-y-6">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Access Request Portal
          </span>
          <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
            Get Access to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">ThrustVault</span> Database
          </h1>
          <p className="text-slate-400 font-medium text-sm leading-relaxed">
            ThrustVault is a curated propulsion database for UAV engineers, researchers, and manufacturers. Apply below for credentials.
          </p>

          {/* Process steps */}
          <div className="flex flex-col gap-4 mt-8">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/30 font-bold text-xs text-blue-400 flex items-center justify-center shrink-0">1</div>
              <div className="flex flex-col">
                <strong className="text-xs font-bold text-white uppercase tracking-wider">Submit Your Request</strong>
                <span className="text-xs text-slate-400 mt-0.5">Fill in your profile and justifications.</span>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/30 font-bold text-xs text-blue-400 flex items-center justify-center shrink-0">2</div>
              <div className="flex flex-col">
                <strong className="text-xs font-bold text-white uppercase tracking-wider">Admin Review</strong>
                <span className="text-xs text-slate-400 mt-0.5">Verification checks are completed within 24 hours.</span>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/30 font-bold text-xs text-blue-400 flex items-center justify-center shrink-0">3</div>
              <div className="flex flex-col">
                <strong className="text-xs font-bold text-white uppercase tracking-wider">Get Credentials</strong>
                <span className="text-xs text-slate-400 mt-0.5">Start comparing powertrain and test runs records.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs font-semibold text-slate-500 border-t border-slate-800 pt-6">
          <span>&copy; {new Date().getFullYear()} ThrustVault Inc.</span>
          <Link to="/docs" className="hover:text-blue-400 transition-colors">Documentation</Link>
        </div>
      </div>

      {/* RIGHT SPLIT PANEL: Forms */}
      <div className="flex-1 flex flex-col justify-center items-center px-4 md:px-12 py-10 bg-slate-50 dark:bg-slate-950 relative">
        <div className="lg:hidden absolute inset-0 w-full h-full pointer-events-none blueprint-grid z-0 opacity-15"></div>

        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-xl p-8 relative z-10 flex flex-col gap-6">
          
          {!isSuccess ? (
            <>
              {/* Form Header */}
              <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-extrabold text-[#001e40] dark:text-slate-100 tracking-tight">
                  Request <span className="text-[#003366] dark:text-blue-500">Access</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                  Submit your details to request a database user account.
                </p>
              </div>

              {/* Request Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col">
                  <label htmlFor="fullName" className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider mb-2">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={isLoading}
                      required
                      placeholder="e.g. John Doe"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-9 pr-3.5 text-sm outline-none transition-all focus:border-[#003366] focus:dark:border-blue-500 focus:bg-white focus:dark:bg-slate-900 focus:ring-4 focus:ring-[#003366]/10 placeholder-slate-400 font-medium"
                    />
                  </div>
                </div>

                <div className="flex flex-col">
                  <label htmlFor="email" className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="email" 
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                      placeholder="e.g. john@company.com"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-9 pr-3.5 text-sm outline-none transition-all focus:border-[#003366] focus:dark:border-blue-500 focus:bg-white focus:dark:bg-slate-900 focus:ring-4 focus:ring-[#003366]/10 placeholder-slate-400 font-medium"
                    />
                  </div>
                </div>

                <div className="flex flex-col">
                  <label htmlFor="justification" className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider mb-2">Justification / Reason</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                    <textarea 
                      id="justification"
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                      disabled={isLoading}
                      required
                      placeholder="Why do you require access to ThrustVault? Specify team, university, or project name."
                      rows={4}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-9 pr-3.5 text-sm outline-none transition-all focus:border-[#003366] focus:dark:border-blue-500 focus:bg-white focus:dark:bg-slate-900 focus:ring-4 focus:ring-[#003366]/10 placeholder-slate-400 font-medium"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#003366] hover:bg-[#002244] dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>

              <div className="text-center pt-2">
                <Link 
                  to="/login" 
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:underline cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </Link>
              </div>
            </>
          ) : (
            /* Success View */
            <div className="text-center flex flex-col gap-4 py-4 animate-in fade-in zoom-in duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center mx-auto shadow-sm">
                <Check className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <h2 className="text-xl font-extrabold text-[#001e40] dark:text-slate-100 tracking-tight uppercase">Request Submitted</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                  Your access request has been recorded. Our administrators will review your application shortly.
                </p>
              </div>
              <Link 
                to="/login"
                className="w-full bg-[#003366] hover:bg-[#002244] dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                Return to Sign In
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
