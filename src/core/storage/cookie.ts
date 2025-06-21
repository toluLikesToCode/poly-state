import { StorageError } from "../../shared/errors";

/**
 * Cookie options interface for type safety
 */
export interface CookieOptions {
  /** Expiration in days or as Date object */
  expires?: number | Date;
  /** Cookie path */
  path?: string;
  /** Cookie domain */
  domain?: string;
  /** Secure flag */
  secure?: boolean;
  /** SameSite attribute */
  sameSite?: "Strict" | "Lax" | "None";
}

/**
 * Sets a cookie with optional attributes.
 */
export function setCookie(
  name: string,
  value: string,
  options?: CookieOptions
): void {
  try {
    let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

    if (options) {
      if (options.expires) {
        const expires =
          typeof options.expires === "number"
            ? new Date(Date.now() + options.expires * 864e5)
            : options.expires;
        cookieStr += `; expires=${expires.toUTCString()}`;
      }
      if (options.path) cookieStr += `; path=${options.path}`;
      if (options.domain) cookieStr += `; domain=${options.domain}`;
      if (options.secure) cookieStr += `; secure`;
      if (options.sameSite) cookieStr += `; samesite=${options.sameSite}`;
    }

    document.cookie = cookieStr;
  } catch (error) {
    console.warn("Failed to set cookie", {
      operation: "set cookie",
      name,
      error,
    });
    throw new StorageError(
      `Failed to set cookie '${name}'`,
      "setCookie",
      name,
      error
    );
  }
}

/**
 * Gets a cookie value by name.
 */
export function getCookie(name: string): string | undefined {
  try {
    if (!document.cookie) return undefined;

    const cookies = document.cookie.split("; ");
    for (const cookie of cookies) {
      const [k, v] = cookie.split("=");
      if (decodeURIComponent(k) === name) {
        return decodeURIComponent(v || "");
      }
    }
  } catch (error) {
    console.warn("Failed to get cookie", {
      operation: "get cookie",
      name,
      error,
    });
  }
  return undefined;
}

/**
 * Removes a cookie by name.
 */
export function removeCookie(name: string, path: string = "/"): void {
  setCookie(name, "", { expires: -1, path });
}
