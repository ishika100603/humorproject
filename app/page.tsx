import type { Metadata } from "next";
import CaptionApp from "./caption-app";

// The meme feed is the home page
export const metadata: Metadata = {
  title: "At 116 & Broadway",
};

export default function Home() {
  return <CaptionApp />;
}
