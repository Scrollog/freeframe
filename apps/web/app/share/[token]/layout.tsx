import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getShareMetadata } from "@/lib/share-metadata";

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  return getShareMetadata(params.token);
}

export default function ShareLayout({ children }: { children: ReactNode }) {
  return children;
}
