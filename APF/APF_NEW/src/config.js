export const LANGUAGES = [
  { id: "de", label: "DE" },
  { id: "fr", label: "FR" },
  { id: "en", label: "EN" },
  { id: "it", label: "IT" },
  { id: "pl", label: "PL" }
];

export const BU_OPTIONS = [
  { id: "fr", label: "BU FR", name: "France" },
  { id: "it", label: "BU IT", name: "Italy" },
  { id: "pl", label: "BU PL", name: "Poland" },
  { id: "ua", label: "BU UA", name: "Ukraine" },
  { id: "hr", label: "BU HR", name: "Croatia" },
  { id: "si", label: "BU SI", name: "Slovenia" },
  { id: "lt", label: "BU LT", name: "Lithuania" },
  { id: "ib", label: "BU IB", name: "Iberia" }
];

export const MAP_LINKS = [
  { id: "fr", top: "69%", left: "29%" },
  { id: "it", top: "83%", left: "50%" },
  { id: "pl", top: "54%", left: "62%" },
  { id: "ua", top: "59%", left: "82%" },
  { id: "hr", top: "75%", left: "57%" },
  { id: "si", top: "72%", left: "54.5%" },
  { id: "lt", top: "41%", left: "68.5%" },
  { id: "ib", top: "79%", left: "16%" }
];

export const SECTION_ORDER = [
  "annonces",
  "scans",
  "annoncesCarrierIod",
  "extractions",
  "refclients",
  "extractionAnnonceCarrier",
  "integration",
  "collas",
  "integrationIodCarrier",
  "impression",
  "saisie1SAP2MGlots",
  "saisie2MGlots2SAP",
  "crIntgSaisie1SAP2MGlots",
  "crIntgSaisie2MGlots2SAP"
];

export const SIDEBAR_GROUPS = [
  {
    type: "group",
    titleKey: "productionFiles",
    sections: [
      {
        headingKey: "reception",
        items: ["annonces", "scans", "annoncesCarrierIod"]
      },
      {
        headingKey: "emission",
        items: ["extractions", "refclients", "extractionAnnonceCarrier"]
      }
    ]
  },
  {
    type: "list",
    titleKey: "integrationReports",
    items: ["integration", "collas", "integrationIodCarrier"]
  },
  {
    type: "single",
    titleKey: "printDocuments",
    item: "impression"
  },
  {
    type: "group",
    titleKey: "mgLotsSap",
    sections: [
      {
        headingKey: "interfaceFiles",
        items: ["saisie1SAP2MGlots", "saisie2MGlots2SAP"]
      },
      {
        headingKey: "integrationLogs",
        items: ["crIntgSaisie1SAP2MGlots", "crIntgSaisie2MGlots2SAP"]
      }
    ]
  }
];

export const SECTION_META = {
  annonces: { labelKey: "annonces", showsBackup: true },
  scans: { labelKey: "scans", showsBackup: false },
  annoncesCarrierIod: { labelKey: "annoncesCarrierIod", showsBackup: true },
  extractions: { labelKey: "extractions", showsBackup: false },
  refclients: { labelKey: "refclients", showsBackup: false },
  extractionAnnonceCarrier: {
    labelKey: "extractionAnnonceCarrier",
    showsBackup: false
  },
  integration: { labelKey: "integration", showsBackup: false },
  collas: { labelKey: "collas", showsBackup: false },
  integrationIodCarrier: {
    labelKey: "integrationIodCarrier",
    showsBackup: false
  },
  impression: { labelKey: "impression", showsBackup: false },
  saisie1SAP2MGlots: { labelKey: "saisie1SAP2MGlots", showsBackup: false },
  saisie2MGlots2SAP: { labelKey: "saisie2MGlots2SAP", showsBackup: false },
  crIntgSaisie1SAP2MGlots: {
    labelKey: "crIntgSaisie1SAP2MGlots",
    showsBackup: false
  },
  crIntgSaisie2MGlots2SAP: {
    labelKey: "crIntgSaisie2MGlots2SAP",
    showsBackup: false
  }
};

export const LEGACY_TYPE_MAP = {
  annonces: "annonces",
  scans: "scans",
  annoncescarrieriod: "annoncesCarrierIod",
  extractions: "extractions",
  refclients: "refclients",
  extractionannoncecarrier: "extractionAnnonceCarrier",
  integration: "integration",
  collas: "collas",
  integrationiodcarrier: "integrationIodCarrier",
  impression: "impression",
  saisie1sap2mglots: "saisie1SAP2MGlots",
  crintgsaisie1sap2mglots: "crIntgSaisie1SAP2MGlots",
  saisie2mglots2sap: "saisie2MGlots2SAP",
  crintgsaisie2mglots2sap: "crIntgSaisie2MGlots2SAP"
};
