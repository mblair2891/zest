import { readServerEnv } from "@/lib/database-url";

export type EsignSendInput = {
  title: string;
  body: string;
  signerName: string;
  signerEmail: string;
  returnUrl?: string;
};

export type EsignSendResult = {
  configured: boolean;
  provider: string | null;
  envelopeId: string | null;
  status: "sent" | "awaiting_upload";
  message: string;
};

export function esignConfigured(): { ok: boolean; provider: string | null } {
  if (readServerEnv("DOCUSIGN_ACCESS_TOKEN") && readServerEnv("DOCUSIGN_ACCOUNT_ID")) {
    return { ok: true, provider: "docusign" };
  }
  if (readServerEnv("HELLOSIGN_API_KEY") || readServerEnv("DROPBOXSIGN_API_KEY")) {
    return { ok: true, provider: "hellosign" };
  }
  return { ok: false, provider: null };
}

export async function sendEsignEnvelope(input: EsignSendInput): Promise<EsignSendResult> {
  const cfg = esignConfigured();
  if (!cfg.ok || !input.signerEmail.includes("@")) {
    return {
      configured: false,
      provider: null,
      envelopeId: null,
      status: "awaiting_upload",
      message:
        "E-sign vendor is not configured. Packet generated — send to the employee and attach the signed PDF when it returns.",
    };
  }
  if (cfg.provider === "docusign") {
    return sendDocusign(input);
  }
  return sendHellosign(input);
}

async function sendDocusign(input: EsignSendInput): Promise<EsignSendResult> {
  const token = readServerEnv("DOCUSIGN_ACCESS_TOKEN")!;
  const account = readServerEnv("DOCUSIGN_ACCOUNT_ID")!;
  const base =
    readServerEnv("DOCUSIGN_BASE_PATH")?.replace(/\/$/, "") ||
    "https://demo.docusign.net/restapi";
  const b64 = Buffer.from(input.body, "utf8").toString("base64");
  try {
    const res = await fetch(`${base}/v2.1/accounts/${account}/envelopes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        emailSubject: input.title,
        status: "sent",
        documents: [
          {
            documentBase64: b64,
            name: `${input.title}.txt`,
            fileExtension: "txt",
            documentId: "1",
          },
        ],
        recipients: {
          signers: [
            {
              email: input.signerEmail,
              name: input.signerName,
              recipientId: "1",
              routingOrder: "1",
            },
          ],
        },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { envelopeId?: string; message?: string };
    if (!res.ok || !json.envelopeId) {
      return {
        configured: true,
        provider: "docusign",
        envelopeId: null,
        status: "awaiting_upload",
        message: json.message || `DocuSign ${res.status} — packet saved for upload.`,
      };
    }
    return {
      configured: true,
      provider: "docusign",
      envelopeId: json.envelopeId,
      status: "sent",
      message: "Sent via DocuSign.",
    };
  } catch {
    return {
      configured: true,
      provider: "docusign",
      envelopeId: null,
      status: "awaiting_upload",
      message: "DocuSign unreachable — packet saved for upload.",
    };
  }
}

async function sendHellosign(input: EsignSendInput): Promise<EsignSendResult> {
  const key = readServerEnv("HELLOSIGN_API_KEY") || readServerEnv("DROPBOXSIGN_API_KEY")!;
  const auth = Buffer.from(`${key}:`).toString("base64");
  const body = new URLSearchParams();
  body.set("title", input.title);
  body.set("subject", input.title);
  body.set("message", input.body.slice(0, 4000));
  body.set("signers[0][email_address]", input.signerEmail);
  body.set("signers[0][name]", input.signerName);
  body.set("test_mode", "1");
  try {
    const res = await fetch("https://api.hellosign.com/v3/signature_request/send", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as {
      signature_request?: { signature_request_id?: string };
      error?: { error_msg?: string };
    };
    const id = json.signature_request?.signature_request_id;
    if (!res.ok || !id) {
      return {
        configured: true,
        provider: "hellosign",
        envelopeId: null,
        status: "awaiting_upload",
        message: json.error?.error_msg || `HelloSign ${res.status} — packet saved for upload.`,
      };
    }
    return {
      configured: true,
      provider: "hellosign",
      envelopeId: id,
      status: "sent",
      message: "Sent via HelloSign / Dropbox Sign.",
    };
  } catch {
    return {
      configured: true,
      provider: "hellosign",
      envelopeId: null,
      status: "awaiting_upload",
      message: "HelloSign unreachable — packet saved for upload.",
    };
  }
}
