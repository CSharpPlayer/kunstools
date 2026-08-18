/**
 * 长期阻止正常搜索引擎抓取整个公开站点。
 */
export default function robots() {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
