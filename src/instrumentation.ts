/**
 * Runs once when the Node.js server starts (not in Edge).
 * Safe diagnostics only when JOBPROOF_EMAIL_DEBUG is set — never logs secrets.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const v = process.env.JOBPROOF_EMAIL_DEBUG?.trim().toLowerCase();
  const debug = v === "1" || v === "true" || v === "yes";
  if (!debug) return;

  const key = process.env.RESEND_API_KEY?.trim();
  const fromEnv = process.env.RESEND_FROM?.trim();
  const from = fromEnv || "Job Proof <hello@jobproof.ca>";

  console.log("[JobProof:Email] startup: email debug enabled (JOBPROOF_EMAIL_DEBUG)");
  console.log(`[JobProof:Email] startup: resendApiKeyPresent=${Boolean(key)}`);
  console.log(`[JobProof:Email] startup: resendApiKeyLength=${key ? key.length : 0}`);
  console.log(`[JobProof:Email] startup: resendFrom=${from}`);
  console.log(
    `[JobProof:Email] startup: resendFromSource=${fromEnv ? "RESEND_FROM env" : "fallback default"}`
  );
}
