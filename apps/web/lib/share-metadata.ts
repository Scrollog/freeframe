import type { Metadata } from "next";

type ShareMetadata = {
  title: string;
  description: string;
};

const API_URL = (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export async function getShareMetadata(identifier: string): Promise<Metadata> {
  try {
    const response = await fetch(
      `${API_URL}/share/${encodeURIComponent(identifier)}/metadata`,
      { cache: "no-store" },
    );
    if (!response.ok) return {};

    const { title, description } = (await response.json()) as ShareMetadata;
    return {
      title,
      description,
      openGraph: { title, description, type: "website" },
      twitter: { card: "summary", title, description },
    };
  } catch {
    return {};
  }
}
