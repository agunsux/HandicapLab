import { supabase } from '../supabase.server';

// Ensure this module is only imported/run on the server side
if (typeof window !== 'undefined') {
  throw new Error('Geo module can only be used on the server side.');
}

/**
 * Resolves the billing/pricing country for the user.
 * Prioritizes:
 * 1. user profile billing_country or country fields (stored in database)
 * 2. request-based headers (e.g. Vercel GeoIP header 'x-vercel-ip-country')
 * 3. Default fallback ('US')
 */
export async function getUserBillingCountry(
  userId?: string,
  requestHeaders?: Headers
): Promise<string> {
  if (userId) {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('country, billing_country')
        .eq('id', userId)
        .maybeSingle();

      if (!error && profile) {
        const country = profile.billing_country || profile.country;
        if (country) {
          return country.trim().toUpperCase();
        }
      }
    } catch (err) {
      console.error('[GeoPricing] Failed to query user profile country:', err);
    }
  }

  if (requestHeaders) {
    const vercelCountry = requestHeaders.get('x-vercel-ip-country');
    if (vercelCountry) {
      return vercelCountry.trim().toUpperCase();
    }
  }

  return 'US';
}
