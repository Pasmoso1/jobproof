export const PROJECT_BRIEF_CONFIDENCE_VALUES = [
  "confirmed",
  "likely",
  "needs_verification",
] as const;

export type ProjectBriefConfidence = (typeof PROJECT_BRIEF_CONFIDENCE_VALUES)[number];

export type ProjectBriefStatement = {
  text: string;
  confidence: ProjectBriefConfidence;
};

export type ProjectBriefSnapshot = {
  serviceRequested: ProjectBriefStatement;
  urgency: ProjectBriefStatement;
  projectStage: ProjectBriefStatement;
  preferredCompletionDate: ProjectBriefStatement | null;
  photosReceived: ProjectBriefStatement;
  interviewCompleted: ProjectBriefStatement;
  likelyScopeFit: ProjectBriefStatement;
};

export type ProjectBrief = {
  version: 1;
  overview: ProjectBriefStatement[];
  snapshot: ProjectBriefSnapshot;
  keyFacts: ProjectBriefStatement[];
  itemsToVerify: ProjectBriefStatement[];
  potentialRisks: ProjectBriefStatement[];
  risksNoneMessage: string | null;
  recommendedNextStep: ProjectBriefStatement;
  generatedAt: string;
};

export type ProjectBriefTrigger =
  | "submission"
  | "scope_update"
  | "interview_answer"
  | "interview_complete";

export function isProjectBriefConfidence(value: string): value is ProjectBriefConfidence {
  return (PROJECT_BRIEF_CONFIDENCE_VALUES as readonly string[]).includes(value);
}

export function parseProjectBrief(raw: unknown): ProjectBrief | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) return null;

  const overview = parseStatementList(obj.overview);
  const snapshot = parseSnapshot(obj.snapshot);
  const recommendedNextStep = parseStatement(obj.recommendedNextStep);

  if (!overview.length || !snapshot || !recommendedNextStep) return null;

  return {
    version: 1,
    overview,
    snapshot,
    keyFacts: parseStatementList(obj.keyFacts),
    itemsToVerify: parseStatementList(obj.itemsToVerify),
    potentialRisks: parseStatementList(obj.potentialRisks),
    risksNoneMessage:
      typeof obj.risksNoneMessage === "string" ? obj.risksNoneMessage.trim() || null : null,
    recommendedNextStep,
    generatedAt:
      typeof obj.generatedAt === "string" ? obj.generatedAt : new Date().toISOString(),
  };
}

function parseStatement(raw: unknown): ProjectBriefStatement | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const text = String(obj.text ?? "").trim();
  const confidence = String(obj.confidence ?? "").trim();
  if (!text || !isProjectBriefConfidence(confidence)) return null;
  return { text, confidence };
}

function parseStatementList(raw: unknown): ProjectBriefStatement[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseStatement).filter((s): s is ProjectBriefStatement => s !== null);
}

function parseSnapshot(raw: unknown): ProjectBriefSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const serviceRequested = parseStatement(obj.serviceRequested);
  const urgency = parseStatement(obj.urgency);
  const projectStage = parseStatement(obj.projectStage);
  const photosReceived = parseStatement(obj.photosReceived);
  const interviewCompleted = parseStatement(obj.interviewCompleted);
  const likelyScopeFit = parseStatement(obj.likelyScopeFit);
  if (
    !serviceRequested ||
    !urgency ||
    !projectStage ||
    !photosReceived ||
    !interviewCompleted ||
    !likelyScopeFit
  ) {
    return null;
  }
  const preferredCompletionDate = obj.preferredCompletionDate
    ? parseStatement(obj.preferredCompletionDate)
    : null;
  return {
    serviceRequested,
    urgency,
    projectStage,
    preferredCompletionDate,
    photosReceived,
    interviewCompleted,
    likelyScopeFit,
  };
}
