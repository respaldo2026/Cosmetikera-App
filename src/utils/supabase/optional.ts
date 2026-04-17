type SupabaseQueryError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
};

const RELATION_MISSING_PATTERNS = [
  /relation .* does not exist/i,
  /schema cache/i,
  /could not find the table/i,
  /could not find .* in the schema cache/i,
];

export const isMissingSupabaseRelationError = (error?: SupabaseQueryError | null): boolean => {
  if (!error) return false;

  const combined = [error.message, error.details, error.hint].filter(Boolean).join(" ");

  return (
    error.status === 404 ||
    error.code === "PGRST205" ||
    RELATION_MISSING_PATTERNS.some((pattern) => pattern.test(combined))
  );
};