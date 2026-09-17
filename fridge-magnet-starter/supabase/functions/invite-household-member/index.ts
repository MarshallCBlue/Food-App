// Sends a household invite by email instead of reading a six-character
// code out loud. Deployed with verify_jwt: true (the default) — this
// genuinely expects a signed-in caller, unlike send-expiry-reminders.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Where the invite email's link sends someone after they set a password —
// an Edge Function secret rather than a guess, since this project's exact
// Netlify subdomain isn't something this code should assume.
const appUrl = Deno.env.get("APP_URL")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401 });
  }

  let email: string | undefined;
  let householdId: string | undefined;
  try {
    const body = await req.json();
    email = body.email;
    householdId = body.householdId;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!email || !householdId) {
    return new Response(JSON.stringify({ error: "email and householdId are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Acts as the caller, with the caller's own permissions — this is what
  // proves they actually belong to the household they're inviting someone
  // into, using ordinary RLS rather than a manual authorisation check
  // that could drift out of sync with the real policy.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: membership } = await callerClient
    .from("household_members")
    .select("household_id")
    .eq("household_id", householdId)
    .maybeSingle();

  if (!membership) {
    return new Response(JSON.stringify({ error: "You're not a member of that household" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Only now switches to the admin client — inviteUserByEmail requires
  // the service role key, which must never be reachable from the browser.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { invited_household_id: householdId },
    redirectTo: appUrl,
  });

  if (inviteError) {
    return new Response(JSON.stringify({ error: inviteError.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
