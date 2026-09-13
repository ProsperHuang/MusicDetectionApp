import { useState } from 'react';
import {
  Alert, 
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';

export default function App() {
  // Tracks whether the app is currently in listening mode.
  const [isListening, setIsListening] = useState(false);

  // Tracks whether microphone permission has been granted.
  const [hasMicPermission, setHasMicPermission] = useState(false);

  // Returns "light", "dark", or sometimes null depending on the device.
  const colorScheme = useColorScheme();

  // Use the device's current appearance setting.
  const isDarkMode = colorScheme === 'dark';

  // Define colors based on the current device theme.
  // We can replace these with a proper app-wide theme later.
  const backgroundColor = isDarkMode ? '#121212' : '#FFFFFF';
  const textColor = isDarkMode ? '#FFFFFF' : '#000000';

  // Checks whether microphone permission already exists.
  // If it does not, ask the operating system for permission.
  const ensureMicrophonePermission = async (): Promise<boolean> => {
    const currentPermission = await getRecordingPermissionsAsync();

    if (currentPermission.granted) {
      setHasMicPermission(true);
      return true;
    }

    // This causes Android/iPadOS to show the system permission dialog.
    const requestedPermission = await requestRecordingPermissionsAsync();

    setHasMicPermission(requestedPermission.granted);

    if (!requestedPermission.granted) {
      Alert.alert(
        'Microphone Permission Required',
        'Music Detection needs microphone access to identify music playing around you.'
      );

      return false;
    }

    return true;
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: backgroundColor },
      ]}
    >
      <Text
        style={[
          styles.title,
          { color: textColor },
        ]}
      >
        Music Detection
      </Text>

      <Text
        style={[
          styles.subtitle,
          { color: textColor },
        ]}
      >
        What's playing?
      </Text>

      <Pressable
        onPress={async () => {
          // STOP does not require another permission check.
          if (isListening) {
            setIsListening(false);
            return;
          }

          // Before starting, make sure the microphone is available.
          const permissionGranted = await ensureMicrophonePermission();

          if (permissionGranted) {
            setIsListening(true);
          }
        }}

        // pressed is automatically provided by React Native.
        // We use it here to slightly fade the button while it is being pressed.
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>
          {isListening ? 'STOP' : 'LISTEN'}
        </Text>
      </Pressable>

      <Text
        style={[
          styles.status,
          { color: textColor },
        ]}
      >
        {isListening ? 'Listening...' : 'Stopped'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Take up the entire screen.
    flex: 1,

    // Center contents vertically.
    justifyContent: 'center',

    // Center contents horizontally.
    alignItems: 'center',

    padding: 24,
  },

  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
  },

  subtitle: {
    fontSize: 18,
    marginBottom: 24,
  },

  button: {
    // Custom button styling gives us the same basic appearance
    // on both Android and iOS/iPadOS.
    backgroundColor: '#2563EB',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },

  buttonPressed: {
    opacity: 0.7,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  status: {
    fontSize: 16,
    marginTop: 24,
  },
});