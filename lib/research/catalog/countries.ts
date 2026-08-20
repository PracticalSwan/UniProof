import { z } from "zod";

export const researchCatalogCountryCodes = [
  "BE",
  "CA",
  "DE",
  "DK",
  "FI",
  "GB",
  "IT",
  "NL",
  "SE",
  "TH",
  "US",
] as const;

export type ResearchCatalogCountryCode = typeof researchCatalogCountryCodes[number];

export const researchCatalogCountryCodeSchema = z.enum(researchCatalogCountryCodes);

export const researchCatalogCountryLabels: Readonly<Record<ResearchCatalogCountryCode, string>> = {
  BE: "Belgium",
  CA: "Canada",
  DE: "Germany",
  DK: "Denmark",
  FI: "Finland",
  GB: "United Kingdom",
  IT: "Italy",
  NL: "Netherlands",
  SE: "Sweden",
  TH: "Thailand",
  US: "United States",
};
