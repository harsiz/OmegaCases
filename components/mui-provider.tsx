"use client"
// v6 — no emotion cache import, theme from next-themes
import * as React from "react"
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material"
import { useTheme } from "next-themes"
import { AuthProvider } from "@/lib/auth-context"

interface ThemeContextValue {
  mode: "light" | "dark"
  toggleMode: () => void
}

export const ThemeContext = React.createContext<ThemeContextValue>({
  mode: "light",
  toggleMode: () => {},
})

export function useThemeMode() {
  return React.useContext(ThemeContext)
}

function buildTheme(mode: "light" | "dark") {
  return createTheme({
    palette: {
      mode,
      primary: { main: "#1976d2", light: "#42a5f5", dark: "#1565c0" },
      secondary: { main: "#e3f2fd" },
      background: {
        default: mode === "light" ? "#ffffff" : "#0d1b2a",
        paper:   mode === "light" ? "#f8fbff" : "#132233",
      },
      text: {
        primary:   mode === "light" ? "#0d1b2a" : "#e8f0fe",
        secondary: mode === "light" ? "#546e7a" : "#90a4ae",
      },
    },
    typography: {
      fontFamily: '"Roboto","Helvetica","Arial",sans-serif',
      h1: { fontWeight: 700 }, h2: { fontWeight: 700 },
      h3: { fontWeight: 600 }, h4: { fontWeight: 600 },
      h5: { fontWeight: 600 }, h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiButton: {
        styleOverrides: { root: { textTransform: "none", fontWeight: 600, borderRadius: 8 } },
      },
      MuiCard: {
        styleOverrides: { root: { borderRadius: 12, boxShadow: "0 2px 12px rgba(25,118,210,0.08)" } },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiCssBaseline: {
        styleOverrides: (theme: any) => ({
          body: {
            backgroundColor: theme.palette.background.default,
            color: theme.palette.text.primary,
            transition: "background-color 0.2s, color 0.2s",
          },
        }),
      },
    },
  })
}

// Separate inner component so it can safely use useTheme (client-only)
function ThemeInner({ children }: { children: React.ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme()
  const mode = resolvedTheme === "dark" ? "dark" : "light"

  const theme = React.useMemo(() => buildTheme(mode), [mode])

  const toggleMode = React.useCallback(() => {
    setTheme(mode === "dark" ? "light" : "dark")
  }, [mode, setTheme])

  return (
    <ThemeContext.Provider value={{ mode, toggleMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </ThemeContext.Provider>
  )
}

export default function MuiProvider({ children }: { children: React.ReactNode }) {
  return <ThemeInner>{children}</ThemeInner>
}
