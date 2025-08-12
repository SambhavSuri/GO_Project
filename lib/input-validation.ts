// Input validation utilities
export function handleValidatedInput(
  value: string,
  onValidText: (text: string) => void,
  onWarning?: (warning: string) => void
): void {
  // Check for potentially harmful patterns
  const scriptPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
  const htmlPattern = /<[^>]+>/g;
  const sqlPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|FROM|WHERE)\b)/gi;
  
  if (scriptPattern.test(value)) {
    if (onWarning) {
      onWarning('Script tags are not allowed');
    }
    // Strip script tags
    const cleanedValue = value.replace(scriptPattern, '');
    onValidText(cleanedValue);
    return;
  }
  
  if (htmlPattern.test(value)) {
    if (onWarning) {
      onWarning('HTML tags are not allowed');
    }
    // Strip HTML tags
    const cleanedValue = value.replace(htmlPattern, '');
    onValidText(cleanedValue);
    return;
  }
  
  if (sqlPattern.test(value)) {
    if (onWarning) {
      onWarning('SQL keywords detected and removed');
    }
    // Remove SQL keywords
    const cleanedValue = value.replace(sqlPattern, '');
    onValidText(cleanedValue);
    return;
  }
  
  // If no issues, pass through
  onValidText(value);
}