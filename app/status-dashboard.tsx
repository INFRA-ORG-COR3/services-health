"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type StatusLevel = "operational" | "degraded" | "outage" | "checking";

type ServiceStatus = {
  id: string;
  name: string;
  mark: string;
  description: string;
  status: Exclude<StatusLevel, "checking">;
  statusText: string;
  detail: string;
  sourceLabel: string;
  sourceUrl: string;
  sourceType: string;
  checkedAt: string;
};

type StatusResponse = {
  checkedAt: string;
  services: ServiceStatus[];
};

const placeholders: Array<
  Pick<ServiceStatus, "id" | "name" | "mark" | "description" | "sourceType">
> = [
  {
    id: "microsoft-365",
    name: "Microsoft 365",
    mark: "M365",
    description:
      "Exchange Online, Teams, SharePoint, OneDrive, and Microsoft 365 administration.",
    sourceType: "Public service health feed",
  },
  {
    id: "adobe",
    name: "Adobe",
    mark: "AD",
    description:
      "Creative Cloud, Acrobat, Document Cloud, and shared Adobe platform services.",
    sourceType: "Public incident feed",
  },
  {
    id: "3cx",
    name: "3CX",
    mark: "3CX",
    description:
      "WebMeeting availability and AI service load across 3CX regions.",
    sourceType: "Public service status",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    mark: "CF",
    description:
      "Edge network, DNS, security, access, and global connectivity services.",
    sourceType: "Public status API",
  },
  {
    id: "pr-drs",
    name: "PR DRS",
    mark: "DRS",
    description:
      "Puerto Rico Disaster Recovery Solution access and identity sign-in path.",
    sourceType: "Endpoint availability probe",
  },
  {
    id: "recovery-pr",
    name: "RECOVERY.PR",
    mark: "RPR",
    description:
      "COR3 transparency portal, public recovery information, and reports.",
    sourceType: "Endpoint availability probe",
  },
];

const statusCopy: Record<StatusLevel, string> = {
  operational: "Operational",
  degraded: "Service degradation",
  outage: "Outage",
  checking: "Checking",
};

function formatPuertoRicoTime(value?: string) {
  if (!value) return "Waiting for first check";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Puerto_Rico",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function StatusIcon({ level }: { level: StatusLevel }) {
  const label =
    level === "operational"
      ? "✓"
      : level === "degraded"
        ? "!"
        : level === "outage"
          ? "×"
          : "·";
  return (
    <span className={`status-icon status-icon--${level}`} aria-hidden="true">
      {label}
    </span>
  );
}

export function StatusDashboard() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError("");
    try {
      const response = await fetch(`/api/status?ts=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Status request failed");
      setData((await response.json()) as StatusResponse);
    } catch {
      setError(
        "The dashboard could not complete this check. Existing results remain visible."
      );
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(initialRefresh);
  }, [refresh]);

  const services = useMemo(() => {
    if (data) return data.services;
    return placeholders.map((service) => ({
      ...service,
      status: "checking" as const,
      statusText: "Checking",
      detail: "Connecting to the service source…",
      sourceLabel: service.sourceType,
      sourceUrl: "#",
      checkedAt: "",
    }));
  }, [data]);

  const counts = useMemo(
    () =>
      services.reduce(
        (totals, service) => {
          totals[service.status] += 1;
          return totals;
        },
        { operational: 0, degraded: 0, outage: 0, checking: 0 }
      ),
    [services]
  );

  const overall: StatusLevel =
    counts.outage > 0
      ? "outage"
      : counts.degraded > 0
        ? "degraded"
        : counts.checking > 0
          ? "checking"
          : "operational";

  const overallTitle =
    overall === "operational"
      ? "All monitored services are operational"
      : overall === "degraded"
        ? "Service degradation detected"
        : overall === "outage"
          ? "Service outage detected"
          : "Checking service health";

  const attention = services.filter(
    (service) => service.status === "degraded" || service.status === "outage"
  );

  return (
    <main>
      <header className="site-header">
        <div className="header-inner">
          <a
            className="brand-lockup"
            href="#top"
            aria-label="COR3 service health home"
          >
            {/* The official COR3 lockup is served directly to preserve its
                transparent artwork and intrinsic high-resolution dimensions. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/cor3-logo-en.svg"
              alt="COR3 — Central Office for Recovery, Reconstruction and Resiliency, Government of Puerto Rico"
              width="552"
              height="218"
              decoding="async"
            />
          </a>
          <div className="header-context">
            <span className="context-kicker">Technology Operations</span>
            <span className="context-title">Service Health</span>
          </div>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-orb hero-orb--one" />
        <div className="hero-orb hero-orb--two" />
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">COR3 Digital Services</p>
            <h1>Service health at a glance.</h1>
            <p className="hero-description">
              One clear view of the external platforms and public systems that
              support recovery operations across Puerto Rico.
            </p>
          </div>
          <button
            className="refresh-button"
            type="button"
            onClick={() => void refresh()}
            disabled={isRefreshing}
          >
            <span
              className={`refresh-symbol ${isRefreshing ? "is-spinning" : ""}`}
            >
              ↻
            </span>
            {isRefreshing ? "Refreshing…" : "Refresh status"}
          </button>
        </div>
      </section>

      <div className={`overall-banner overall-banner--${overall}`}>
        <div className="overall-inner">
          <div className="overall-message">
            <StatusIcon level={overall} />
            <div>
              <strong>{overallTitle}</strong>
              <span>
                Last checked {formatPuertoRicoTime(data?.checkedAt)} · Puerto
                Rico time
              </span>
            </div>
          </div>
          <div className="status-counts" aria-label="Status totals">
            <span>
              <i className="count-dot count-dot--green" />
              {counts.operational} operational
            </span>
            <span>
              <i className="count-dot count-dot--yellow" />
              {counts.degraded} degraded
            </span>
            <span>
              <i className="count-dot count-dot--red" />
              {counts.outage} outage
            </span>
          </div>
        </div>
      </div>

      <section className="dashboard-shell" aria-label="Monitored services">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Current status</p>
            <h2>Monitored services</h2>
          </div>
          <div className="legend" aria-label="Status legend">
            <span>
              <i className="legend-dot operational" />
              Operational
            </span>
            <span>
              <i className="legend-dot degraded" />
              Degraded
            </span>
            <span>
              <i className="legend-dot outage" />
              Outage
            </span>
          </div>
        </div>

        {error ? (
          <div className="error-message" role="status">
            {error}
          </div>
        ) : null}

        <div className="dashboard-grid">
          <div className="service-grid">
            {services.map((service) => (
              <article
                className={`service-card service-card--${service.status}`}
                key={service.id}
              >
                <div className="card-top">
                  <div className={`service-mark service-mark--${service.id}`}>
                    {service.mark}
                  </div>
                  <div className={`status-pill status-pill--${service.status}`}>
                    <i />
                    {statusCopy[service.status]}
                  </div>
                </div>
                <h3>{service.name}</h3>
                <p className="service-description">{service.description}</p>
                <div className="service-detail">
                  <span className="detail-label">Latest check</span>
                  <p>{service.detail}</p>
                </div>
                <div className="card-footer">
                  <span>{service.sourceType}</span>
                  {service.sourceUrl !== "#" ? (
                    <a
                      href={service.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${service.sourceLabel}`}
                    >
                      View source <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    <span>Connecting…</span>
                  )}
                </div>
              </article>
            ))}
          </div>

          <aside className="attention-panel">
            <div className="attention-header">
              <span className="attention-icon">◎</span>
              <div>
                <p className="section-kicker">Operations view</p>
                <h2>Needs attention</h2>
              </div>
            </div>
            {overall === "checking" ? (
              <p className="attention-empty">
                Status details will appear here after the first check.
              </p>
            ) : attention.length === 0 ? (
              <div className="attention-empty-state">
                <span>✓</span>
                <strong>No active issues</strong>
                <p>All monitored services are responding normally.</p>
              </div>
            ) : (
              <div className="attention-list">
                {attention.map((service) => (
                  <a
                    key={service.id}
                    className={`attention-item attention-item--${service.status}`}
                    href={service.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <div>
                      <strong>{service.name}</strong>
                      <span>{service.statusText}</span>
                    </div>
                    <b aria-hidden="true">↗</b>
                  </a>
                ))}
              </div>
            )}
            <div className="method-note">
              <strong>How status is determined</strong>
              <p>
                Vendor feeds report service incidents. PR DRS and RECOVERY.PR
                use direct availability probes and do not expose internal
                application health.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <footer>
        <div className="footer-inner">
          <span>Government of Puerto Rico · COR3</span>
          <span>
            Central Office for Recovery, Reconstruction and Resiliency
          </span>
        </div>
      </footer>
    </main>
  );
}
