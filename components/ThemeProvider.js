"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * next-themes injects a blocking inline <script> that applies the saved theme
 * before first paint (prevents a flash of the wrong theme). React 19's dev
 * build warns when a component renders a <script>, and it skips that warning
 * for non-JavaScript `type` values because it treats them as data blocks.
 * So emit `text/javascript` on the server, where the script must actually
 * run pre-paint, and `text/plain` on the client, where it can never execute
 * anyway. next-themes already sets suppressHydrationWarning on the tag, which
 * covers the resulting attribute difference.
 *
 * The `typeof window` check must stay inside this client component: in a
 * server component it would always be "undefined" and freeze the type to
 * "text/javascript", leaving the warning in place.
 */
export function ThemeProvider({ children, scriptProps, ...props }) {
  return (
    <NextThemesProvider
      {...props}
      scriptProps={{
        ...scriptProps,
        type:
          typeof window === "undefined" ? "text/javascript" : "text/plain",
      }}
    >
      {children}
    </NextThemesProvider>
  );
}
