import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const MUTED = '#8b95a7';
const SYMBOLS = { PEN: 'S/ ', USD: '$' };

// Loaded only by the dashboard page; alpine:init fires once app.js starts Alpine.
document.addEventListener('alpine:init', () => {
  window.Alpine.data('dashboard', (summaries) => ({
    summaries,
    active: 0,
    get summary() {
      return this.summaries[this.active];
    },
    money(value, currency = 'PEN') {
      return (
        (SYMBOLS[currency] ?? `${currency} `) +
        value.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    },
    init() {
      const trend = new Chart(this.$refs.trend, {
        type: 'bar',
        data: {
          labels: [],
          datasets: [{ data: [], backgroundColor: '#e08a83', borderRadius: 3 }],
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: MUTED } },
            y: {
              grid: { color: 'rgba(139,149,167,0.15)' },
              ticks: { color: MUTED },
              border: { display: false },
            },
          },
        },
      });
      const renderTrend = () => {
        const daily = this.summary ? this.summary.daily : [];
        trend.data.labels = daily.map((_, index) => index + 1);
        trend.data.datasets[0].data = daily;
        trend.update();
      };
      renderTrend();
      this.$watch('active', renderTrend);

      const split = new Chart(this.$refs.split, {
        type: 'doughnut',
        data: {
          labels: [],
          datasets: [{ data: [], backgroundColor: [], borderWidth: 0 }],
        },
        options: {
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: { legend: { display: false } },
        },
      });
      const renderSplit = () => {
        const categories = this.summary ? this.summary.categories : [];
        split.data.labels = categories.map((category) => category.name);
        split.data.datasets[0].data = categories.map((category) => category.amount);
        split.data.datasets[0].backgroundColor = categories.map(
          (category) => category.color,
        );
        split.update();
      };
      renderSplit();
      this.$watch('active', renderSplit);
    },
  }));
});
