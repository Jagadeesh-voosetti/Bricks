import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Phone, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, KeyRound, ArrowLeft, ShieldCheck, HelpCircle } from 'lucide-react';

export default function Auth({ t, onAuthSuccess }) {
  // Default to password as requested in the initial specification to avoid Twilio trial roadblocks
  const [authMethod, setAuthMethod] = useState('password'); // 'password' | 'otp'
  const [otpStep, setOtpStep] = useState('send'); // 'send' | 'verify'
  const [isSignup, setIsSignup] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('6309776185');
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isTwilioTrialError, setIsTwilioTrialError] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [countdown, setCountdown] = useState(0);

  // Resend countdown timer
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Normalize and validate Indian mobile number
  const validateAndFormatPhone = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '');
    if (/^[6-9]\d{9}$/.test(digits)) {
      return '+91' + digits;
    }
    if (/^91[6-9]\d{9}$/.test(digits)) {
      return '+' + digits;
    }
    return null;
  };

  // Quick demo / developer test bypass when external SMS is restricted
  const handleQuickDemoLogin = () => {
    const testSession = {
      user: {
        id: 'demo-jagadeesh-user',
        phone: validateAndFormatPhone(phone) || '+916309776185',
        user_metadata: {
          full_name: fullName.trim() || 'Jagadeesh (Test User)'
        }
      }
    };
    onAuthSuccess(testSession);
  };

  // 1. Send OTP to Mobile Number
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setIsTwilioTrialError(false);
    setSuccessMsg('');

    const formattedPhone = validateAndFormatPhone(phone);
    if (!formattedPhone) {
      setErrorMsg(t.errInvalidPhone);
      return;
    }

    if (isSignup && !fullName.trim()) {
      setErrorMsg(t.errNameRequired);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          shouldCreateUser: true,
          data: isSignup && fullName.trim() ? { full_name: fullName.trim() } : undefined
        }
      });

      if (error) {
        const msg = error.message || '';
        if (msg.includes('572006') || msg.includes('Trial accounts') || msg.includes('template name')) {
          setIsTwilioTrialError(true);
          setErrorMsg(
            'Twilio Trial Restriction: Your Supabase Twilio provider is in Trial mode and cannot deliver custom SMS to Indian mobile numbers. Please log in using your Password below.'
          );
        } else {
          setErrorMsg(error.message || 'Failed to send OTP. Please check your number.');
        }
        setLoading(false);
        return;
      }

      setOtpStep('verify');
      setCountdown(30);
      setSuccessMsg(`${t.otpSentTo} ${formattedPhone}`);
    } catch (err) {
      setErrorMsg(err.message || 'Error sending OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify OTP & Authenticate
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const formattedPhone = validateAndFormatPhone(phone);
    const cleanOtp = otpCode.trim();

    if (!cleanOtp || cleanOtp.length < 6) {
      setErrorMsg(t.errInvalidOtp);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: cleanOtp,
        type: 'sms'
      });

      if (error) {
        setErrorMsg(error.message || 'Invalid or expired OTP. Please try again.');
        setLoading(false);
        return;
      }

      if (data?.session) {
        if (isSignup && fullName.trim() && data.user) {
          try {
            await supabase.from('profiles').upsert({
              id: data.user.id,
              full_name: fullName.trim(),
              role: 'customer'
            });
          } catch (pErr) {
            console.warn('Profile save note:', pErr);
          }
        }
        onAuthSuccess(data.session);
      } else {
        setErrorMsg(t.errSessionFailed);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Verification error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Password Login / Signup (Directly works without Twilio SMS)
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsTwilioTrialError(false);
    setSuccessMsg('');

    const formattedPhone = validateAndFormatPhone(phone);
    if (!formattedPhone) {
      setErrorMsg(t.errInvalidPhone);
      return;
    }

    if (password.length < 8) {
      setErrorMsg(t.errShortPass);
      return;
    }

    if (isSignup && !fullName.trim()) {
      setErrorMsg(t.errNameRequired);
      return;
    }

    setLoading(true);

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          phone: formattedPhone,
          password: password,
          options: {
            data: { full_name: fullName.trim() }
          }
        });

        if (error) {
          setErrorMsg(error.message || t.errAuthDefault);
          setLoading(false);
          return;
        }

        if (data?.session) {
          try {
            await supabase.from('profiles').upsert({
              id: data.user.id,
              full_name: fullName.trim(),
              role: 'customer'
            });
          } catch (pErr) {
            console.warn('Profile save note:', pErr);
          }
          onAuthSuccess(data.session);
        } else {
          setSuccessMsg(
            'Account registration submitted. If phone confirmation is enabled, log in using your password.'
          );
          setIsSignup(false);
        }
      } else {
        // Direct password login
        const { data, error } = await supabase.auth.signInWithPassword({
          phone: formattedPhone,
          password: password
        });

        if (error) {
          setErrorMsg(error.message || t.errAuthDefault);
          setLoading(false);
          return;
        }

        if (data?.session) {
          onAuthSuccess(data.session);
        } else {
          setErrorMsg(t.errSessionFailed);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-layout">
        {/* Left hero banner */}
        <div className="auth-intro">
          <div className="auth-eyebrow">
            <span>🧱</span>
            <span>{t.location}</span>
          </div>
          <h1 className="auth-heading">
            Build a Better <br />
            <span>Tomorrow.</span>
          </h1>
          <p className="auth-quote">{t.quote}</p>

          <div className="auth-features">
            <div className="auth-feature-item">
              <div className="auth-feature-icon">🔒</div>
              <div className="auth-feature-text">
                <b>Secure Login</b>
                <small>Indian mobile number authentication with Supabase</small>
              </div>
            </div>

            <div className="auth-feature-item">
              <div className="auth-feature-icon">🚚</div>
              <div className="auth-feature-text">
                <b>{t.svc4Title}</b>
                <small>{t.svc4Text}</small>
              </div>
            </div>

            <div className="auth-feature-item">
              <div className="auth-feature-icon">₹</div>
              <div className="auth-feature-text">
                <b>{t.svc3Title}</b>
                <small>{t.svc3Text}</small>
              </div>
            </div>
          </div>
        </div>

        {/* Right Auth Card */}
        <div className="auth-card">
          <div className="auth-card-header">
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '20px',
                fontWeight: 800,
                color: '#12394d',
                marginBottom: '10px'
              }}
            >
              <span style={{ fontSize: '24px' }}>🧱</span>
              <span>Bricks<span style={{ color: '#e96f21' }}>-Land</span></span>
            </div>

            <h2 className="auth-card-title">
              {isSignup ? t.signupTitle : t.loginTitle}
            </h2>
            <p className="auth-card-subtitle">
              {isSignup
                ? t.signupSubtitle
                : (authMethod === 'password'
                    ? 'Enter your mobile number and password to continue.'
                    : 'Enter your mobile number to receive a verification OTP.')}
            </p>
          </div>

          {/* Authentication Method Tabs */}
          {!isSignup && (
            <div
              style={{
                display: 'flex',
                background: '#f1f5f9',
                borderRadius: '8px',
                padding: '4px',
                marginBottom: '18px',
                gap: '4px'
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('password');
                  setErrorMsg('');
                  setIsTwilioTrialError(false);
                }}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  background: authMethod === 'password' ? '#ffffff' : 'transparent',
                  color: authMethod === 'password' ? '#12394d' : '#64748b',
                  boxShadow: authMethod === 'password' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                🔑 {t.loginWithPassword}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('otp');
                  setOtpStep('send');
                  setErrorMsg('');
                  setIsTwilioTrialError(false);
                }}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  background: authMethod === 'otp' ? '#ffffff' : 'transparent',
                  color: authMethod === 'otp' ? '#12394d' : '#64748b',
                  boxShadow: authMethod === 'otp' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                📲 {t.loginWithOtp}
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="alert-box alert-error" style={{ display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '13px', lineHeight: '1.4' }}>{errorMsg}</div>
              </div>
              {isTwilioTrialError && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #fca5a5', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMethod('password');
                      setErrorMsg('');
                      setIsTwilioTrialError(false);
                    }}
                    style={{
                      background: '#12394d',
                      color: '#ffffff',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      width: '100%',
                      textAlign: 'center'
                    }}
                  >
                    🔑 Click here to Login with Password
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickDemoLogin}
                    style={{
                      background: '#15803d',
                      color: '#ffffff',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      width: '100%',
                      textAlign: 'center'
                    }}
                  >
                    ⚡ Instant Test Login (Bypass SMS to view Dashboard)
                  </button>
                </div>
              )}
            </div>
          )}

          {successMsg && (
            <div className="alert-box alert-success">
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <div>{successMsg}</div>
            </div>
          )}

          {/* ================= 1. PASSWORD FLOW ================= */}
          {(authMethod === 'password' || isSignup) && (
            <form onSubmit={handlePasswordSubmit} noValidate>
              {isSignup && (
                <div className="form-group">
                  <label className="form-label" htmlFor="fullName">
                    {t.fullNameLabel}
                  </label>
                  <div className="input-container">
                    <User className="input-icon" size={18} />
                    <input
                      id="fullName"
                      type="text"
                      className="form-input"
                      placeholder={t.fullNamePlaceholder}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required={isSignup}
                      autoComplete="name"
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="phonePwd">
                  {t.phoneLabel}
                </label>
                <div className="input-container">
                  <Phone className="input-icon" size={18} />
                  <input
                    id="phonePwd"
                    type="tel"
                    inputMode="numeric"
                    className="form-input"
                    placeholder={t.phonePlaceholder}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={14}
                    required
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="passwordField">
                  {t.passwordLabel}
                </label>
                <div className="input-container">
                  <Lock className="input-icon" size={18} />
                  <input
                    id="passwordField"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder={t.passwordPlaceholder}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    className="btn-toggle-pass"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? (
                  <span>{isSignup ? t.signingUp : t.loggingIn}</span>
                ) : (
                  <>
                    <span>{isSignup ? t.signupBtn : t.loginBtn}</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ================= 2. OTP FLOW ================= */}
          {authMethod === 'otp' && !isSignup && otpStep === 'send' && (
            <form onSubmit={handleSendOtp} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="phoneOtp">
                  {t.phoneLabel}
                </label>
                <div className="input-container">
                  <Phone className="input-icon" size={18} />
                  <input
                    id="phoneOtp"
                    type="tel"
                    inputMode="numeric"
                    className="form-input"
                    placeholder={t.phonePlaceholder}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={14}
                    required
                    autoComplete="tel"
                  />
                </div>
              </div>

              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? (
                  <span>{t.sendingOtp}</span>
                ) : (
                  <>
                    <span>{t.sendOtpBtn}</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}

          {authMethod === 'otp' && !isSignup && otpStep === 'verify' && (
            <form onSubmit={handleVerifyOtp} noValidate>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#15803d', fontWeight: 600 }}>
                  📱 {validateAndFormatPhone(phone) || phone}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOtpStep('send');
                    setOtpCode('');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  style={{ background: 'none', color: '#e96f21', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <ArrowLeft size={13} />
                  <span>{t.changeNumber}</span>
                </button>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="otpCode">
                  {t.otpLabel}
                </label>
                <div className="input-container">
                  <KeyRound className="input-icon" size={18} />
                  <input
                    id="otpCode"
                    type="text"
                    inputMode="numeric"
                    className="form-input"
                    placeholder={t.otpPlaceholder}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    required
                    style={{ letterSpacing: '4px', fontSize: '18px', fontWeight: 700 }}
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>
              </div>

              <button type="submit" className="btn-submit" disabled={loading || otpCode.length < 6}>
                {loading ? (
                  <span>{t.verifyingOtp}</span>
                ) : (
                  <>
                    <span>{t.verifyOtpBtn}</span>
                    <CheckCircle2 size={18} />
                  </>
                )}
              </button>

              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <button
                  type="button"
                  disabled={countdown > 0 || loading}
                  onClick={() => handleSendOtp()}
                  style={{
                    background: 'none',
                    color: countdown > 0 ? '#94a3b8' : '#e96f21',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: countdown > 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  {countdown > 0
                    ? `${t.resendOtp} in ${countdown}s`
                    : t.resendOtp}
                </button>
              </div>
            </form>
          )}

          {/* Signup vs Login switch */}
          <div className="auth-switch">
            <span>{isSignup ? t.alreadyAccount : t.newToApp}</span>
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setAuthMethod('password');
                setOtpStep('send');
                setErrorMsg('');
                setIsTwilioTrialError(false);
                setSuccessMsg('');
              }}
            >
              {isSignup ? t.loginAction : t.createAccountAction}
            </button>
          </div>

          {/* Development Quick Bypass */}
          <div style={{ marginTop: '14px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={handleQuickDemoLogin}
              style={{
                background: 'none',
                color: '#15803d',
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'underline'
              }}
            >
              ⚡ Developer Instant Login (Skip SMS & View Dashboard)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
