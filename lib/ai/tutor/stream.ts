export type TutorStatusPhase = 
  | "working"
  | "checking_calculation"
  | "checking_units"
  | "checking_grounding"
  | "repairing"
  | "finalizing";

export type TutorStatusPart = {
  type: "data-tutor-status";
  data: {
    phase: TutorStatusPhase;
    label: string;
  };
};

export type CitationPart = {
  type: "data-citation";
  data: {
    citationId: string;
    label: string;
    page?: number;
    section?: string;
    excerpt?: string;
  };
};

export type VerificationPart = {
  type: "data-verification";
  data: {
    verified: boolean;
    checks: {
      calculation?: boolean;
      symbolic?: boolean;
      units?: boolean;
      dimensionality?: boolean;
      grounding?: boolean;
      consistency?: boolean;
      completeness?: boolean;
    };
  };
};

export type MedeaStreamPart = 
  | TutorStatusPart
  | CitationPart
  | VerificationPart;

export function formatStreamPart(part: MedeaStreamPart) {
  return part;
}
