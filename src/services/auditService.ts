import { supabase } from '../lib/supabase';

/** Records a sign-in or sign-out in the audit trail. Never throws and never blocks the user. */
export async function logEvent(action: 'auth.sign_in' | 'auth.sign_out'): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.rpc('log_event', { p_action: action });
  } catch {
    /* auditing must never get in the way of signing in or out */
  }
}
