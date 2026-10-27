import type { Metadata } from "next";
import HomeSwitch from "./home-switch";

export const metadata: Metadata = {
  title: "At 116 & Broadway",
};

export default function Home() {
  return <HomeSwitch />;
}
