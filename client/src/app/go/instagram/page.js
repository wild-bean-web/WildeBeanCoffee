import SocialGoClient from "@/components/SocialGoClient";

export const metadata = {
  title: "Wild Bean Coffee on Instagram",
  robots: { index: false, follow: false },
};

export default function GoInstagramPage() {
  return <SocialGoClient network="instagram" />;
}
