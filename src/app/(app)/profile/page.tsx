import { redirect } from "next/navigation";

/** Профиль теперь — первый раздел настроек */
export default function ProfilePage() {
  redirect("/settings#profile");
}
