import { useQuery } from "@tanstack/react-query";
import { endpoints } from "../services/api";

export const defaultPlatformSettings = {
  organizationName: "Smart Water",
  country: "Kenya",
  general: {
    defaultDistrict: "Makueni",
    temperatureUnit: "Celsius"
  },
  map: {
    defaultZoom: 9,
    defaultBasemap: "OpenStreetMap",
    centerLat: -2.25,
    centerLng: 37.85
  }
};

export function usePlatformSettings() {
  return useQuery({
    queryKey: ["platform-settings"],
    queryFn: () => endpoints.currentSettings().then((res) => normalizeSettings(res.data)),
    staleTime: 5 * 60 * 1000
  });
}

export function normalizeSettings(settings = {}) {
  return {
    ...defaultPlatformSettings,
    ...settings,
    general: {
      ...defaultPlatformSettings.general,
      ...(settings.general || {})
    },
    map: {
      ...defaultPlatformSettings.map,
      ...(settings.map || {}),
      defaultZoom: Number(settings.map?.defaultZoom || defaultPlatformSettings.map.defaultZoom),
      centerLat: Number(settings.map?.centerLat || defaultPlatformSettings.map.centerLat),
      centerLng: Number(settings.map?.centerLng || defaultPlatformSettings.map.centerLng)
    }
  };
}

export function formatTemperature(tempC, unit = "Celsius") {
  if (!Number.isFinite(Number(tempC))) return "-";
  if (unit === "Fahrenheit") return `${Math.round((Number(tempC) * 9) / 5 + 32)}°F`;
  return `${Math.round(Number(tempC))}°C`;
}
