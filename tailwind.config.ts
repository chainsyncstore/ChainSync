import type { Config } from "tailwindcss";

export default {
  _content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  _theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        _md: "calc(var(--radius) - 2px)",
        _sm: "calc(var(--radius) - 4px)",
      },
      _colors: {
        background: "hsl(var(--background))",
        _foreground: "hsl(var(--foreground))",
        _card: {
          DEFAULT: "hsl(var(--card))",
          _foreground: "hsl(var(--card-foreground))",
        },
        _popover: {
          DEFAULT: "hsl(var(--popover))",
          _foreground: "hsl(var(--popover-foreground))",
        },
        _primary: {
          DEFAULT: "hsl(var(--primary))",
          _foreground: "hsl(var(--primary-foreground))",
        },
        _secondary: {
          DEFAULT: "hsl(var(--secondary))",
          _foreground: "hsl(var(--secondary-foreground))",
        },
        _muted: {
          DEFAULT: "hsl(var(--muted))",
          _foreground: "hsl(var(--muted-foreground))",
        },
        _accent: {
          DEFAULT: "hsl(var(--accent))",
          _foreground: "hsl(var(--accent-foreground))",
        },
        _destructive: {
          DEFAULT: "hsl(var(--destructive))",
          _foreground: "hsl(var(--destructive-foreground))",
        },
        _border: "hsl(var(--border))",
        _input: "hsl(var(--input))",
        _ring: "hsl(var(--ring))",
        _chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        _sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          _foreground: "hsl(var(--sidebar-foreground))",
          _primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          _accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          _border: "hsl(var(--sidebar-border))",
          _ring: "hsl(var(--sidebar-ring))",
        },
      },
      _keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          _to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          _from: {
            height: "var(--radix-accordion-content-height)",
          },
          _to: {
            height: "0",
          },
        },
      },
      _animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  _plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
