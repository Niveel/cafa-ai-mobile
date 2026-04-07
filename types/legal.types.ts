export type LegalList = {
  kind: 'unordered' | 'ordered';
  items: string[];
};

export type LegalSection = {
  id: string;
  heading: string;
  paragraphs?: string[];
  lists?: LegalList[];
};

export type LegalDocument = {
  title: string;
  lastUpdated: string;
  intro?: string[];
  sections: LegalSection[];
};

