// First-run page: asks for the keys OpenBot needs before it will start, saves them to
// /config/openbot.env, then exits so the entrypoint starts OpenBot.
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const ENV_FILE = "/config/openbot.env";
const REFUSAL_FILE = "/config/last-refusal";
const page = readFileSync(new URL("./setup.html", import.meta.url), "utf8");

function readEnv(): Record<string, string> {
  if (!existsSync(ENV_FILE)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0) out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function render(opts: { error?: string; starting?: boolean } = {}) {
  const saved = readEnv();
  const refusal = existsSync(REFUSAL_FILE) ? readFileSync(REFUSAL_FILE, "utf8").trim() : "";
  const notice = opts.error
    ? `<p class="error">${esc(opts.error)}</p>`
    : refusal
      ? `<p class="error">OpenBot didn't start with the saved keys:<br>${esc(refusal)}</p>`
      : "";
  const provider = saved.BOT_PROVIDER || "anthropic";
  return page
    .replace("{{NOTICE}}", notice)
    .replace("{{FORM_CLASS}}", opts.starting ? "hidden" : "")
    .replace("{{STARTING_CLASS}}", opts.starting ? "" : "hidden")
    .replace("{{CPK_HINT}}", saved.CPK_INTELLIGENCE_API_KEY ? "Saved. Leave blank to keep it." : "")
    .replace("{{MODEL_HINT}}", saved.ANTHROPIC_API_KEY || saved.OPENAI_API_KEY ? "Saved. Leave blank to keep it." : "")
    .replace('value="anthropic"', provider === "anthropic" ? 'value="anthropic" selected' : 'value="anthropic"')
    .replace('value="openai"', provider === "openai" ? 'value="openai" selected' : 'value="openai"');
}

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim();

let done = false;
const server = Bun.serve({
  hostname: "0.0.0.0",
  port: Number(process.env.PORT || 3001),
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "POST" && url.pathname.endsWith("/save")) {
      const form = await req.formData();
      const saved = readEnv();
      const provider = clean(form.get("provider")) === "openai" ? "openai" : "anthropic";
      const cpk = clean(form.get("cpk")) || saved.CPK_INTELLIGENCE_API_KEY || "";
      const keyName = provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
      const modelKey = clean(form.get("modelKey")) || saved[keyName] || "";
      if (!cpk) return html(render({ error: "Paste your CopilotKit Intelligence project key." }), 400);
      if (!modelKey) return html(render({ error: `Paste your ${provider === "openai" ? "OpenAI" : "Anthropic"} API key.` }), 400);
      if ([cpk, modelKey].some((v) => /[\s"'\\$`]/.test(v)))
        return html(render({ error: "A key can't contain spaces or quotes. Check what you pasted." }), 400);
      const lines = [`CPK_INTELLIGENCE_API_KEY=${cpk}`, `BOT_PROVIDER=${provider}`, `${keyName}=${modelKey}`];
      writeFileSync(ENV_FILE, lines.join("\n") + "\n", { mode: 0o600 });
      rmSync(REFUSAL_FILE, { force: true });
      done = true;
      setTimeout(() => { server.stop(true); process.exit(0); }, 500);
      return html(render({ starting: true }));
    }
    if (url.pathname.startsWith("/api/") || url.pathname === "/health")
      return Response.json({ status: "setup", message: "OpenBot is waiting for its keys" }, { status: 503 });
    return html(render({ starting: done }));
  },
});
console.log(`OpenBot setup page listening on :${server.port}; waiting for keys`);
