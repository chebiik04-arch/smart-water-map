import { AlertTriangle, Loader2, SearchX } from "lucide-react";

export function LoadingState({ title = "Loading data", message = "Fetching the latest platform data." }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-6 text-center text-sm text-black/55 shadow-sm" role="status">
      <Loader2 className="mx-auto mb-3 animate-spin text-emerald-600" size={22} />
      <p className="font-bold text-black/70">{title}</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}

export function ErrorState({ title = "Unable to load data", message, onRetry }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 shadow-sm" role="alert">
      <AlertTriangle className="mx-auto mb-3" size={22} />
      <p className="font-bold">{title}</p>
      <p className="mt-1">{message || "The API did not return usable data. Try again or check the service status."}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-4 rounded-md bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700">
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title = "No data available", message = "No records matched the current filters." }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-6 text-center text-sm text-black/50 shadow-sm">
      <SearchX className="mx-auto mb-3 text-black/35" size={22} />
      <p className="font-bold text-black/70">{title}</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}

export function InlineState({ loading, error, empty, loadingMessage, errorMessage, emptyMessage, retry, children }) {
  if (loading) return <LoadingState message={loadingMessage} />;
  if (error) return <ErrorState message={errorMessage} onRetry={retry} />;
  if (empty) return <EmptyState message={emptyMessage} />;
  return children;
}
