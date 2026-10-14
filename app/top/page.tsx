import type { Metadata } from "next";
import TopBoard from "./top-board";

export const metadata: Metadata = {
  title: "Top captions | At 116 & Broadway",
};

export default function TopPage() {
  return <TopBoard />;
}
