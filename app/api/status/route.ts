type Level = "operational" | "degraded" | "outage";

type Result = {
  id: string;
  name: string;
  mark: string;
  description: string;
  status: Level;
  statusText: string;
  detail: string;
  sourceLabel: string;
  sourceUrl: string;
  sourceType: string;
  checkedAt: string;
};

const descriptions = {
  microsoft:
    "Exchange Online, Teams, SharePoint, OneDrive, and Microsoft 365 administration.",
  adobe:
    "Creative Cloud, Acrobat, Document Cloud, and shared Adobe platform services.",
  threeCx:
    "WebMeeting availability and AI service load across 3CX regions.",
  cloudflare:
    "Edge network, DNS, security, access, and global connectivity services.",
  drs: "Puerto Rico Disaster Recovery Solution access and identity sign-in path.",
  recovery:
    "COR3 transparency portal, public recovery information, and reports.",
};

function baseResult(
  fields: Omit<Result, "checkedAt" | "statusText"> & { statusText?: string },
  checkedAt: string
): Result {
  return {
    ...fields,
    statusText:
      fields.statusText ??
      (fields.status === "operational"
        ? "Operational"
        : fields.status === "degraded"
          ? "Service degradation"
          : "Outage"),
    checkedAt,
  };
}

function decodeXml(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function timedFetch(url: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "user-agent": "COR3-Service-Health/1.0",
      accept: "*/*",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(12000),
  });
}

async function microsoftStatus(checkedAt: string): Promise<Result> {
  const sourceUrl = "https://status.cloud.microsoft/m365";
  try {
    const response = await timedFetch(
      "https://status.cloud.microsoft/api/feed/mac"
    );
    if (!response.ok) throw new Error("Feed unavailable");
    const xml = await response.text();
    const rawDescription =
      xml.match(/<item>[\s\S]*?<description>([\s\S]*?)<\/description>/i)?.[1] ??
      "";
    const detail = decodeXml(rawDescription);
    const lower = detail.toLowerCase();
    const hasIssue =
      /user impact:|service(?:s)? (?:are |is )?degraded|issues accessing|service interruption|outage/.test(
        lower
      );
    const severe =
      /outage|unable to access|cannot access|service interruption/.test(lower);
    const status: Level = hasIssue
      ? severe
        ? "outage"
        : "degraded"
      : "operational";
    const titleMatch = detail.match(/title:\s*(.*?)(?:user impact:|$)/i);
    const title =
      titleMatch?.[1]?.trim() ||
      (status === "operational"
        ? "Microsoft reports no active public service health advisory."
        : "Microsoft has posted an active Microsoft 365 advisory.");
    return baseResult(
      {
        id: "microsoft-365",
        name: "Microsoft 365",
        mark: "M365",
        description: descriptions.microsoft,
        status,
        detail: title.slice(0, 210),
        sourceLabel: "Microsoft service health",
        sourceUrl,
        sourceType: "Public service health feed",
      },
      checkedAt
    );
  } catch {
    return baseResult(
      {
        id: "microsoft-365",
        name: "Microsoft 365",
        mark: "M365",
        description: descriptions.microsoft,
        status: "outage",
        detail: "The Microsoft public service health feed did not respond.",
        sourceLabel: "Microsoft service health",
        sourceUrl,
        sourceType: "Public service health feed",
      },
      checkedAt
    );
  }
}

async function adobeStatus(checkedAt: string): Promise<Result> {
  const sourceUrl = "https://status.adobe.com/";
  try {
    const response = await timedFetch(
      "https://data.status.adobe.com/adobestatus/StatusEvents",
      { headers: { accept: "application/json" } }
    );
    if (!response.ok) throw new Error("Feed unavailable");
    const payload = (await response.json()) as {
      incidentEvent?: {
        incidents?: Record<
          string,
          {
            products?: Record<
              string,
              {
                name?: string;
                endedOn?: number;
                history?: Record<
                  string,
                  { status?: string; severity?: string }
                >;
              }
            >;
          }
        >;
      };
    };
    const active: Array<{ name: string; severity: string }> = [];
    for (const incident of Object.values(
      payload.incidentEvent?.incidents ?? {}
    )) {
      for (const product of Object.values(incident.products ?? {})) {
        const history = product.history ?? {};
        const latestKey = Object.keys(history).sort(
          (a, b) => Number(b) - Number(a)
        )[0];
        const latest = latestKey ? history[latestKey] : undefined;
        const isOpen =
          !product.endedOn &&
          latest &&
          !["closed", "resolved", "none"].includes(
            (latest.status ?? "").toLowerCase()
          );
        if (isOpen) {
          active.push({
            name: product.name ?? "Adobe service",
            severity: latest.severity ?? "Potential",
          });
        }
      }
    }
    const hasMajor = active.some((item) =>
      /major|critical/i.test(item.severity)
    );
    const status: Level =
      active.length === 0 ? "operational" : hasMajor ? "outage" : "degraded";
    const names = [...new Set(active.map((item) => item.name))];
    const detail =
      active.length === 0
        ? "Adobe reports no unresolved service incidents."
        : `${names.slice(0, 3).join(", ")}${
            names.length > 3 ? ` and ${names.length - 3} more` : ""
          } ${names.length === 1 ? "has" : "have"} an active incident.`;
    return baseResult(
      {
        id: "adobe",
        name: "Adobe",
        mark: "AD",
        description: descriptions.adobe,
        status,
        detail,
        sourceLabel: "Adobe Status",
        sourceUrl,
        sourceType: "Public incident feed",
      },
      checkedAt
    );
  } catch {
    return baseResult(
      {
        id: "adobe",
        name: "Adobe",
        mark: "AD",
        description: descriptions.adobe,
        status: "outage",
        detail: "The Adobe public incident feed did not respond.",
        sourceLabel: "Adobe Status",
        sourceUrl,
        sourceType: "Public incident feed",
      },
      checkedAt
    );
  }
}

async function threeCxStatus(checkedAt: string): Promise<Result> {
  const sourceUrl = "https://status.3cx.net/";
  try {
    const response = await timedFetch(sourceUrl);
    if (!response.ok) throw new Error("Page unavailable");
    const html = await response.text();
    const regionalStates = [
      ...html.matchAll(
        /class="([^"]+)">(?:WebMeeting Server Availability|AI Service Load):\s*([^<]+)/gi
      ),
    ].map((match) => `${match[1]} ${match[2]}`.toLowerCase());
    const hasOutage = regionalStates.some((value) =>
      /offline|critical|unavailable|down|none/.test(value)
    );
    const hasDegradation = regionalStates.some(
      (value) => !/high|normal/.test(value)
    );
    const status: Level = hasOutage
      ? "outage"
      : hasDegradation
        ? "degraded"
        : "operational";
    return baseResult(
      {
        id: "3cx",
        name: "3CX",
        mark: "3CX",
        description: descriptions.threeCx,
        status,
        detail:
          status === "operational"
            ? "3CX reports high WebMeeting availability and normal AI service load."
            : status === "degraded"
              ? "3CX reports reduced availability or elevated AI service load."
              : "3CX reports unavailable regional service capacity.",
        sourceLabel: "3CX WebMeeting & AI Service Status",
        sourceUrl,
        sourceType: "Public service status",
      },
      checkedAt
    );
  } catch {
    return baseResult(
      {
        id: "3cx",
        name: "3CX",
        mark: "3CX",
        description: descriptions.threeCx,
        status: "outage",
        detail: "The 3CX public status page did not respond.",
        sourceLabel: "3CX WebMeeting & AI Service Status",
        sourceUrl,
        sourceType: "Public service status",
      },
      checkedAt
    );
  }
}

async function cloudflareStatus(checkedAt: string): Promise<Result> {
  const sourceUrl = "https://www.cloudflarestatus.com/";
  try {
    const response = await timedFetch(
      "https://www.cloudflarestatus.com/api/v2/status.json",
      { headers: { accept: "application/json" } }
    );
    if (!response.ok) throw new Error("API unavailable");
    const payload = (await response.json()) as {
      status?: { indicator?: string; description?: string };
    };
    const indicator = payload.status?.indicator ?? "critical";
    const status: Level =
      indicator === "none"
        ? "operational"
        : indicator === "minor"
          ? "degraded"
          : "outage";
    return baseResult(
      {
        id: "cloudflare",
        name: "Cloudflare",
        mark: "CF",
        description: descriptions.cloudflare,
        status,
        detail:
          payload.status?.description ?? "Cloudflare status is unavailable.",
        sourceLabel: "Cloudflare Status",
        sourceUrl,
        sourceType: "Public status API",
      },
      checkedAt
    );
  } catch {
    return baseResult(
      {
        id: "cloudflare",
        name: "Cloudflare",
        mark: "CF",
        description: descriptions.cloudflare,
        status: "outage",
        detail: "The Cloudflare public status API did not respond.",
        sourceLabel: "Cloudflare Status",
        sourceUrl,
        sourceType: "Public status API",
      },
      checkedAt
    );
  }
}

async function endpointStatus(
  checkedAt: string,
  config: {
    id: string;
    name: string;
    mark: string;
    description: string;
    url: string;
    sourceLabel: string;
  }
): Promise<Result> {
  try {
    const response = await timedFetch(config.url, {
      redirect: "follow",
      headers: { accept: "text/html,application/xhtml+xml" },
    });
    const status: Level = response.status >= 500 ? "outage" : "operational";
    return baseResult(
      {
        id: config.id,
        name: config.name,
        mark: config.mark,
        description: config.description,
        status,
        detail:
          status === "operational"
            ? `The public access path responded successfully (HTTP ${response.status}).`
            : `The public access path returned HTTP ${response.status}.`,
        sourceLabel: config.sourceLabel,
        sourceUrl: config.url,
        sourceType: "Endpoint availability probe",
      },
      checkedAt
    );
  } catch {
    return baseResult(
      {
        id: config.id,
        name: config.name,
        mark: config.mark,
        description: config.description,
        status: "outage",
        detail: "The public access path did not respond within 12 seconds.",
        sourceLabel: config.sourceLabel,
        sourceUrl: config.url,
        sourceType: "Endpoint availability probe",
      },
      checkedAt
    );
  }
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  const services = await Promise.all([
    microsoftStatus(checkedAt),
    adobeStatus(checkedAt),
    threeCxStatus(checkedAt),
    cloudflareStatus(checkedAt),
    endpointStatus(checkedAt, {
      id: "pr-drs",
      name: "PR DRS",
      mark: "DRS",
      description: descriptions.drs,
      url: "https://prdrs.cor3.pr/",
      sourceLabel: "PR DRS sign-in",
    }),
    endpointStatus(checkedAt, {
      id: "recovery-pr",
      name: "RECOVERY.PR",
      mark: "RPR",
      description: descriptions.recovery,
      url: "https://recovery.pr.gov/",
      sourceLabel: "COR3 Transparency Portal",
    }),
  ]);

  return Response.json(
    { checkedAt, services },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    }
  );
}
