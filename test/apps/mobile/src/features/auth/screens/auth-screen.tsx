import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuthViewModel } from "../hooks/use-auth-view-model";

export function AuthScreen() {
  const vm = useAuthViewModel();

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>
        {vm.mode === "login" ? "WELCOME BACK" : "CREATE ACCOUNT"}
      </Text>
      <Text style={styles.title}>Sign in to continue</Text>

      {vm.mode === "register" ? (
        <TextInput
          value={vm.name}
          onChangeText={vm.setName}
          placeholder="Name"
          placeholderTextColor="#737373"
          style={styles.input}
        />
      ) : null}
      <TextInput
        value={vm.email}
        onChangeText={vm.setEmail}
        placeholder="Email"
        placeholderTextColor="#737373"
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />
      <TextInput
        value={vm.password}
        onChangeText={vm.setPassword}
        placeholder="Password"
        placeholderTextColor="#737373"
        secureTextEntry
        style={styles.input}
      />

      {vm.errorMessage ? <Text style={styles.error}>{vm.errorMessage}</Text> : null}

      <Pressable
        onPress={vm.submit}
        disabled={vm.isPending}
        style={({ pressed }) => [
          styles.button,
          (pressed || vm.isPending) && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>
          {vm.isPending ? "Please wait..." : vm.mode === "login" ? "Sign in" : "Create account"}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => vm.setMode(vm.mode === "login" ? "register" : "login")}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryButtonText}>
          {vm.mode === "login" ? "Create a new account" : "Use an existing account"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 14,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  eyebrow: {
    color: "#525252",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
  },
  title: {
    color: "#000000",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#d4d4d4",
    borderRadius: 8,
    paddingHorizontal: 14,
    color: "#000000",
    backgroundColor: "#ffffff",
  },
  error: {
    color: "#262626",
    backgroundColor: "#f5f5f5",
    borderColor: "#d4d4d4",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#000000",
  },
  buttonPressed: {
    opacity: 0.72,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#000000",
    fontWeight: "600",
  },
});
