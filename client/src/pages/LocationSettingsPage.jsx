import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import L from "leaflet";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import { MapPinned, Plus, Upload } from "lucide-react";
import { endpoints } from "../services/api";
import { useAoiSelection } from "../hooks/useAoiSelection";

const boundaryStyle = {
  color: "#006B58",
  fillColor: "#12B981",
  fillOpacity: 0.28,
  opacity: 1,
  weight: 2
};

export function LocationSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", files: [] });
  const [uploadFormKey, setUploadFormKey] = useState(0);
  const [message, setMessage] = useState("");
  const { aois, selectedAoiId, selectedAoi, selectedAoiSummary: selectedSummary, isLoading: aoisLoading, isFetching, updateSelectedAoi } = useAoiSelection();

  const createMutation = useMutation({
    mutationFn: (payload) => endpoints.createAoi(payload).then((res) => res.data),
    onSuccess: async (aoi) => {
      setMessage("AOI saved.");
      setForm({ name: "", files: [] });
      setUploadFormKey((current) => current + 1);
      await queryClient.invalidateQueries({ queryKey: ["aois"] });
      updateSelectedAoi(aoi.id);
      queryClient.setQueryData(["aoi", String(aoi.id)], aoi);
    },
    onError: (error) => {
      setMessage(error?.response?.data?.error || "AOI upload failed.");
    }
  });

  const geometry = useMemo(() => selectedAoi?.geometry || null, [selectedAoi]);

  function updateFiles(fileList) {
    setForm((current) => ({ ...current, files: Array.from(fileList || []) }));
  }

  function submitAoi(event) {
    event.preventDefault();
    setMessage("");
    const payload = new FormData();
    payload.append("name", form.name);
    form.files.forEach((file) => payload.append("files", file));
    createMutation.mutate(payload);
  }

  const selectedFileExtensions = new Set(form.files.map((file) => file.name.toLowerCase().match(/\.[^.]+$/)?.[0]).filter(Boolean));
  const missingRequiredFiles = [".shp", ".dbf", ".shx", ".prj"].filter((extension) => !selectedFileExtensions.has(extension));

  return (
    <section className="min-h-[calc(100vh-3.5rem)] bg-[#F5F6F4] p-4 lg:p-5">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Location Settings</h1>
        <p className="text-sm text-black/55">Select county and custom AOIs for map-based water intelligence workflows.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <MapPinned size={18} className="text-emerald-700" />
              <h2 className="text-sm font-bold">AOI Selector</h2>
            </div>
            <label className="mt-4 block text-sm">
              <span className="mb-1 block text-black/60">Area of Interest</span>
              <select
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm"
                value={selectedAoiId}
                onChange={(event) => updateSelectedAoi(event.target.value)}
                disabled={aoisLoading || !aois.length}
              >
                {aois.length ? aois.map((aoi) => (
                  <option key={aoi.id} value={aoi.id}>{aoi.name}</option>
                )) : <option value="">No AOIs available</option>}
              </select>
            </label>
            {selectedSummary && (
              <div className="mt-3 flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                <span className="font-semibold">{selectedSummary.type === "county" ? "County AOI" : "Custom AOI"}</span>
                <span>{isFetching ? "Loading boundary" : "Boundary ready"}</span>
              </div>
            )}
          </section>

          <form key={uploadFormKey} onSubmit={submitAoi} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Plus size={18} className="text-emerald-700" />
              <h2 className="text-sm font-bold">Add AOI</h2>
            </div>
            <label className="mt-4 block text-sm">
              <span className="mb-1 block text-black/60">AOI Name</span>
              <input
                className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Example: Upper Athi Catchment"
              />
            </label>
            <div className="mt-4 grid gap-3">
              <FileInput onChange={updateFiles} />
              {form.files.length > 0 && (
                <div className="rounded-md bg-black/[0.03] px-3 py-2 text-xs text-black/65">
                  <p className="font-semibold text-black/75">Selected files</p>
                  <p className="mt-1 break-words">{form.files.map((file) => file.name).join(", ")}</p>
                  {missingRequiredFiles.length > 0 && <p className="mt-2 font-semibold text-red-700">Missing: {missingRequiredFiles.join(", ")}</p>}
                </div>
              )}
            </div>
            {message && <p className={`mt-3 text-sm ${message.includes("failed") || message.includes("exists") || message.includes("required") ? "text-red-700" : "text-emerald-700"}`}>{message}</p>}
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload size={16} /> {createMutation.isPending ? "Saving AOI" : "Upload AOI"}
            </button>
          </form>
        </aside>

        <section className="min-h-[680px] overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <MapContainer className="h-full min-h-[680px] w-full" center={[0.35, 37.9]} zoom={6} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {geometry && (
              <>
                <FitToGeometry geometry={geometry} />
                <GeoJSON key={`${selectedAoiId}-${selectedAoi?.createdAt || ""}`} data={geometry} style={boundaryStyle} />
              </>
            )}
          </MapContainer>
        </section>
      </div>
    </section>
  );
}

function FileInput({ onChange }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-black/60">Shapefile bundle <span className="text-red-600">*</span></span>
      <input
        type="file"
        accept=".shp,.dbf,.shx,.prj"
        required
        multiple
        onChange={(event) => onChange(event.target.files)}
        className="w-full rounded-md border border-dashed border-black/20 bg-black/[0.02] px-3 py-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-emerald-800"
      />
      <span className="mt-1 block text-xs text-black/45">Select the .shp, .dbf, .shx, and .prj files together.</span>
    </label>
  );
}

function FitToGeometry({ geometry }) {
  const map = useMap();

  useEffect(() => {
    if (!geometry) return;
    const layer = L.geoJSON(geometry);
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 12 });
    }
  }, [geometry, map]);

  return null;
}
