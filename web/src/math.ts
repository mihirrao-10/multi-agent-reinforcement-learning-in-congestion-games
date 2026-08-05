export async function renderMath(): Promise<void> {
  const { default: katex } = await import("katex");
  const elements = document.querySelectorAll<HTMLElement>("[data-math]");
  for (const element of elements) {
    const expression = element.dataset.math;
    if (!expression) continue;
    katex.render(expression, element, {
      displayMode: element.classList.contains("equation-display"),
      output: "htmlAndMathml",
      throwOnError: true,
      strict: "warn",
      trust: false,
    });
  }
}
