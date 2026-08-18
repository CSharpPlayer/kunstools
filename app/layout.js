import "./globals.css";

export const metadata = {
  title: "鲲的工具组",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

/**
 * 提供全站 HTML 结构、简体中文语言标记和基础样式入口。
 */
export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
