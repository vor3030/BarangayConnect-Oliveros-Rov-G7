import { ArcElement, Chart, DoughnutController, Tooltip } from "chart.js";

Chart.register(ArcElement, DoughnutController, Tooltip);

export function mountAccountChart(reducedMotion) {
  const canvas = document.querySelector("[data-account-chart]");
  const wrapper = canvas.parentElement;
  const colors = getComputedStyle(document.documentElement);
  wrapper.hidden = false;

  const chart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Active", "Inactive"],
      datasets: [{
        data: [Number(canvas.dataset.active), Number(canvas.dataset.inactive)],
        backgroundColor: [
          colors.getPropertyValue("--bc-accent").trim(),
          colors.getPropertyValue("--bc-chart-secondary").trim(),
        ],
        borderColor: colors.getPropertyValue("--bc-surface").trim(),
        borderWidth: 2,
      }],
    },
    options: {
      cutout: "68%",
      maintainAspectRatio: false,
      animation: reducedMotion.matches ? false : { duration: 400 },
      plugins: { tooltip: { enabled: true } },
    },
  });
  canvas.dataset.chartReady = "true";

  reducedMotion.addEventListener("change", () => {
    chart.options.animation = reducedMotion.matches ? false : { duration: 400 };
    chart.update("none");
  });
}
