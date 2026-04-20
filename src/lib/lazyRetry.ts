/**
 * Wraps a dynamic import with one automatic page reload on chunk-load failure.
 * After deploys, browsers may have stale references to chunk hashes that no
 * longer exist on the server — this triggers a single reload to fetch the
 * fresh manifest, then gives up so the ErrorBoundary can show a real error.
 */
import { safeGetItem, safeSetItem } from "@/lib/storage";

const REFRESH_KEY = "meeet_retry_lazy_refreshed";

export function lazyRetry<T>(componentImport: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const hasRefreshed = safeGetItem(REFRESH_KEY) === "true";
    componentImport()
      .then((component) => {
        safeSetItem(REFRESH_KEY, "false");
        resolve(component);
      })
      .catch((error) => {
        if (!hasRefreshed) {
          safeSetItem(REFRESH_KEY, "true");
          window.location.reload();
          return;
        }
        reject(error);
      });
  });
}
