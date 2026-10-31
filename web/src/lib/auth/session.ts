import { cookies } from "next/headers";
import type { WorkspaceRole } from "@/lib/database.types";

export type WorkspaceActor = {
  user: {
    id: string;
    email: string;
    name?: string;
  };
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
};

export type ActorResult =
  | { actor: WorkspaceActor }
  | { error: string; status: 401 | 403 | 503 };

import { DEMO_PERSONAS, type DemoPersona } from "./personas";
export { DEMO_PERSONAS, type DemoPersona };

const SESSION_COOKIE_NAME = "workline_session";
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "workline-secure-default-key-production-ready-2026-ops-platform";
const DEFAULT_WORKSPACE_ID = "ws_workline_main";
const DEFAULT_WORKSPACE_NAME = "Operations Workbench";

function toBase64Url(str: string): string {
  if (typeof btoa === "function") {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return Buffer.from(str, "utf8").toString("base64url");
}

function fromBase64Url(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  if (typeof atob === "function") {
    return atob(base64);
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

async function getHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSessionToken(actor: WorkspaceActor): Promise<string> {
  const payload = JSON.stringify({
    ...actor,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  });
  const data = toBase64Url(payload);
  const key = await getHmacKey();
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  const signature = toBase64Url(
    String.fromCharCode(...new Uint8Array(signatureBuffer)),
  );
  return `${data}.${signature}`;
}

export async function verifySessionToken(
  token: string,
): Promise<WorkspaceActor | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [data, signature] = parts;
    if (!data || !signature) return null;

    const key = await getHmacKey();
    const sigStr = fromBase64Url(signature);
    const sigBytes = new Uint8Array(sigStr.length);
    for (let i = 0; i < sigStr.length; i++) {
      sigBytes[i] = sigStr.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(data),
    );
    if (!isValid) return null;

    const payload = JSON.parse(fromBase64Url(data));
    if (payload.exp && Date.now() > payload.exp) return null;

    return {
      user: {
        id: payload.user.id,
        email: payload.user.email,
        name: payload.user.name,
      },
      workspaceId: payload.workspaceId || DEFAULT_WORKSPACE_ID,
      workspaceName: payload.workspaceName || DEFAULT_WORKSPACE_NAME,
      role: payload.role || "reviewer",
    };
  } catch {
    return null;
  }
}

export async function getSessionActor(): Promise<WorkspaceActor | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireWorkspaceActor(): Promise<ActorResult> {
  const actor = await getSessionActor();
  if (!actor) {
    return { error: "Sign in to continue.", status: 401 };
  }
  return { actor };
}

export function buildActorFromEmail(
  email: string,
  preferredRole: WorkspaceRole = "reviewer",
  name?: string,
): WorkspaceActor {
  const matchedPersona = DEMO_PERSONAS.find(
    (p) => p.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (matchedPersona) {
    return {
      user: {
        id: matchedPersona.id,
        email: matchedPersona.email,
        name: matchedPersona.name,
      },
      workspaceId: DEFAULT_WORKSPACE_ID,
      workspaceName: DEFAULT_WORKSPACE_NAME,
      role: matchedPersona.role,
    };
  }

  const generatedId = `usr_${Math.random().toString(36).slice(2, 10)}`;
  const displayName =
    name ||
    email
      .split("@")[0]
      ?.replace(/[._]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) ||
    "Staff Member";

  return {
    user: {
      id: generatedId,
      email: email.trim().toLowerCase(),
      name: displayName,
    },
    workspaceId: DEFAULT_WORKSPACE_ID,
    workspaceName: DEFAULT_WORKSPACE_NAME,
    role: preferredRole,
  };
}

export { SESSION_COOKIE_NAME };
