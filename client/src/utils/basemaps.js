export const basemapOptions = [
  {
    name: "OpenStreetMap",
    swatchClass: "bg-[linear-gradient(135deg,#e8efe1_0_35%,#f7f1df_35%_55%,#b8d7ef_55%_100%)]",
    attribution: "&copy; OpenStreetMap contributors",
    getUrl: () => import.meta.env.VITE_MAP_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  },
  {
    name: "Satellite",
    swatchClass: "bg-[radial-gradient(circle_at_30%_30%,#789168,#263e28_46%,#102417)]",
    attribution: "Tiles &copy; Esri",
    getUrl: () => "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  },
  {
    name: "Terrain",
    swatchClass: "bg-[linear-gradient(135deg,#e4d9bd,#8ba06f_45%,#6f5f42)]",
    attribution: "Map data &copy; OpenTopoMap contributors",
    getUrl: () => "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
  },
  {
    name: "Dark Map",
    swatchClass: "bg-[linear-gradient(135deg,#0f172a,#1f2937_50%,#111827)]",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    getUrl: () => "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
  }
];

export function basemapSwatch(name) {
  return basemapOptions.find((item) => item.name === name)?.swatchClass || basemapOptions[0].swatchClass;
}

export function basemapUrl(name) {
  return (basemapOptions.find((item) => item.name === name) || basemapOptions[0]).getUrl();
}

export function basemapAttribution(name) {
  return basemapOptions.find((item) => item.name === name)?.attribution || basemapOptions[0].attribution;
}
