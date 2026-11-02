import { Hono, type Context } from "hono";
import type { ServerEnv } from "../env";

const forwardedRequestHeaders = ["authorization", "content-type", "accept", "idempotency-key", "accept-language", "x-fast-demo"];
const droppedResponseHeaders = new Set(["content-encoding", "content-length", "transfer-encoding", "connection"]);

function upstreamError(context: Context) {
  return context.json(
    { error: { code: "upstream_unreachable", message: "The Healix service is not reachable right now", retry: true } },
    502,
  );
}

function forward(baseUrl: string) {
  return async (context: Context) => {
    const incoming = new URL(context.req.url);
    const upstreamPath = incoming.pathname.replace(/^\/api/, "");
    const target = `${baseUrl.replace(/\/$/, "")}${upstreamPath}${incoming.search}`;

    const headers = new Headers();
    for (const name of forwardedRequestHeaders) {
      const value = context.req.header(name);
      if (value) headers.set(name, value);
    }

    const hasBody = !["GET", "HEAD"].includes(context.req.method);
    try {
      const response = await fetch(target, {
        method: context.req.method,
        headers,
        body: hasBody ? context.req.raw.body : undefined,
        ...(hasBody ? { duplex: "half" } : {}),
        signal: context.req.raw.signal,
      } as RequestInit);

      const responseHeaders = new Headers();
      response.headers.forEach((value, name) => {
        if (!droppedResponseHeaders.has(name.toLowerCase())) responseHeaders.set(name, value);
      });
      return new Response(response.body, { status: response.status, headers: responseHeaders });
    } catch {
      return upstreamError(context);
    }
  };
}

export function createProxy(env: ServerEnv): Hono {
  const proxy = new Hono();
  proxy.all("/ai/*", forward(env.AI_URL));
  proxy.all("/*", forward(env.BACKEND_URL));
  return proxy;
}
