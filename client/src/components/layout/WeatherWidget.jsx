import { useQuery } from "@tanstack/react-query";
import { CloudRain } from "lucide-react";
import { endpoints } from "../../services/api";

export function WeatherWidget({ districtId, locationName = "Makueni Weather" }) {
  const { data } = useQuery({
    queryKey: ["weather", districtId],
    queryFn: () => endpoints.weatherCurrent({ districtId }).then((res) => res.data),
    refetchInterval: 10 * 60 * 1000
  });

  const weather = data || { tempC: 27, condition: "Cloudy", humidity: 54, windKmh: 18, forecastUrl: "#" };

  return (
    <div className="border-t border-white/15 pt-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <CloudRain size={22} className="text-sky-300" />
        {locationName}
      </div>
      <p className="mt-4 text-3xl font-bold">{weather.tempC}°C</p>
      <p className="text-sm text-white/85">{weather.condition}</p>
      <p className="mt-3 text-sm text-white/85">Humidity: {weather.humidity}%</p>
      <p className="text-sm text-white/85">Wind: {weather.windKmh} km/h</p>
      <a className="mt-4 inline-block text-sm font-medium text-emerald-300" href={weather.forecastUrl} target="_blank" rel="noreferrer">
        View full forecast
      </a>
    </div>
  );
}
