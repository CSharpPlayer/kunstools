import { notFound } from "next/navigation";

export const metadata = {
  title: "页面不存在",
};

/**
 * 将所有未登记的网址交给平台内的统一无效页面处理。
 */
export default function PlatformUnknownPage() {
  notFound();
}
