const nubaColors = {
  'nuba-bg': '#0B0F14',
  'nuba-surface': '#121821',
  'nuba-surface-elevated': '#1A2330',
  'nuba-text': '#E6EDF3',
  'nuba-text-muted': '#9FB0C3',
  'nuba-border': '#2A3545',
  'nuba-brand': '#7C9EFF',
  'nuba-check-in': '#5BE7A9',
  'nuba-check-out': '#FF7A7A',
  'nuba-break': '#FFD166',
  'nuba-overtime': '#B388FF',
  'nuba-error': '#FF5C8A',
  'nuba-success': '#4ADE80',
}

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: nubaColors,
      boxShadow: {
        nuba: '0 24px 64px -32px rgb(11 15 20 / 0.82)',
        'nuba-elevated': '0 32px 72px -36px rgb(11 15 20 / 0.92)',
      },
    },
  },
  plugins: [],
}
