import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

function headers() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const twilio = process.env["TWILIO_API_KEY"];
  if (!lovable) throw new Error("LOVABLE_API_KEY não configurada");
  if (!twilio) throw new Error("Twilio não conectado");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": twilio,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

async function call(path, init) {
  const res = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers: headers() });
  const text = await res.text();
  if (!res.ok) throw new Error(`Twilio [${res.status}]: ${text}`);
  return JSON.parse(text);
}

export const scheduleSms = createServerFn({ method: "POST" })
  .inputValidator((d) => {
    if (!/^\+\d{8,15}$/.test(d.to)) throw new Error("Telefone inválido. Use o formato +5511999999999");
    if (!d.body || d.body.length > 500) throw new Error("Mensagem inválida");
    if (isNaN(Date.parse(d.sendAt))) throw new Error("Data inválida");
    return d;
  })
  .handler(async ({ data }) => {
    const sendAt = new Date(data.sendAt);
    const diffMin = (sendAt.getTime() - Date.now()) / 60000;
    if (diffMin < 0) return { sid: null, status: "past" };

    const services = await call("/messaging/v1/Services?PageSize=1", { method: "GET" });
    const serviceSid = services?.services?.[0]?.sid;
    if (!serviceSid) throw new Error("Crie um Messaging Service no Twilio com um número de envio.");

    const params = new URLSearchParams({ To: data.to, Body: data.body, MessagingServiceSid: serviceSid });
    // Twilio exige agendamento com pelo menos 15 min de antecedência; abaixo disso envia agora.
    if (diffMin >= 16) {
      params.set("ScheduleType", "fixed");
      params.set("SendAt", sendAt.toISOString());
    }
    const msg = await call("/Messages.json", { method: "POST", body: params });
    return { sid: msg.sid, status: diffMin >= 16 ? "scheduled" : "sent" };
  });

export const cancelSms = createServerFn({ method: "POST" })
  .inputValidator((d) => {
    if (!/^SM[a-f0-9]{32}$/i.test(d.sid)) throw new Error("SID inválido");
    return d;
  })
  .handler(async ({ data }) => {
    try {
      await call(`/Messages/${data.sid}.json`, {
        method: "POST",
        body: new URLSearchParams({ Status: "canceled" }),
      });
    } catch (e) {
      console.error(e);
    }
    return { ok: true };
  });
