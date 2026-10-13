import type { DeviceDisplaySettings } from "@/lib/types";

// Emergency information must only be published after the owner opts in.
export const defaultDisplaySettings: DeviceDisplaySettings = {
  basicInfo: false,
  emergencySummary: false,
  bloodType: false,
  allergies: false,
  conditions: false,
  medications: false,
  emergencyContact: false,
  documents: false,
};
