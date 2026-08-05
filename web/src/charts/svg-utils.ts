const SVG_NS = "http://www.w3.org/2000/svg";
let chartIdentifier = 0;

export function svgElement<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes))
    element.setAttribute(key, String(value));
  return element;
}

export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): (value: number) => number {
  if (domain[0] === domain[1]) return () => (range[0] + range[1]) / 2;
  const factor = (range[1] - range[0]) / (domain[1] - domain[0]);
  return (value: number) => range[0] + (value - domain[0]) * factor;
}

export function linePath(
  points: readonly { readonly x: number; readonly y: number }[],
): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`,
    )
    .join(" ");
}

export function appendTitleAndDescription(
  svg: SVGSVGElement,
  title: string,
  description: string,
): void {
  chartIdentifier += 1;
  const titleId = `chart-title-${chartIdentifier}`;
  const descriptionId = `chart-description-${chartIdentifier}`;
  const titleElement = svgElement("title", { id: titleId });
  titleElement.textContent = title;
  const descriptionElement = svgElement("desc", { id: descriptionId });
  descriptionElement.textContent = description;
  svg.prepend(descriptionElement);
  svg.prepend(titleElement);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-labelledby", `${titleId} ${descriptionId}`);
}
