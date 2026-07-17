import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

export function RouteErrorBoundary() {
  const error = useRouteError();
  const title = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText || "Route error"}`
    : "Something went wrong";
  const message = isRouteErrorResponse(error)
    ? error.data?.error || error.data?.message || "The requested route could not be rendered."
    : error?.message || "The page failed before it could finish rendering.";

  return (
    <main className="grid min-h-screen place-items-center bg-[#F5F6F4] p-6 text-[#17201d]">
      <section className="w-full max-w-lg rounded-lg border border-red-200 bg-white p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto text-red-600" size={28} />
        <h1 className="mt-4 text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-black/60">{message}</p>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={() => window.location.reload()} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white">
            Reload
          </button>
          <Link to="/dashboard" className="rounded-md border border-black/10 px-4 py-2 text-sm font-bold text-black/70">
            Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
