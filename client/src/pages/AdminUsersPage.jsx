import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Pagination, usePagination } from "../components/Pagination";
import { endpoints } from "../services/api";
import { asArray } from "../utils/apiData";

export function AdminUsersPage() {
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "field_agent", district: "" });
  const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId);
  const usersPagination = usePagination(users, 8);

  useEffect(() => { refreshTenants(); }, []);
  useEffect(() => { if (selectedTenantId) refreshUsers(selectedTenantId); }, [selectedTenantId]);

  async function refreshTenants() {
    const { data } = await endpoints.tenants();
    const rows = asArray(data);
    setTenants(rows);
    setSelectedTenantId((current) => current || rows[0]?.id || "");
  }

  async function refreshUsers(tenantId) {
    const { data } = await endpoints.tenantUsers(tenantId);
    setUsers(asArray(data));
  }

  async function createUser(event) {
    event.preventDefault();
    if (!selectedTenantId) return;
    await endpoints.createTenantUser(selectedTenantId, userForm);
    setUserForm({ name: "", email: "", password: "", role: "field_agent", district: "" });
    setShowForm(false);
    await refreshUsers(selectedTenantId);
  }

  async function deactivateUser(userId) {
    if (!selectedTenantId) return;
    await endpoints.deactivateTenantUser(selectedTenantId, userId);
    await refreshUsers(selectedTenantId);
  }

  const stats = useMemo(() => ({
    total: users.length,
    fieldAgents: users.filter((user) => user.role === "field_agent").length,
    admins: users.filter((user) => user.role === "admin").length,
    inactive: users.filter((user) => user.status && user.status !== "ACTIVE").length
  }), [users]);

  return (
    <section className="space-y-4 p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Users</h1>
          <p className="text-sm text-black/55">{selectedTenant ? `${selectedTenant.name} users` : "Tenant users"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm" value={selectedTenantId} onChange={(event) => setSelectedTenantId(event.target.value)}>
            {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
          </select>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"><Plus size={15} /> Add User</button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric title="Total Users" value={stats.total} />
        <Metric title="Field Agents" value={stats.fieldAgents} />
        <Metric title="Admins" value={stats.admins} />
        <Metric title="Inactive" value={stats.inactive} />
      </div>

      <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
        <div className="border-b border-black/10 p-4"><h2 className="text-sm font-bold">User Management</h2></div>
        <table className="w-full text-left text-sm">
          <thead className="bg-background"><tr><th className="p-3">Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
          <tbody>
            {usersPagination.pageRows.map((user) => <tr key={user.id} className="border-t border-black/10"><td className="p-3 font-medium">{user.name}</td><td>{user.email}</td><td className="capitalize">{user.role?.replace("_", " ")}</td><td><StatusBadge status={user.status || "ACTIVE"} /></td><td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "-"}</td><td>{user.status !== "INACTIVE" && <button onClick={() => deactivateUser(user.id)} className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">Deactivate</button>}</td></tr>)}
            {!users.length && <tr><td colSpan={6} className="p-6 text-center text-sm text-black/50">No users returned by the backend.</td></tr>}
          </tbody>
        </table>
        <Pagination pagination={usersPagination} />
      </section>

      {showForm && (
        <div className="fixed inset-0 z-[900] grid place-items-center bg-black/40 p-4">
          <form onSubmit={createUser} className="w-full max-w-lg space-y-3 rounded-lg bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between"><h2 className="font-bold">Add User</h2><button type="button" onClick={() => setShowForm(false)}><X size={18} /></button></div>
            <input className="w-full rounded-md border border-black/15 px-3 py-2" placeholder="Name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
            <input className="w-full rounded-md border border-black/15 px-3 py-2" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
            <input className="w-full rounded-md border border-black/15 px-3 py-2" placeholder="Password" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
            <select className="w-full rounded-md border border-black/15 px-3 py-2" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              <option value="admin">Admin</option>
              <option value="field_agent">Field Agent</option>
              <option value="community_user">Community User</option>
            </select>
            <input className="w-full rounded-md border border-black/15 px-3 py-2" placeholder="District" value={userForm.district} onChange={(e) => setUserForm({ ...userForm, district: e.target.value })} />
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-white"><Plus size={16} /> Add User</button>
          </form>
        </div>
      )}
    </section>
  );
}

function Metric({ title, value }) {
  return <article className="rounded-lg border border-black/10 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-black/55">{title}</p><p className="mt-2 text-3xl font-bold">{value}</p></article>;
}

function StatusBadge({ status }) {
  const active = status === "ACTIVE";
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"}`}>{status}</span>;
}
