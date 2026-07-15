import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endpoints } from "../services/api";

export const selectedAoiStorageKey = "smart-water-map-selected-aoi";
export const selectedAoiEventName = "smart-water-map:aoi-change";
export const defaultAoiName = "Makueni";

export function useAoiSelection() {
  const [selectedAoiId, setSelectedAoiId] = useState(() => localStorage.getItem(selectedAoiStorageKey) || "");

  const { data: aois = [], isLoading } = useQuery({
    queryKey: ["aois"],
    queryFn: () => endpoints.aois().then((res) => res.data)
  });

  useEffect(() => {
    if (!selectedAoiId && aois.length) {
      const defaultAoi = aois.find((aoi) => String(aoi.name || "").toLowerCase() === defaultAoiName.toLowerCase()) || aois[0];
      updateSelectedAoi(defaultAoi.id);
    }
  }, [aois, selectedAoiId]);

  const { data: selectedAoi, isFetching } = useQuery({
    queryKey: ["aoi", selectedAoiId],
    queryFn: () => endpoints.aoi(selectedAoiId).then((res) => res.data),
    enabled: Boolean(selectedAoiId)
  });

  const selectedAoiSummary = useMemo(
    () => aois.find((aoi) => String(aoi.id) === String(selectedAoiId)),
    [aois, selectedAoiId]
  );

  function updateSelectedAoi(aoiId) {
    const nextId = String(aoiId || "");
    setSelectedAoiId(nextId);
    if (nextId) localStorage.setItem(selectedAoiStorageKey, nextId);
    else localStorage.removeItem(selectedAoiStorageKey);
    window.dispatchEvent(new CustomEvent(selectedAoiEventName, { detail: { aoiId: nextId } }));
  }

  return {
    aois,
    isLoading,
    isFetching,
    selectedAoiId,
    selectedAoi,
    selectedAoiSummary,
    selectedAoiName: selectedAoi?.name || selectedAoiSummary?.name || "Selected area",
    selectedAoiGeometry: selectedAoi?.geometry || null,
    updateSelectedAoi
  };
}

export function matchDistrictForAoi(districtFeatures, selectedAoi, fallbackDistrictId = "") {
  if (!Array.isArray(districtFeatures) || !districtFeatures.length) return "";
  const selectedName = selectedAoi?.name?.toLowerCase();
  const exactMatch = selectedName
    ? districtFeatures.find((feature) => String(feature.properties?.name || "").toLowerCase() === selectedName)
    : null;
  if (exactMatch?.id) return exactMatch.id;
  if (fallbackDistrictId && districtFeatures.some((feature) => feature.id === fallbackDistrictId)) return fallbackDistrictId;
  return districtFeatures[0]?.id || "";
}
