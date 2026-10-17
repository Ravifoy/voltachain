"use client";
// Leaflet map (free OpenStreetMap tiles, darkened with CSS). Loaded only in the browser.
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { BatteryFull } from "@/lib/chain";
import { gradeColor, priceLabel } from "@/lib/config";

/** One glowing pin per battery, coloured by grade. Popup links to the detail page. */
export default function BatteryMap({ items }: { items: BatteryFull[] }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { scrollWheelZoom: false }).setView([22.5, 79], 5);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors", maxZoom: 18,
      className: "dark-tiles", // CSS filter in globals.css turns the light map dark
    }).addTo(map);

    const pts: [number, number][] = [];
    items.forEach((it) => {
      if (!it.location) return;
      const r = it.reports[it.reports.length - 1];
      const color = r ? gradeColor(r.grade) : "#8fa89a";
      // tiny deterministic offset so batteries in the same city do not hide each other
      const k = it.battery.tokenId;
      const pos: [number, number] = [it.location.lat + ((k % 5) - 2) * 0.012, it.location.lng + ((k % 3) - 1) * 0.012];
      pts.push(pos);
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #0a0f0d;box-shadow:0 0 14px ${color};display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font:700 13px Orbitron,sans-serif;color:#0a0f0d">${r ? r.grade : "?"}</span></div>`,
        iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -32],
      });
      const price = it.listing.active ? `<div style="color:#ffd60a;font-weight:700;margin-top:4px">${priceLabel(it.listing.price)}</div>` : "";
      L.marker(pos, { icon }).addTo(map).bindPopup(
        `<div style="font-family:Inter,sans-serif;min-width:170px"><b>${it.battery.batteryType}</b><br><span style="font-size:11px;opacity:.7">${it.battery.serialNumber}</span><br>` +
        `${r ? `Health <b>${r.sohPercent}%</b> · Grade <b>${r.grade}</b>` : "No report"}<br>📍 ${it.location.city}${price}` +
        `<br><a href="/battery/${it.battery.tokenId}" style="color:#00a35a;font-weight:700">View details →</a></div>`,
      );
    });
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 9 });
    return () => { map.remove(); };
  }, [items]);

  return <div ref={el} className="h-[480px] w-full overflow-hidden rounded-2xl border border-line shadow-glowSm" />;
}
