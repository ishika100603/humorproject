import type { Metadata } from "next";
import Landing from "../landing";

export const metadata: Metadata = {
  title: "Welcome | At 116 & Broadway",
};

export default function Welcome() {
  return <Landing />;
}
