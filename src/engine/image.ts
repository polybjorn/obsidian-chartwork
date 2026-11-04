import type { Chart } from "chart.js";

/** The chart as a PNG on `background`, since a canvas is transparent wherever nothing is drawn. */
export function chartImage(chart: Chart, background: string): Promise<Blob> {
  // A native menu leaves the pointer on the chart as far as the page can
  // tell, so its tooltip and highlight would otherwise land in the image.
  // Stopping also finishes a chart still in its opening animation
  chart.setActiveElements([]);
  chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
  chart.stop();
  if (chart.tooltip) chart.tooltip.opacity = 0;
  chart.update("none");

  const flat = createEl("canvas");
  flat.width = chart.canvas.width;
  flat.height = chart.canvas.height;
  const context = flat.getContext("2d");
  if (!context) return Promise.reject(new Error("no canvas to draw the image on"));
  context.fillStyle = background;
  context.fillRect(0, 0, flat.width, flat.height);
  context.drawImage(chart.canvas, 0, 0);
  return new Promise((resolve, reject) => {
    flat.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("the chart gave no image"))), "image/png");
  });
}
