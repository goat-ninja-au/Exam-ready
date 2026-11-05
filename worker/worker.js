// Exam Ready AI proxy (Cloudflare Worker)
// Keeps the Anthropic API key secret. The website sends the signed-in student's
// Supabase token; this Worker checks it, then forwards the request to Claude and
// streams the answer back.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const cors = {
      "Access-Control-Allow-Origin": allowed.length === 0 ? "*" : (allowed.includes(origin) ? origin : allowed[0]),
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
    const reply = (obj, status) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return reply({ error: "not_found" }, 404);
    if (allowed.length && !allowed.includes(origin)) return reply({ error: "forbidden_origin" }, 403);
    if (!env.ANTHROPIC_API_KEY) return reply({ error: "sampling_disabled" }, 500);

    // 1. Check the student is signed in (Supabase verifies the token).
    const auth = request.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return reply({ error: "session_expired" }, 401);
    const who = await fetch(env.SUPABASE_URL + "/auth/v1/user", { headers: { Authorization: auth, apikey: env.SUPABASE_ANON_KEY } });
    if (!who.ok) return reply({ error: "session_expired" }, 401);
    const user = await who.json();

    // 2. Optional daily limit per student (needs a KV namespace bound as USAGE).
    if (env.USAGE) {
      const limit = parseInt(env.DAILY_LIMIT || "150", 10);
      const key = "u:" + user.id + ":" + new Date().toISOString().slice(0, 10);
      const used = parseInt((await env.USAGE.get(key)) || "0", 10);
      if (used >= limit) return reply({ error: "rate_limited", detail: "Daily AI limit reached" }, 429);
      await env.USAGE.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 });
    }

    // 3. Validate the request.
    let body;
    try { body = await request.json(); } catch { return reply({ error: "invalid_request" }, 400); }
    const messages = Array.isArray(body.messages) ? body.messages : null;
    if (!messages || !messages.length || messages[messages.length - 1].role !== "user") return reply({ error: "invalid_request" }, 400);
    for (const m of messages) {
      if (!["user", "assistant"].includes(m.role)) return reply({ error: "invalid_request" }, 400);
      if (typeof m.content !== "string" && !Array.isArray(m.content)) return reply({ error: "invalid_request" }, 400);
    }
    if (JSON.stringify(messages).length > 12_000_000) return reply({ error: "prompt_too_large" }, 413);

    const model = body.tier === "quick" ? (env.MODEL_QUICK || "claude-haiku-5-5")
      : body.tier === "complex" ? (env.MODEL_COMPLEX || "claude-sonnet-5-5")
      : (env.MODEL_DEFAULT || "claude-sonnet-5-5");

    // 4. Ask Claude and stream the answer straight back.
    const upstream = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: parseInt(env.MAX_TOKENS || "16000", 10),
        stream: true,
        system: body.json
          ? "You are the AI engine of Exam Ready, a study app for school and university students. Your reply is parsed by a program: reply with only the JSON asked for, no other text."
          : "You are the AI engine of Exam Ready, a study app for school and university students. Be accurate, clear and encouraging.",
        messages,
      }),
    });

    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 400);
      const code = upstream.status === 429 || upstream.status === 529 ? "rate_limited"
        : /too long|too large|maximum context/i.test(detail) ? "prompt_too_large"
        : "upstream_error";
      return reply({ error: code, detail }, upstream.status === 429 ? 429 : 502);
    }
    return new Response(upstream.body, { headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  },
};
