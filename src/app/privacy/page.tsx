import { Metadata } from "next";
import { PrivacyContent } from "@/components/privacy-content";

export const metadata: Metadata = {
  title: "Privacy Policy - ChatZi",
  description: "Privacy policy and data protection guidelines for ChatZi"
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
