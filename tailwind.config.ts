import type { Config } from 'tailwindcss';

// 디자인 토큰은 globals.css의 CSS 변수를 단일 진실 원천으로 삼고, 여기서 매핑만 한다.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  // 프로토타입 CSS가 자체 리셋을 갖고 있으므로 Tailwind preflight를 끈다(디자인 보존).
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        'paper-2': 'var(--paper-2)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        mute: 'var(--mute)',
        line: 'var(--line)',
        hl: 'var(--hl)',
        'hl-soft': 'var(--hl-soft)',
        go: 'var(--go)',
        'go-soft': 'var(--go-soft)',
        warn: 'var(--warn)',
        'warn-soft': 'var(--warn-soft)',
        blue: 'var(--blue)',
      },
      fontFamily: {
        sans: 'var(--sans)',
        mono: 'var(--mono)',
      },
      borderRadius: {
        card: 'var(--r)',
      },
      maxWidth: {
        app: '520px',
      },
    },
  },
  plugins: [],
};

export default config;
