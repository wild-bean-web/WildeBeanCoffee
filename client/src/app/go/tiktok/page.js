import SocialGoClient from "@/components/SocialGoClient";

export const metadata = {
  title: "Wild Bean Coffee on TikTok",
  robots: { index: false, follow: false },
};

export default function GoTikTokPage() {
  return <SocialGoClient network="tiktok" />;
}
