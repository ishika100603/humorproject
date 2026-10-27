import type { Metadata } from "next";
import CaptionApp from "../caption-app";

export const metadata: Metadata = {
  title: "Memes | At 116 & Broadway",
};

export default function Memes() {
  return <CaptionApp />;
}
