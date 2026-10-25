import { SEVERITIES } from "../constants/incident";

export function sortIncidents(list, sortBy) {
  return [...list].sort((a, b) => {
    const rankA = SEVERITIES[a.severity]?.rank || 0;
    const rankB = SEVERITIES[b.severity]?.rank || 0;
    const timeA = a.createdAt || 0;
    const timeB = b.createdAt || 0;

    if (sortBy === "severity_desc" && rankA !== rankB) return rankB - rankA;
    if (sortBy === "severity_asc" && rankA !== rankB) return rankA - rankB;
    if (sortBy === "oldest") return timeA - timeB;
    return timeB - timeA;
  });
}