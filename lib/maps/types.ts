export type AnalysisStatus =
  | "pending"
  | "finding_website"
  | "website_found"
  | "analyzing"
  | "completed"
  | "failed"
  | "no_website"
  | "access_denied";

export type MapsCompany = {
  id: string;
  placeId?: string;
  companyName: string;
  address?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  googleMapsUrl?: string;
  websiteUrl?: string;
  websiteShared?: boolean;
  status: AnalysisStatus;
  progress?: number;
  result?: unknown;
  error?: string;
};

export type MapsListing = {
  placeId: string;
  companyName: string;
  address?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  googleMapsUrl?: string;
};
