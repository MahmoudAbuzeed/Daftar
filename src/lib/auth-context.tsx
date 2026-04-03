import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { User } from '../types/database';

interface AuthContextType {
  session: Session | null;
  user: SupabaseUser | null;
  profile: User | null;
  loading: boolean;
  needsProfile: boolean; // True when user is authenticated but has no profile yet
  sendOTP: (phone: string) => Promise<void>;
  verifyOTP: (phone: string, code: string) => Promise<void>;
  setupProfile: (displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);

  const ensureProfile = async (id: string, displayName: string, phone?: string | null) => {
    const { error } = await supabase.rpc('ensure_user_profile', {
      user_id: id,
      user_display_name: displayName,
      user_email: phone ?? '',
    });
    if (error) console.warn('ensure_user_profile RPC failed:', error.message);
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setProfile(data);
      setNeedsProfile(false);
      return;
    }

    // No profile yet — this is a new user who just verified OTP
    setNeedsProfile(true);
    setProfile(null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setNeedsProfile(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Send OTP to phone number
  const sendOTP = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
  };

  // Verify OTP code
  const verifyOTP = async (phone: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: 'sms',
    });
    if (error) throw error;
  };

  // Set up profile for new users after OTP verification
  const setupProfile = async (displayName: string) => {
    if (!user) throw new Error('No user');

    await ensureProfile(user.id, displayName, user.phone);

    // Update the phone field in users table
    await supabase
      .from('users')
      .update({ display_name: displayName, phone: user.phone })
      .eq('id', user.id);

    await fetchProfile(user.id);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
    setNeedsProfile(false);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session, user, profile, loading, needsProfile,
        sendOTP, verifyOTP, setupProfile, signOut, refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
