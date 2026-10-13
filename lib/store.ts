"use client";

import { getActiveSlug } from "@/lib/patientStore";
import { insertCloudActivity } from "@/lib/cloud/repository";

export type ActivityItem = { id:string; type:"scan"|"access"|"update"; title:string; detail:string; time:string; date:string };
export type ScanItem = { id:string; at:string; slug:string };

const A="vital-id-activity", S="vital-id-scans", DS="vital-id-doctor-session";
const hasWindow = () => typeof window !== "undefined";
const read = <T,>(key:string, fallback:T):T => { if(!hasWindow()) return fallback; try { const v=localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const write = (key:string, value:unknown) => { if(hasWindow()) localStorage.setItem(key, JSON.stringify(value)); };

export const formatTime = (v:string|number|Date) => new Date(v).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
export const formatDate = (v:string|number|Date) => new Date(v).toLocaleDateString([], {day:"2-digit", month:"short", year:"numeric"});
export function clearPrivateActivity() {
  if (!hasWindow()) return;
  [A,S,DS].forEach(k=>localStorage.removeItem(k));
}
export const getActivity = () => {
  const rows = read<ActivityItem[]>(A, []);
  if (!Array.isArray(rows)) return [];
  const cleaned = rows.filter(row => row && !/demo-(?:001|child-001)/.test(row.detail ?? "") && row.title !== "Healthcare access granted");
  if (cleaned.length !== rows.length) write(A, cleaned);
  return cleaned;
};
export const replaceActivity = (items: ActivityItem[]) => write(A, items);
export const getScans = () => {
  const rows = read<ScanItem[]>(S, []);
  if (!Array.isArray(rows)) return [];
  const cleaned = rows.filter(row => row && !String(row.slug).includes("-demo-") && row.slug !== "demo-001");
  if (cleaned.length !== rows.length) write(S, cleaned);
  return cleaned;
};
export function addActivity(input: Omit<ActivityItem,"id"|"time"|"date"> & Partial<Pick<ActivityItem,"id"|"time"|"date">>) {
  const now = new Date();
  const item: ActivityItem = { id:input.id ?? crypto.randomUUID(), type:input.type, title:input.title, detail:input.detail, time:input.time ?? formatTime(now), date:input.date ?? formatDate(now) };
  write(A, [item, ...getActivity()]);
  void insertCloudActivity(item.type, item.title, item.detail, getActiveSlug()).catch(() => {});
  return item;
}
export function recordScan(slug:string) {
  const scans=getScans(); const last=scans[0]; const now=Date.now();
  if(last && last.slug===slug && now-new Date(last.at).getTime()<30000) return;
  write(S,[{id:crypto.randomUUID(), at:new Date(now).toISOString(), slug},...scans]);
  addActivity({type:"scan",title:"Medical ID scanned",detail:slug});
}
