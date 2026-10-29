/**
 * A stand-in for Next's request (cookies and headers), so tests can call the
 * real server actions and page guards the way a browser would: each "browser"
 * is a cookie jar, and `as(browser)` makes the next calls come from it.
 */
type Jar = Map<string, string>;

let currentJar: Jar = new Map();
let currentHeaders: Record<string, string> = {};
let ipCounter = 1;

export function newBrowser(): { jar: Jar; ip: string } {
  ipCounter += 1;
  return { jar: new Map(), ip: `10.9.${Math.floor(ipCounter / 250)}.${ipCounter % 250}` };
}

export function as(browser: { jar: Jar; ip: string }, path = "/app") {
  currentJar = browser.jar;
  currentHeaders = { "user-agent": "vitest", "x-forwarded-for": browser.ip, "x-hzerp-path": path, host: "localhost:3000" };
}

export const nextHeadersMock = {
  cookies: async () => ({
    get: (name: string) => (currentJar.has(name) ? { name, value: currentJar.get(name)! } : undefined),
    has: (name: string) => currentJar.has(name),
    set: (name: string, value: string, options?: { maxAge?: number }) => {
      if (value === "" || options?.maxAge === 0) currentJar.delete(name);
      else currentJar.set(name, value);
    },
    delete: (name: string) => currentJar.delete(name),
  }),
  headers: async () => new Headers(currentHeaders),
};

/** Run something that should end in redirect() and return where it pointed. */
export async function redirectOf(work: () => Promise<unknown>): Promise<string | null> {
  try {
    await work();
    return null;
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT")) return digest.split(";")[2] ?? "";
    throw error;
  }
}

export async function isNotFound(work: () => Promise<unknown>): Promise<boolean> {
  try {
    await work();
    return false;
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? "";
    if (digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404")) return true;
    throw error;
  }
}
