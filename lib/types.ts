export type Freshness = "current" | "review" | "outdated";
export type SourceType = "patient" | "document" | "provider";
export type Visibility = "emergency" | "private";
export type DocumentCategory = "lab" | "radiology" | "prescription" | "discharge" | "surgery" | "vaccination" | "visit" | "other";
export type PatientSex = "male" | "female" | "unspecified";
export type RelationshipToOwner = "self" | "child" | "caregiver" | "other";

export type TimelineEvent = {
  id: string;
  year: string | number;
  title: string;
  detail: string;
};

export type ConditionItem = {
  id: string;
  name: string;
  status: "active" | "inactive";
  diagnosedYear: string | number;
  source: SourceType;
  sourceDetail?: string;
  confirmedAt: string;
  freshness: Freshness;
  visibility?: Visibility;
};

export type MedicationScheduleDose = {
  id: string;
  time: string;
  dose: string;
  mealRelation: "any" | "before" | "with" | "after";
  note?: string;
};

export type MedicationSchedule = {
  enabled: boolean;
  days: "daily" | "selected";
  selectedDays?: number[];
  startDate?: string;
  endDate?: string;
  doses: MedicationScheduleDose[];
};

export type MedicationItem = {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  source: SourceType;
  sourceDetail?: string;
  confirmedAt: string;
  freshness: Freshness;
  visibility?: Visibility;
  schedule?: MedicationSchedule;
};

export type AllergyItem = {
  id: string;
  allergen: string;
  reaction: string;
  severity: "critical" | "moderate" | "mild";
  source: SourceType;
  sourceDetail?: string;
  confirmedAt: string;
  freshness: Freshness;
  visibility?: Visibility;
};

export type EmergencyContact = {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  visibility?: Visibility;
};

export type PatientDocument = {
  id: string;
  title: string;
  date: string;
  provider: string;
  fileKey?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  visibility?: Visibility;
  category?: DocumentCategory;
  notes?: string;
};

export type DeviceDisplaySettings = {
  basicInfo: boolean;
  emergencySummary: boolean;
  bloodType: boolean;
  allergies: boolean;
  conditions: boolean;
  medications: boolean;
  emergencyContact: boolean;
  documents: boolean;
};

export type LinkedDevice = {
  id: string;
  name: string;
  patientSlug: string;
  qrSlug: string;
  type: "bracelet" | "card" | "bagtag" | "travel";
  status: "active" | "deactivated";
  createdAt: string;
  lastScanned?: string;
  display: DeviceDisplaySettings;
};

export type PatientProfile = {
  slug: string;
  firstName: string;
  lastName: string;
  age: number;
  sex?: PatientSex;
  emergencySummary?: string;
  dateOfBirth?: string;
  bloodType: string;
  bloodTypeSource?: SourceType;
  photoColor: string;
  photoFileKey?: string;
  photoFileName?: string;
  photoEmergencyVisible?: boolean;
  photoUrl?: string;
  relationshipToOwner?: RelationshipToOwner;
  emergencyProfile: { completeness: number };
  recordCompleteness: number;
  lastConfirmation: string;
  linkedIds: number;
  allergies: AllergyItem[];
  conditions: ConditionItem[];
  medications: MedicationItem[];
  labResults: Array<{
    id: string;
    testName: string;
    value: string;
    unit?: string;
    status: "normal" | "abnormal";
    date: string;
    lab: string;
    documentId?: string;
  }>;
  radiology: Array<{
    id: string;
    type: string;
    bodyPart: string;
    date: string;
    finding: string;
    documentId?: string;
  }>;
  surgeries: Array<{ id: string; name: string; year: string | number; hospital?: string }>;
  vaccinations: Array<{ id: string; name: string; date: string; provider?: string }>;
  timeline: TimelineEvent[];
  emergencyContacts: EmergencyContact[];
  documents: PatientDocument[];
};

export type ClinicalSuggestionKind =
  | "condition"
  | "medication"
  | "allergy"
  | "lab"
  | "radiology"
  | "surgery"
  | "vaccination"
  | "note"
  | "document";

export type ClinicalSuggestionStatus = "pending" | "accepted" | "rejected";

export type ClinicalSuggestionAttachment = {
  fileKey: string;
  fileName: string;
  mimeType: string;
  size: number;
};

export type ClinicalSuggestion = {
  id: string;
  patientId: string;
  patientSlug: string;
  qrSlug?: string;
  kind: ClinicalSuggestionKind;
  status: ClinicalSuggestionStatus;
  payload: Record<string, string>;
  attachment?: ClinicalSuggestionAttachment | null;
  createdAt: string;
  reviewedAt?: string | null;
};


export type ShareScope = "emergency" | "summary" | "full";

export type TemporaryShare = {
  id: string;
  token: string;
  patientSlug: string;
  scope: ShareScope;
  expiresAt: string;
  revokedAt?: string | null;
  createdAt: string;
};
