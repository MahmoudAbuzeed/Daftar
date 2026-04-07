// Supabase Edge Function: send-push-notification
// Sends push notifications to users via Expo Push API

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";

interface RequestBody {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: string;
}

interface ExpoTicket {
  id: string;
  status: string;
  message?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    const body: RequestBody = await req.json();
    const { userIds, title, body: messageBody, data } = body;

    if (!userIds || userIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "userIds array is required and must not be empty" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!title || !messageBody) {
      return new Response(
        JSON.stringify({ error: "title and body are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch push tokens for the specified users
    const { data: tokens, error: tokensError } = await supabase
      .from("push_tokens")
      .select("*")
      .in("user_id", userIds);

    if (tokensError) {
      console.error("Error fetching push tokens:", tokensError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch push tokens" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!tokens || tokens.length === 0) {
      // No tokens found, which is fine - users might not have registered yet
      return new Response(
        JSON.stringify({ message: "No push tokens found for users", tokenCount: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Prepare push messages for Expo
    const messages = tokens.map((token: PushToken) => ({
      to: token.token,
      title,
      body: messageBody,
      data: data || {},
      sound: "default",
      badge: 1,
    }));

    // Send to Expo Push API in batches (max 100 per request)
    const batchSize = 100;
    const tickets: ExpoTicket[] = [];

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const response = await fetch(EXPO_PUSH_API_URL, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });

      const batchResult = await response.json();

      if (!response.ok) {
        console.error("Expo API error:", batchResult);
        return new Response(
          JSON.stringify({ error: "Failed to send push notifications", details: batchResult }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      if (batchResult.data) {
        tickets.push(...batchResult.data);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Push notifications sent successfully",
        tokenCount: tokens.length,
        ticketCount: tickets.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
