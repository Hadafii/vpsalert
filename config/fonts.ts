import {
  Fira_Code as FontMono,
  Inter as FontSans,
  Figtree as Figtree,
} from "next/font/google";

export const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const fontMono = FontMono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const fontFigtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});
