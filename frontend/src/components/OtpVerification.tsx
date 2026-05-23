/**
 * OTP Verification overlay — shown when a new Google/GitHub user
 * needs to verify their email before accessing the app.
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { Shield, Mail, LogOut, RefreshCw, CheckCircle2 } from "lucide-react";

export default function OtpVerification() {
  const { pendingVerification, verifyOtp, sendOtp, signOut } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Countdown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Start cooldown when component mounts (OTP was auto-sent)
  useEffect(() => {
    setCooldown(60);
  }, []);

  const handleVerify = useCallback(async () => {
    if (!pendingVerification || code.length !== 6) return;
    setLoading(true);
    setError(null);
    const { error: err } = await verifyOtp(pendingVerification.email, code);
    if (err) {
      setError(err);
      setCode("");
      setLoading(false);
    } else {
      setVerified(true);
      setLoading(false);
    }
  }, [pendingVerification, code, verifyOtp]);

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (code.length === 6 && !loading) {
      handleVerify();
    }
  }, [code, loading, handleVerify]);

  const handleResend = async () => {
    if (!pendingVerification || cooldown > 0) return;
    setError(null);
    const { error: err } = await sendOtp(pendingVerification.email);
    if (err) {
      setError(err);
    } else {
      setCooldown(60);
    }
  };

  if (!pendingVerification) return null;

  // Brief success state before redirect
  if (verified) {
    return (
      <div className="fixed inset-0 z-[999] bg-background flex items-center justify-center">
        <div className="qm-fade-in text-center">
          <div className="w-16 h-16 bg-success/10 border border-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-success" />
          </div>
          <h2 className="text-text-primary text-xl font-bold">Verified!</h2>
          <p className="text-text-muted text-sm mt-2">Welcome to QueryMind</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[999] bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-[440px] qm-fade-in">
        <div className="bg-panel border border-border rounded-lg p-8 shadow-xl shadow-black/20">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield size={24} className="text-primary" />
            </div>
            <h2 className="text-text-primary text-xl font-bold tracking-tight">
              Verify Your Email
            </h2>
            <p className="text-text-muted text-sm mt-2 leading-relaxed">
              We sent a 6-digit code to
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Mail size={14} className="text-primary" />
              <span className="text-primary font-mono text-sm font-medium">
                {pendingVerification.email}
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-critical/10 border border-critical/20 rounded-md px-3 py-2.5 text-critical text-[13px] font-mono flex items-center gap-2 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-critical shrink-0" />
              {error}
            </div>
          )}

          {/* OTP Input */}
          <div className="flex justify-center mb-6">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={(val) => setCode(val)}
              disabled={loading}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="w-12 h-14 text-lg font-mono font-bold bg-code border-border text-text-primary" />
                <InputOTPSlot index={1} className="w-12 h-14 text-lg font-mono font-bold bg-code border-border text-text-primary" />
                <InputOTPSlot index={2} className="w-12 h-14 text-lg font-mono font-bold bg-code border-border text-text-primary" />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} className="w-12 h-14 text-lg font-mono font-bold bg-code border-border text-text-primary" />
                <InputOTPSlot index={4} className="w-12 h-14 text-lg font-mono font-bold bg-code border-border text-text-primary" />
                <InputOTPSlot index={5} className="w-12 h-14 text-lg font-mono font-bold bg-code border-border text-text-primary" />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {/* Verify Button */}
          <button
            onClick={handleVerify}
            disabled={code.length !== 6 || loading}
            className="w-full bg-primary text-primary-foreground text-sm font-semibold py-2.5 rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 qm-glow"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Verifying...
              </span>
            ) : (
              "Verify & Continue"
            )}
          </button>

          {/* Resend + Sign Out */}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
            <button
              onClick={handleResend}
              disabled={cooldown > 0}
              className="flex items-center gap-1.5 text-text-muted text-[13px] hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw size={12} />
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-text-muted text-[13px] hover:text-critical transition-colors"
            >
              <LogOut size={12} />
              Sign out
            </button>
          </div>
        </div>

        {/* Trust signal */}
        <div className="mt-4 text-center text-text-disabled text-[10px] font-mono">
          <Shield size={10} className="inline mr-1" />
          End-to-end encrypted · Code expires in 10 minutes
        </div>
      </div>
    </div>
  );
}
