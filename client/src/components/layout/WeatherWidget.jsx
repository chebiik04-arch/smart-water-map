import { useQuery } from "@tanstack/react-query";
import { CloudRain } from "lucide-react";
import { endpoints } from "../../services/api";
import { formatTemperature } from "../../hooks/usePlatformSettings";

export function WeatherWidget({ districtId, locationName = "Weather", unit = "Celsius" }) {
  const { data } = useQuery({
    queryKey: ["weather", districtId],
    queryFn: () => endpoints.weatherCurrent({ districtId }).then((res) => res.data),
    refetchInterval: 10 * 60 * 1000
  });

  return (
    <div className="border-t border-white/15 pt-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <CloudRain size={22} className="text-sky-300" />
        {locationName}
      </div>
      {data ? <>
        <p className="mt-4 text-3xl font-bold">{formatTemperature(data.tempC, unit)}</p>
        <p className="text-sm text-white/85">{data.condition}</p>
        <p className="text-xs text-white/65">Configured in {unit}</p>
        <p className="mt-3 text-sm text-white/85">Humidity: {data.humidity}%</p>
        <p className="text-sm text-white/85">Wind: {data.windKmh} km/h</p>
      </> : <p className="mt-4 text-sm text-white/75">Weather data unavailable.</p>}
      {data?.forecastUrl && <a className="mt-4 inline-block text-sm font-medium text-emerald-300" href={data.forecastUrl} target="_blank" rel="noreferrer">
        View full forecast
      </a>}
    </div>
  );
}
