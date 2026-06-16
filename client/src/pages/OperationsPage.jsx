import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Clock, Wrench } from "lucide-react";
import { endpoints } from "../services/api";

export function OperationsPage() {
  const [health, setHealth] = useState({ sensors: [], stale: [], staleHours: 6 });
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const [healthRes, ticketRes] = await Promise.all([endpoints.sensorHealth({ staleHours: 6 }), endpoints.maintenanceTickets()]);
    setHealth(healthRes.data);
    setTickets(ticketRes.data);
  }

  async function updateTicket(id, status) {
    await endpoints.updateTicketStatus(id, { status });
    await refresh();
  }

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Sensor Operations</h1>
        <p className="text-sm text-black/60">Stale ping monitoring and maintenance ticket workflow</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric icon={AlertTriangle} label="Stale sensors" value={health.stale.length} tone="text-danger" />
        <Metric icon={Wrench} label="Open tickets" value={tickets.filter((ticket) => ticket.status !== "RESOLVED").length} tone="text-warning" />
        <Metric icon={Clock} label="Ping SLA" value={`${health.staleHours}h`} tone="text-primary" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Sensor health">
          <table className="w-full text-left text-sm">
            <thead className="bg-background"><tr><th className="p-3">Sensor</th><th>District</th><th>Hours</th><th>Tickets</th></tr></thead>
            <tbody>{health.sensors.map((sensor) => <tr key={sensor.id} className="border-t border-black/10"><td className="p-3">{sensor.type}</td><td>{sensor.districtName}</td><td>{Number(sensor.hoursSincePing).toFixed(1)}</td><td>{sensor.openTickets}</td></tr>)}</tbody>
          </table>
        </Panel>

        <Panel title="Maintenance tickets">
          <div className="space-y-3 p-3">
            {tickets.map((ticket) => (
              <article key={ticket.id} className="rounded-md border border-black/10 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold">{ticket.title}</p><p className="text-sm text-black/60">{ticket.description}</p></div>
                  <span className="rounded-full bg-warning/15 px-2 py-1 text-xs font-semibold text-warning">{ticket.priority}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-black/55">{ticket.status} · {ticket.staleHours}h stale</p>
                  {ticket.status !== "RESOLVED" && <button onClick={() => updateTicket(ticket.id, "RESOLVED")} className="inline-flex items-center gap-1 rounded-md bg-safe px-2 py-1 text-xs font-semibold text-white"><CheckCircle size={13} /> Resolve</button>}
                </div>
              </article>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value, tone }) {
  return <article className="rounded-lg border border-black/10 bg-white p-5 shadow-panel"><Icon className={tone} size={22} /><p className="mt-4 text-3xl font-semibold">{value}</p><p className="text-sm text-black/60">{label}</p></article>;
}

function Panel({ title, children }) {
  return <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-panel"><h2 className="border-b border-black/10 p-4 font-semibold">{title}</h2>{children}</div>;
}

