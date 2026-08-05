import "./style.css";

import { loadStoryData } from "./data/story-data";
import { NetworkFallback } from "./fallback";
import { renderMath } from "./math";
import { SceneController } from "./scene/scene-controller";
import { StoryController } from "./story/story-controller";

async function start(): Promise<void> {
  const canvas =
    document.querySelector<HTMLCanvasElement>("#congestion-canvas");
  const labelContainer =
    document.querySelector<HTMLElement>("#projected-labels");
  const fallbackContainer =
    document.querySelector<HTMLElement>("#webgl-fallback");
  const loading = document.querySelector<HTMLElement>("#loading");
  if (!canvas || !labelContainer || !fallbackContainer || !loading) {
    throw new Error("the story shell is incomplete");
  }
  const reducedMotionQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  const story = await loadStoryData();
  await renderMath();
  const forceFallback =
    new URLSearchParams(window.location.search).get("forceFallback") === "1";
  let scene: SceneController | null = null;
  let fallback: NetworkFallback | null = null;
  let controller: StoryController | null = null;
  if (!forceFallback) {
    try {
      scene = new SceneController(
        canvas,
        labelContainer,
        story,
        reducedMotionQuery.matches,
        {
          onExploreChange: (exploring) => controller?.syncExplore(exploring),
          onManualInteraction: () => controller?.markManualInteraction(),
          onEscape: () => controller?.exitExplore(),
        },
      );
      document.body.dataset.webgl = "active";
    } catch (error) {
      console.warn(
        "WebGL initialization failed; using the native SVG fallback.",
        error,
      );
    }
  }
  if (!scene) {
    canvas.hidden = true;
    labelContainer.hidden = true;
    fallback = new NetworkFallback(fallbackContainer);
    document.body.dataset.webgl = "fallback";
  }
  controller = new StoryController({
    story,
    scene,
    fallback,
    reducedMotion: reducedMotionQuery.matches,
  });
  const handleReducedMotion = (event: MediaQueryListEvent): void =>
    controller?.setReducedMotion(event.matches);
  reducedMotionQuery.addEventListener("change", handleReducedMotion);
  document.body.dataset.storyReady = "true";
  loading.classList.add("is-complete");
  window.setTimeout(() => loading.remove(), 350);
  window.addEventListener(
    "beforeunload",
    () => {
      controller?.dispose();
      scene?.dispose();
      reducedMotionQuery.removeEventListener("change", handleReducedMotion);
    },
    { once: true },
  );
}

void start().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "unknown validation error";
  const loading = document.querySelector<HTMLElement>("#loading");
  if (loading)
    loading.textContent = `The exact data could not be validated. The mathematical text remains available. ${message}`;
  const canvas =
    document.querySelector<HTMLCanvasElement>("#congestion-canvas");
  if (canvas) canvas.hidden = true;
  document.body.dataset.storyReady = "error";
  document.body.dataset.webgl = "fallback";
});
