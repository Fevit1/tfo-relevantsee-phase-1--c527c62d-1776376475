/**
 * htmlEscape.js — Server-side HTML and XML escaping utilities.
 * Used to prevent XSS in outbound email HTML and prompt injection in Claude prompts.
 */

/**
 * Escapes HTML special characters in a string.
 * Safe to call on null/undefined — returns empty string.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Escapes XML special characters in a string.
 * Used when interpolating user-controlled values into XML-delimited Claude prompts
 * to prevent prompt injection via structural XML manipulation.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeXml(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}