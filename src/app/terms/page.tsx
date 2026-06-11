import { Metadata } from "next";
import { TermsContent } from "@/components/terms-content";

export const metadata: Metadata = {
  title: "Terms and Policies - ChatZi",
  description: "Terms and policies for using ChatZi"
};

export default function TermsPage() {
  return <TermsContent />;
}
