import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getShareMetadata } from "@/lib/share-metadata";

export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  return getShareMetadata(params.code);
}

export default function ShortShareLayout({ children }: { children: ReactNode }) {
  return children;
}
