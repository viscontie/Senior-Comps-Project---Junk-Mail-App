import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { doc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/app/utils/firebaseConfig";

// registers user's device for push notifications & saves their Expo push token to Firestore
export async function registerPushNotifications() {
  if (!Device.isDevice) return;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") {
    return;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  const user = auth.currentUser;
  if (!user) return;

  await updateDoc(doc(db, "users", user.uid), {
    expoPushToken: token,
  });
  console.log(`Push token ${token} successfully saved to Firestore`);

}

export async function sendDeliveryPushNotif(
  expoPushToken: string,
  orderId: string,
) {
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: expoPushToken,
      title: "Order Delivered 🚚",
      body: `Your Junk Mail order #${orderId.slice(-5)} has been delivered!`,
      sound: "default",
    }),
  });
}

// Update the notification expire time for the relevant user
export async function updateBellNotif(userId: string) {
  const notif = true;

  await updateDoc(doc(db, "users", userId), {
    notif: notif,
  });
}
