import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  Switch,
  Linking,
  Platform,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { faqStyles } from "@/components/ui/faq-styles";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Title } from "@/components/ui/title";
import { Colors, Fonts } from "@/constants/theme";
import { usePin } from "@/context/pinContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  allowNotificationsCheck,
  scheduleReminder,
} from "../utils/notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getCurrentUser,
  getCurrentUserWithToken,
  logOut,
} from "../utils/accountStorage";
import { registerPushNotifications } from "../utils/pushNotifications";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../utils/firebaseConfig";

/* This is the settings page, where various settings like notifications and reminder
frequency can be enabled/disabled and modified.*/

export default function TabTwoScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [saveOrdersEnabled, setSaveOrdersEnabled] = useState(false);
  const [reminderFrequency, setReminderFrequency] = useState("Never");

  useEffect(() => {
    async function loadSettings() {
      const notif = await AsyncStorage.getItem("notificationsEnabled");
      const saveOrders = await AsyncStorage.getItem("saveOrdersEnabled");
      const reminder = await AsyncStorage.getItem("reminderFrequency");

      if (notif !== null) setNotificationsEnabled(JSON.parse(notif));
      if (saveOrders !== null) setSaveOrdersEnabled(JSON.parse(saveOrders));
      if (reminder !== null) setReminderFrequency(reminder);
    }
    loadSettings();
  }, []);

  // Alerts the user to confirm before logging out
  // redirects to the root screen
  const handleLogout = () => {
    Alert.alert(
      "Log out",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Log Out",
          style: "destructive", // red
          onPress: () => {
            logOut();
            router.replace("/"); // replace prevents user going back/undoing
          },
        },
      ],
      { cancelable: true },
    );
  };

  // Toggles push notification preference on/off
  const toggleNotifs = async () => {
    // Checks if notification permission was granted and links to the OS settings if not
    const allowed = await allowNotificationsCheck();
    if (!allowed) {
      Alert.alert(
        "Notifications Disabled",
        "You need to enable notifications in your device settings to use this feature",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Settings",
            onPress: () => {
              if (Platform.OS === "ios") {
                Linking.openURL("app-settings:");
              } else {
                Linking.openSettings();
              }
            },
          },
        ],
      );
      return;
    }
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    // Stores the toggle preference locally in AsyncStorage to ensure preference is saved across sessions
    await AsyncStorage.setItem(
      "notificationsEnabled",
      JSON.stringify(newValue),
    );
    // Registers the user's push token and updates the firestore doc to include Delivery notification preference
    const user = await getCurrentUserWithToken();
    if (user) {
      const userReference = doc(db, "users", user.uid);
      await updateDoc(userReference, {
        deliveryNotificationsEnabled: newValue,
      });
      console.log("Delivery notifications preference saved to firstore");
    }
    if (newValue) {
      await registerPushNotifications();
      console.log("Push token registered for user.");
    }
  };

  // Toggles whether completed orders are saved to Past Orders
  const toggleOrderSaving = async () => {
    const newValue = !saveOrdersEnabled;
    setSaveOrdersEnabled(newValue);
    await AsyncStorage.setItem("saveOrdersEnabled", JSON.stringify(newValue));
  };

  // Updates reminder frequency and schedules the related notification
  // Passing "Never" cancels any existing scheduled reminders
  const handleReminderFrequencyChange = async (value: string) => {
    if (value === reminderFrequency) return;

    const allowed = await allowNotificationsCheck();
    if (!allowed) {
      Alert.alert(
        "Notifications Disabled",
        "You need to enable notifications in your device settings to set reminders.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Settings",
            onPress: () => {
              if (Platform.OS === "ios") {
                Linking.openURL("app-settings:");
              } else {
                Linking.openSettings();
              }
            },
          },
        ],
      );
      return;
    }
    setReminderFrequency(value);
    await AsyncStorage.setItem("reminderFrequency", value);
    scheduleReminder(
      value as "Daily" | "Weekly" | "Biweekly" | "Monthly" | "Never",
    )
      .then(() => console.log(`Scheduled reminder for ${value}`))
      .catch((err) => console.error("Failed to schedule reminder:", err));
  };

  const router = useRouter();
  const { pin } = usePin();

  // Opens the SWA side of the app when clicked.
  // The user must enter a pin to be granted access.
  const handleSWA = () => {
    let inputPin = "";

    Alert.prompt(
      "Enter your SWA pin.",
      "This page is for OHP staff only.",
      [
        {
          text: "Cancel",
        },
        {
          text: "OK",
          onPress: (value?: string) => {
            inputPin = value?.trim() ?? "";
            if (inputPin === pin) {
              router.push("/SWApage");
            } else {
              Alert.alert("Incorrect pin");
            }
          },
        },
      ],
      "secure-text",
    );
  };

  // decided to use type for modularity. Makes it easier to add more settings nodes later
  type SettingsRowProps = {
    title: string;
    description: string;
    type?: "checkbox" | "dropdown";
    checked?: boolean;

    // for dropdown
    options?: string[];
    value?: string;
    onSelect?: (value: string) => void;
  };

  // Reusable settings row component
  // Supports checkbox (toggle) and dropdown variants
  // Designed to make adding new settings super easy
  const SettingsRow = ({
    title,
    description,
    type = "checkbox",
    checked = false,
    options = [],
    value,
    onSelect,
  }: SettingsRowProps) => {
    const [open, setOpen] = useState(false);

    //checkbox
    if (type === "checkbox") {
      return (
        <Pressable
          style={[faqStyles.faqItem, { width: "98%" }]}
        >
          <View style={faqStyles.questionContainer}>
            <View style={{ flex: 1 }}>
              <Text style={faqStyles.questionText}>{title}</Text>
              {description && (
                <Text
                  style={{ color: "#6e6e73", marginTop: 4, marginRight: 4 }}
                >
                  {description}
                </Text>
              )}
            </View>
            <Pressable
              onPress={() => onSelect?.(checked ? "false" : "true")}
              accessible={true}
              accessibilityRole="switch"
              accessibilityLabel={`${title}. ${description}`}
              accessibilityState={{ checked: checked }}
              accessibilityHint={
                checked ? "Double tap to turn off" : "Double tap to turn on"
              }
            >
              <Switch
                value={checked}
                onValueChange={() => onSelect?.(!checked ? "true" : "false")}
                trackColor={{ false: "#d1d1d6", true: colors.secondary }}
                thumbColor="#ffffff"
                ios_backgroundColor="#d1d1d6"
              />
            </Pressable>
          </View>
        </Pressable>
      );
    }

    //smaller dropdown componenet
    return (
      <View style={[faqStyles.faqItem, { width: "98%", zIndex: open ? 1000 : 1, overflow: 'visible' }]}>
        <Pressable
          onPress={() => setOpen((prev) => !prev)}
          style={faqStyles.questionContainer}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${description}. Current value: ${value}`}
          accessibilityHint={
            open
              ? "Double tap to collapse options"
              : "Double tap to expand options"
          }
          accessibilityState={{ expanded: open }}
        >
          <View style={{ flex: 1 }}>
            <Text style={faqStyles.questionText}>{title}</Text>
            {description && (
              <Text style={{ color: "#6e6e73", marginTop: 4, marginRight: 4 }}>
                {description}
              </Text>
            )}
          </View>
          <View style={{ minWidth: 75, alignItems: 'flex-end', marginRight: 8 }}>
            <Text style={styles.dropdownValue}>
              {value}
            </Text>
          </View>
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={14}
            color="#324D7F"
          />
        </Pressable>
        {open && (
          <View
            style={{
              position: 'absolute',
              right: 0,
              top: '80%',
              width: 140,
              maxHeight: 160,
              backgroundColor: 'white',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#e5e5e5',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
              zIndex: 1001,
            }}
          >
            <ScrollView nestedScrollEnabled={true}>
              <View style={faqStyles.answerContainer}>
                {options.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => {
                      onSelect?.(option);
                      setOpen(false);
                    }}
                    style={{ paddingVertical: 8 }}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={option}
                    accessibilityHint={`Select ${option} as reminder frequency`}
                    accessibilityState={{ selected: option === value }}
                  >
                    <Text
                      style={[
                        { textAlign: "center" },
                        option === value && [
                          faqStyles.answerText,
                          {
                            fontWeight: "600",
                            fontFamily: Fonts.regular,
                            color: "#1E325C",
                          },
                        ],
                        option !== value && {
                          color: "#6e6e73",
                          marginTop: 4,
                          marginRight: 4,
                        },
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  // Renders the main settings container and all settings options
  const MakeSettingsTile = () => {
    return (
      <View
        style={[styles.reviewTile, { padding: 16, backgroundColor: "#f2f2f7" }]}
      >
        <ScrollView
          style={{ width: "100%", maxHeight: 800 }}
          contentContainerStyle={{ paddingBottom: 20 }}
          scrollEnabled={false}
        >
          <SettingsRow
            title="Delivery Notifications"
            description="Enable push notifications when your order is ready"
            checked={notificationsEnabled}
            onSelect={toggleNotifs}
          />

          <SettingsRow
            title="Save Orders"
            description="Save your completed orders so you can view them later in Past Orders"
            checked={saveOrdersEnabled}
            onSelect={toggleOrderSaving}
          />

          <SettingsRow
            type="dropdown"
            title="Reminders"
            description="Indicate how often you want to be reminded to order products"
            value={reminderFrequency}
            options={["Never", "Daily", "Weekly", "Biweekly", "Monthly"]}
            onSelect={handleReminderFrequencyChange}
          />

          <Pressable
            onPress={handleSWA}
            style={[
              styles.button,
              {
                alignSelf: "center",
                backgroundColor: colors.buttonBackground,
                borderRadius: 8,
                marginTop: 5,
                height: 70,
                justifyContent: "center",
                alignItems: "center",

                shadowColor: "black",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                elevation: 5,
              },
            ]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Admin Access"
            accessibilityHint="Opens admin panel for OHP staff. Requires PIN code"
          >
            <ThemedView
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: "transparent",
              }}
            >
              <ThemedText
                type="defaultSemiBold"
                style={{ color: colors.buttonText, fontFamily: Fonts.semiBold }}
              >
                Admin Access
              </ThemedText>
            </ThemedView>
          </Pressable>

          <Pressable
            onPress={handleLogout}
            style={[
              styles.button,
              {
                alignSelf: "center",
                backgroundColor: "#c44242", // red
                borderRadius: 8,
                marginTop: 25,
                height: 70,
                justifyContent: "center",
                alignItems: "center",

                // Drop Shadow/Elevation
                shadowColor: "black",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                elevation: 5,
              },
            ]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Logout"
            accessibilityHint="Sign out of your Junk Mail account"
          >
            <ThemedView
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: "transparent",
              }}
            >
              <IconSymbol
                name="rectangle.portrait.and.arrow.right"
                size={24}
                color={colors.buttonText}
              />
              <ThemedText
                type="defaultSemiBold"
                style={{ color: colors.buttonText, fontFamily: Fonts.semiBold }}
              >
                Logout
              </ThemedText>
            </ThemedView>
          </Pressable>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Title>Settings</Title>
      <MakeSettingsTile />
    </View>
  );
}

const styles = StyleSheet.create({
  reviewTile: {
    backgroundColor: "#FFF7F7",
    marginTop: 15,
    marginBottom: 15,
    marginLeft: 20,
    marginRight: 20,
    height: 560,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    // Drop Shadow/Elevation
    shadowColor: "black",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  description: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 20,
    fontFamily: Fonts.regular,
  },

  checkbox: {
    width: 25,
    height: 25,
    borderWidth: 2,
    borderColor: "Black",
    backgroundColor: "white",
  },

  checkboxChecked: {
    backgroundColor: "green",
  },

  bottomButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 20,
    alignItems: "center",
  },
  row: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1c1c1e",
    fontFamily: Fonts.regular,
  },

  dropdownValue: {
    fontSize: 14,
    color: "#6e6e73",
    fontFamily: Fonts.regular,
    fontWeight: "700",
  },

  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },

  dropdownOptionText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
  },

  button: {
    borderRadius: 8,
    width: 280,
    height: 70,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "black",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
