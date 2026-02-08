/**
 * ========================================================================
 * Trading Journal - Input Sanitization Utilities
 * ========================================================================
 * 
 * DOMPurify für sichere User-Eingaben.
 */

import DOMPurify from 'dompurify';

/**
 * Sanitisiert HTML-Inhalt und entfernt potenziell gefährliche Elemente
 */
export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitisiert Text und entfernt alle HTML-Tags
 */
export function sanitizeText(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitisiert eine URL
 */
export function sanitizeURL(dirty: string): string {
  const sanitized = DOMPurify.sanitize(dirty);
  // Prüfe auf erlaubte Protokolle
  if (sanitized.startsWith('http://') || sanitized.startsWith('https://')) {
    return sanitized;
  }
  return '';
}

/**
 * Sanitisiert ein Objekt mit String-Werten
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj };
  
  for (const key in sanitized) {
    const value = sanitized[key];
    if (typeof value === 'string') {
      (sanitized as Record<string, unknown>)[key] = sanitizeText(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      (sanitized as Record<string, unknown>)[key] = sanitizeObject(value as Record<string, unknown>);
    }
  }
  
  return sanitized;
}

/**
 * Escape für sichere Anzeige in Inputs
 */
export function escapeForDisplay(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Prüft ob ein String potenziell gefährlichen Code enthält
 */
export function containsMaliciousContent(text: string): boolean {
  const patterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i,
    /data:/i,
    /vbscript:/i,
  ];
  
  return patterns.some(pattern => pattern.test(text));
}

export default {
  sanitizeHTML,
  sanitizeText,
  sanitizeURL,
  sanitizeObject,
  escapeForDisplay,
  containsMaliciousContent,
};
