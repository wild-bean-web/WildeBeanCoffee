import { notFound } from "next/navigation";
import DigitalMenuClient from "./DigitalMenuClient";

const BASE = "/images/DigitalMenusSVG";

const MENUS = {
  coffee: {
    file: "Revised Coffee Menu.svg",
    title: "Coffee menu",
    description: "Wild Bean Coffee — digital coffee menu",
  },
  smoothies: {
    file: "Revised Smoothie Menu.svg",
    title: "Smoothies & bowls menu",
    description: "Wild Bean Coffee — digital smoothies & bowls menu",
  },
};

function menuSrc(menu) {
  const entry = MENUS[menu];
  if (!entry) return null;
  return `${BASE}/${encodeURIComponent(entry.file)}`;
}

export function generateStaticParams() {
  return Object.keys(MENUS).map((menu) => ({ menu }));
}

export async function generateMetadata({ params }) {
  const { menu } = await params;
  const entry = MENUS[menu];
  if (!entry) return { title: "Menu" };
  return {
    title: `${entry.title} | Wild Bean Coffee`,
    description: entry.description,
    robots: { index: false, follow: false },
  };
}

export default async function DigitalMenuPage({ params }) {
  const { menu } = await params;
  const entry = MENUS[menu];
  if (!entry) notFound();

  const src = menuSrc(menu);

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-black">
      <DigitalMenuClient src={src} label={entry.title} />
    </div>
  );
}
