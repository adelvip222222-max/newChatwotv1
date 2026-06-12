import { Metadata } from "next";
import { DeletionContent } from "@/components/deletion-content";

export const metadata: Metadata = {
  title: "Data Deletion - ChatZi",
  description: "User data deletion instructions for ChatZi"
};

export default function DataDeletionPage() {
  return <DeletionContent />;
}
