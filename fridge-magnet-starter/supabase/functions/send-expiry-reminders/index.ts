// One notification per household per day, never one per item — pg_cron
// calls this once at 8am. Auth is a shared secret (CRON_SECRET) checked
// below, not a user JWT, since there's no signed-in user for a scheduled
// job — that's also why this function is deployed with verify_jwt: false.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cronSecret = Deno.env.get("CRON_SECRET");

function buildMessage(names: string[]): string {
  const shown = names.slice(0, 3);
  const preview = shown.join(", ");
  const remaining = names.length - shown.length;

  if (remaining > 0) {
    return `${names.length} items need using: ${preview}, and ${remaining} more`;
  }
  if (names.length === 1) {
    return `1 item needs using: ${preview}`;
  }
  return `${names.length} items need using: ${preview}`;
}

Deno.serve(async (req) => {
  // Checked first, and only against the secret — nothing here depends on
  // the VAPID keys, so a wrong or missing caller secret always gets a
  // clean 401 regardless of whether the rest of this function's config
  // is finished yet.
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Configuring web-push can throw if the VAPID keys aren't set yet or
  // are malformed — deliberately done after the auth check, and caught,
  // so a half-finished setup fails with a clear message instead of the
  // whole function crashing before it can even respond.
  try {
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT")!,
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!,
    );
  } catch (configError) {
    return new Response(
      JSON.stringify({ error: `VAPID keys not configured correctly: ${(configError as Error).message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Same three-day window the Expiring view's "soon" tier uses.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 3);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const { data: expiring, error: expiringError } = await supabase
    .from("inventory_items")
    .select("household_id, item:items(name)")
    .not("expires_on", "is", null)
    .lte("expires_on", cutoffDate);

  if (expiringError) {
    return new Response(JSON.stringify({ error: expiringError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const namesByHousehold = new Map<string, string[]>();
  for (const row of expiring ?? []) {
    const list = namesByHousehold.get(row.household_id) ?? [];
    // @ts-ignore: PostgREST returns the joined row as an object here, not an array.
    list.push(row.item.name);
    namesByHousehold.set(row.household_id, list);
  }

  let pushesSent = 0;
  let staleSubscriptionsRemoved = 0;

  for (const [householdId, names] of namesByHousehold) {
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key")
      .eq("household_id", householdId);

    if (!subscriptions || subscriptions.length === 0) continue;

    const body = buildMessage(names);
    const payload = JSON.stringify({ title: "Fridge Magnet", body });

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
          },
          payload,
        );
        pushesSent++;
      } catch (sendError) {
        // 404/410 means the browser dropped this subscription (uninstalled,
        // storage cleared, etc.) — clean it up so future runs stop retrying it.
        const statusCode = (sendError as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
          staleSubscriptionsRemoved++;
        }
      }
    }
  }

  return new Response(
    JSON.stringify({
      households_notified: namesByHousehold.size,
      pushes_sent: pushesSent,
      stale_subscriptions_removed: staleSubscriptionsRemoved,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
