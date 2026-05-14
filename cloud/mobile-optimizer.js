const nativeMutationObserver = window.MutationObserver;

if (nativeMutationObserver && !window.__littleFoxMobileOptimizer) {
  window.__littleFoxMobileOptimizer = true;

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
}
