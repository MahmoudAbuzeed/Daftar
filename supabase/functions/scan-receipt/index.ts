// Supabase Edge Function: scan-receipt
// Receives a base64 image, runs OCR + LLM to extract structured receipt data

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GOOGLE_VISION_API_KEY = Deno.env.get("GOOGLE_VISION_API_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

interface ParsedReceipt {
  items: { name: string; quantity: number; unit_price: number; total: number }[];
  subtotal: number;
  tax: number;
  service_charge: number;
  total: number;
  currency: "EGP" | "USD";
  merchant_name: string | null;
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
    const { image } = await req.json();

    if (!image) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 1: Google Cloud Vision OCR
    let ocrText = "";

    if (GOOGLE_VISION_API_KEY) {
      const visionResponse = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [
              {
                image: { content: image },
                features: [{ type: "TEXT_DETECTION", maxResults: 1 }],
              },
            ],
          }),
        }
      );

      const visionData = await visionResponse.json();
      ocrText =
        visionData.responses?.[0]?.fullTextAnnotation?.text || "";
    }

    // Step 2: Use OpenAI to structure the data
    // If no OCR text (no Google Vision key), send image directly to GPT-4o-mini vision
    let receiptData: ParsedReceipt;

    if (ocrText) {
      // Text-based parsing (cheaper)
      const openaiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are a receipt parser for an expense-splitting app called Fifti.
Given receipt text, extract structured data.

Rules:
- Currency is EGP unless USD/$ is explicitly shown
- Item names should be in the original language (Arabic or English)
- If service charge or tax lines exist, extract them separately
- If total is not parseable, sum the items
- Return ONLY valid JSON, no commentary

Schema: {
  "items": [{"name": "string", "quantity": number, "unit_price": number, "total": number}],
  "subtotal": number,
  "tax": number,
  "service_charge": number,
  "total": number,
  "currency": "EGP" | "USD",
  "merchant_name": "string or null"
}`,
              },
              {
                role: "user",
                content: `Parse this receipt:\n\n${ocrText}`,
              },
            ],
            temperature: 0,
            response_format: { type: "json_object" },
          }),
        }
      );

      const openaiData = await openaiResponse.json();
      receiptData = JSON.parse(
        openaiData.choices[0].message.content
      );
    } else {
      // Vision-based parsing (sends image directly)
      const openaiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are a receipt parser for an expense-splitting app called Fifti.
Given a receipt image, extract all items with prices.

Rules:
- Currency is EGP unless USD/$ is explicitly shown
- Item names should be in the original language (Arabic or English)
- If service charge or tax lines exist, extract them separately
- If total is not parseable, sum the items
- Return ONLY valid JSON

Schema: {
  "items": [{"name": "string", "quantity": number, "unit_price": number, "total": number}],
  "subtotal": number,
  "tax": number,
  "service_charge": number,
  "total": number,
  "currency": "EGP" | "USD",
  "merchant_name": "string or null"
}`,
              },
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${image}`,
                    },
                  },
                  {
                    type: "text",
                    text: "Parse this receipt and extract all items with prices.",
                  },
                ],
              },
            ],
            temperature: 0,
            response_format: { type: "json_object" },
          }),
        }
      );

      const openaiData = await openaiResponse.json();
      receiptData = JSON.parse(
        openaiData.choices[0].message.content
      );
    }

    // Validate and clean up
    if (!receiptData.items) receiptData.items = [];
    if (!receiptData.tax) receiptData.tax = 0;
    if (!receiptData.service_charge) receiptData.service_charge = 0;
    if (!receiptData.currency) receiptData.currency = "EGP";

    // Recalculate totals for safety
    receiptData.subtotal = receiptData.items.reduce(
      (sum, item) => sum + (item.total || item.unit_price * item.quantity),
      0
    );
    if (!receiptData.total) {
      receiptData.total =
        receiptData.subtotal + receiptData.tax + receiptData.service_charge;
    }

    return new Response(JSON.stringify(receiptData), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
