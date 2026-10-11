import type { Metadata } from "next";
import CaptionApp from "../caption-app";

export const metadata: Metadata = {
  title: "Feed | At 116 & Broadway",
};

export default function FeedPage() {
  return <CaptionApp />;
}
