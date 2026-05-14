const nativeMutationObserver = window.MutationObserver;

if (nativeMutationObserver && !window.__littleFoxMobileOptimizer) {
  window.__littleFoxMobileOptimizer = true;
  const nativeFetch = window.fetch.bind(window);

  window.MutationObserver = class LittleFoxMutationObserver extends nativeMutationObserver {
    constructor(callback) {
      let scheduled = false;
      let latestMutations = [];
      let lastRun = 0;

      super((mutations, observer) => {
        latestMutations = mutations;
        if (scheduled) return;

        const elapsed = performance.now() - lastRun;
        const delay = Math.max(80, 220 - elapsed);
        scheduled = true;

        window.setTimeout(() => {
          scheduled = false;
          lastRun = performance.now();
          callback(latestMutations, observer);
        }, delay);
      });
    }
  };

  function limitSupabaseRead(input) {
    const rawUrl = typeof input === "string" ? input : input?.url;
    if (!rawUrl) return input;

    let url;
    try {
      url = new URL(rawUrl, window.location.href);
    } catch {
      return input;
    }

    if (!url.hostname.includes("supabase.co") || !url.pathname.includes("/rest/v1/")) return input;
    if (url.searchParams.has("limit")) return input;

    const table = url.pathname.split("/rest/v1/")[1]?.split("/")[0];
    const limits = {
      logs: "350",
      diapers: "400",
      expenses: "200",
      messages: "50",
      diaper_suggestions: "80",
      public_posts: "25"
    };
    if (!limits[table]) return input;

    url.searchParams.set("limit", limits[table]);
    return typeof input === "string" ? url.toString() : new Request(url.toString(), input);
  }

  window.fetch = (input, init) => nativeFetch(limitSupabaseRead(input), init);
}
