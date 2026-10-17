"use client";

import { useEffect, useState } from "react";
import { defaultDisplaySettings } from "@/lib/defaultDeviceDisplay";
import type { LinkedDevice } from "@/lib/types";
import { addActivity } from "@/lib/store";
import { upsertCloudDevice } from "@/lib/cloud/repository";

const KEY = "vital-id-linked-devices-v3";
const IDENTITY = "vital-id-current-device-user";
const currentIdentity = () => typeof window !== "undefined" ? sessionStorage.getItem(IDENTITY) : null;
const stateKey = () => currentIdentity() ? `vital-id-private-devices:${currentIdentity()}` : KEY;
const stateStorage = () => currentIdentity() ? sessionStorage : localStorage;
export function switchDeviceIdentity(userId: string | null) {
  if (typeof window === "undefined") return false;
  const old = currentIdentity();
  if (old === userId) return false;
  if (old) sessionStorage.removeItem(`vital-id-private-devices:${old}`);
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(IDENTITY);
  if (userId) sessionStorage.setItem(IDENTITY, userId);
  window.dispatchEvent(new CustomEvent(EVENT));
  return true;
}
const EVENT = "vital-id-device-state-changed";
const hasWindow = () => typeof window !== "undefined";
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function normalize(device: LinkedDevice): LinkedDevice {
  return {
    ...device,
    display: { ...defaultDisplaySettings, ...(device.display ?? {}) },
  };
}

function seeded(): LinkedDevice[] { return []; }

export function readDevices(): LinkedDevice[] {
  if (!hasWindow()) return seeded();
  try {
    const raw = stateStorage().getItem(stateKey());
    if (!raw) {
      const initial = seeded();
      stateStorage().setItem(stateKey(), JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as LinkedDevice[];
    const cleaned = Array.isArray(parsed) ? parsed.filter((d) => d && typeof d.qrSlug === "string" && !d.qrSlug.includes("-demo-")).map(normalize) : [];
    if (Array.isArray(parsed) && cleaned.length !== parsed.length) stateStorage().setItem(stateKey(), JSON.stringify(cleaned));
    return cleaned;
  } catch {
    return seeded();
  }
}

export function writeDevices(devices: LinkedDevice[]) {
  if (!hasWindow()) return;
  stateStorage().setItem(stateKey(), JSON.stringify(devices.map(normalize)));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function getDeviceByQrSlug(qrSlug: string) {
  return readDevices().find((d) => d.qrSlug === qrSlug) ?? null;
}

export function getPrimaryDevice(patientSlug: string) {
  return readDevices().find((d) => d.patientSlug === patientSlug && d.status === "active") ?? null;
}

export function saveDevice(device: LinkedDevice, syncCloud = true) {
  const all = readDevices();
  const normalized = normalize(device);
  const exists = all.some((d) => d.id === device.id);
  writeDevices(exists ? all.map((d) => d.id === device.id ? normalized : d) : [normalized, ...all]);
  if (syncCloud) void upsertCloudDevice(normalized).catch(() => {});
}

export function updateDevice(id: string, updater: (device: LinkedDevice) => LinkedDevice) {
  const all = readDevices();
  const current = all.find((d) => d.id === id);
  if (!current) return null;
  const next = normalize(updater(clone(current)));
  writeDevices(all.map((d) => d.id === id ? next : d));
  void upsertCloudDevice(next).catch(() => {});
  return next;
}

export function setDeviceStatus(id: string, status: "active" | "deactivated") {
  const next = updateDevice(id, (device) => ({ ...device, status }));
  if (next) addActivity({ type: "update", title: `Device ${status}`, detail: next.name });
  return next;
}

export function createDevice(patientSlug: string, name: string, type: LinkedDevice["type"] = "card") {
  const device: LinkedDevice = {
    id: crypto.randomUUID(),
    name: name.trim() || "Medical ID",
    patientSlug,
    qrSlug: `qr-${crypto.randomUUID().replace(/-/g, "")}`,
    type,
    status: "active",
    createdAt: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    display: { ...defaultDisplaySettings },
  };
  saveDevice(device);
  addActivity({ type: "update", title: "Medical ID created", detail: device.name });
  return device;
}

export function regenerateQr(id: string) {
  const next = updateDevice(id, (device) => ({ ...device, qrSlug: `qr-${crypto.randomUUID().replace(/-/g, "")}` }));
  if (next) addActivity({ type: "update", title: "QR link regenerated", detail: next.name });
  return next;
}

export function markDeviceScanned(qrSlug: string) {
  const next = updateDeviceByQr(qrSlug, (device) => ({ ...device, lastScanned: new Date().toISOString() }));
  return next;
}

export function updateDeviceByQr(qrSlug: string, updater: (device: LinkedDevice) => LinkedDevice) {
  const all = readDevices();
  const current = all.find((d) => d.qrSlug === qrSlug);
  if (!current) return null;
  const next = normalize(updater(clone(current)));
  writeDevices(all.map((d) => d.id === current.id ? next : d));
  void upsertCloudDevice(next).catch(() => {});
  return next;
}

export function resetDevices() {
  if (!hasWindow()) return;
  stateStorage().removeItem(stateKey());
  writeDevices(seeded());
}

export function useDevices() {
  const [devices, setDevices] = useState<LinkedDevice[]>([]);
  useEffect(() => {
    const refresh = () => setDevices(readDevices());
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return devices;
}

export function hydrateDevicesFromCloud(devices: LinkedDevice[]) {
  writeDevices(devices.filter(d => !d.qrSlug.includes("-demo-")).map(normalize));
}
