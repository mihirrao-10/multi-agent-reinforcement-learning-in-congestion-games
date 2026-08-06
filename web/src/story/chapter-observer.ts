export class ChapterObserver {
  private readonly chapters: HTMLElement[];
  private readonly activate: (chapter: number) => void;
  private frame = 0;
  private active = -1;

  constructor(chapters: HTMLElement[], activate: (chapter: number) => void) {
    this.chapters = chapters;
    this.activate = activate;
    window.addEventListener("scroll", this.requestUpdate, { passive: true });
    window.addEventListener("resize", this.requestUpdate, { passive: true });
    this.update();
  }

  destroy(): void {
    window.removeEventListener("scroll", this.requestUpdate);
    window.removeEventListener("resize", this.requestUpdate);
    if (this.frame) cancelAnimationFrame(this.frame);
  }

  refresh(): void {
    this.requestUpdate();
  }

  private readonly requestUpdate = (): void => {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.update();
    });
  };

  private update(): void {
    const mobile = window.matchMedia("(max-width: 560px)").matches;
    const target = window.innerHeight * (mobile ? 0.45 : 0.52);
    const unlocked = this.chapters.filter((chapter) => !chapter.hidden);
    let nearest = unlocked[0];
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const chapter of unlocked) {
      const rectangle = chapter.getBoundingClientRect();
      const distance =
        rectangle.top <= target && rectangle.bottom >= target
          ? 0
          : Math.min(
              Math.abs(rectangle.top - target),
              Math.abs(rectangle.bottom - target),
            );
      if (distance < nearestDistance) {
        nearest = chapter;
        nearestDistance = distance;
      }
    }
    const act = Number(nearest?.dataset.storyAct ?? 0);
    if (act !== this.active) {
      this.active = act;
      unlocked.forEach((chapter) =>
        chapter.classList.toggle(
          "is-active",
          Number(chapter.dataset.storyAct) === act,
        ),
      );
      this.activate(act);
    }
  }
}
