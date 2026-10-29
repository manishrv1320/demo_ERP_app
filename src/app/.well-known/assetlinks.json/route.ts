/**
 * Android App Links. Lists the SHA-256 fingerprints of the Play app-signing key
 * (and the upload key, for testing) from ANDROID_SHA256_FINGERPRINTS in the
 * server's app.env — comma-separated, set in Phase 7 once Play App Signing is on.
 * Fingerprints are public; they identify the app, they don't unlock anything.
 */
export const dynamic = "force-dynamic";

const PACKAGE_NAME = process.env.ANDROID_PACKAGE_NAME || "in.hyperzen.erp";

export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value));

  const body = fingerprints.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: { namespace: "android_app", package_name: PACKAGE_NAME, sha256_cert_fingerprints: fingerprints },
        },
      ]
    : [];

  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
