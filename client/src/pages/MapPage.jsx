import { DroughtMap } from "../components/DroughtMap";

export function MapPage() {
  return (
    <div className="h-[calc(100vh-4rem)] bg-background" id="map-page-root">
      <DroughtMap />
    </div>
  );
}
