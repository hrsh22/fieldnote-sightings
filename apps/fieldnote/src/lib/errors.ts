import { ZodError } from "zod";

export class FieldnoteError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "FieldnoteError";
  }
}
export function explainError(error: unknown): string {
  if (error instanceof FieldnoteError) return error.message;
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const labels: Record<string, string> = {
      species: "species",
      observed: "observation date and time",
      place: "location",
      observer: "observer name",
      photo: "photograph",
      count: "bird count",
      notes: "field notes",
    };
    const field = labels[String(issue?.path[0])] ?? "sighting details";
    return `Check the ${field}. ${issue?.message ?? "A required value is missing or invalid."}`;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/timeout|timed out|abort/i.test(message))
    return "The storage network took too long to respond. Your draft is still here. Check your connection and try again.";
  if (/failed to fetch|network|fetch failed/i.test(message))
    return "The storage gateway could not be reached. Check your internet connection, then retry. Your draft has not been discarded.";
  if (/popup/i.test(message))
    return "The sign-in window was blocked. Allow popups for Fieldnote and click Sign in again.";
  if (/auth|not connected|app signer|app secret/i.test(message))
    return "Your sign-in session ended. Sign in again to save this sighting.";
  if (/429|rate.limit/i.test(message))
    return "The shared storage gateway is busy. Wait a moment, then try again.";
  if (/404|not found/i.test(message))
    return "This notebook or one of its records is not available from the gateway. Retry shortly or use another reader gateway.";
  if (/stamp|batch/i.test(message))
    return "Storage postage is currently unavailable. Reconnect with the default gateway, or check your own drive in Swarm ID.";
  return message.length < 240
    ? message
    : "This record could not be processed. Retry, or check its format in the independent reader.";
}
