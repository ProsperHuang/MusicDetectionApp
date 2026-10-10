import { useEffect, useState } from 'react';
import { File } from 'expo-file-system';
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
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

export default function App() {
  // Stores the song returned by the recognition service.
  const [detectedSong, setDetectedSong] = useState<{
    title: string;
    artist: string;
  } | null>(null);

  // Lets the UI show that recognition is currently in progress.
  const [isRecognizing, setIsRecognizing] = useState(false);

  // Stores a recognition error or "no match" message.
  const [recognitionMessage, setRecognitionMessage] = useState<string | null>(
    null
  );

  // Create one microphone recorder for this screen.
  // Metering lets us see whether real sound is reaching the microphone.
  const audioRecorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });

  // Ask Expo for updated information about the recorder every 100 ms.
  // This gives us recording status, duration, and microphone level.
  const recorderState = useAudioRecorderState(audioRecorder, 100);

  // Returns "light", "dark", or sometimes null depending on the device.
  const colorScheme = useColorScheme();

  // Use the device's current appearance setting.
  const isDarkMode = colorScheme === 'dark';

  // Define colors based on the current device theme.
  // We can replace these with a proper app-wide theme later.
  const backgroundColor = isDarkMode ? '#121212' : '#FFFFFF';
  const textColor = isDarkMode ? '#FFFFFF' : '#000000';

  // Configure the device's audio system once when this screen starts.
  useEffect(() => {
    const configureAudio = async () => {
      await setAudioModeAsync({
        // Allow this app to use the microphone for recording.
        allowsRecording: true,

        // Useful on Apple devices so audio features still work
        // when silent mode is enabled.
        playsInSilentMode: true,
      });
    };

    configureAudio();
  }, []);

  // Check whether microphone permission already exists.
  // If it does not, ask the operating system for permission.
  const ensureMicrophonePermission = async (): Promise<boolean> => {
    const currentPermission = await getRecordingPermissionsAsync();

    if (currentPermission.granted) {
      return true;
    }

    // Ask Android/iPadOS to show the system microphone permission dialog.
    const requestedPermission = await requestRecordingPermissionsAsync();

    if (!requestedPermission.granted) {
      Alert.alert(
        'Microphone Permission Required',
        'Music Detection needs microphone access to identify music playing around you.'
      );

      return false;
    }

    return true;
  };

  // Send a recorded audio clip to AudD for music recognition.
  const recognizeRecording = async (uri: string) => {
    try {
      setDetectedSong(null);
      setIsRecognizing(true);
      setRecognitionMessage(null);

      // Access the temporary recording created by expo-audio.
      const recordingFile = new File(uri);

      // Convert the audio file into a base64 string.
      // This avoids Expo Go's current multipart/FormData issue.
      const audioBase64 = await recordingFile.base64();

      // Build a normal URL-encoded request instead of multipart FormData.
      const requestBody = new URLSearchParams();
      requestBody.append('api_token', 'test');
      requestBody.append('audio', audioBase64);

      const response = await fetch('https://api.audd.io/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: requestBody.toString(),
      });

      if (!response.ok) {
        throw new Error(
          `Recognition request failed: ${response.status}`
        );
      }

      const data = await response.json();

      console.log('AudD response:', data);

      if (data.status === 'success' && data.result) {
        setDetectedSong({
          title: data.result.title,
          artist: data.result.artist,
        });

        setRecognitionMessage(null);
      } else if (data.status === 'success') {
        // The API worked, but it could not identify the song.
        setDetectedSong(null);
        setRecognitionMessage('No song recognized.');
      } else {
        // AudD itself returned an API error.
        console.error('AudD API error:', data);

        setDetectedSong(null);
        setRecognitionMessage(
          data.error?.error_message ?? 'Music recognition failed.'
        );
      }
    } catch (error) {
      console.error('Recognition error:', error);

      setDetectedSong(null);
      setRecognitionMessage('Music recognition failed.');
    } finally {
      setIsRecognizing(false);
    }
  };

  // Start real microphone capture.
  const startListening = async () => {
    const permissionGranted = await ensureMicrophonePermission();

    // Do nothing if the user denied microphone access.
    if (!permissionGranted) {
      return;
    }

    // Prepare the recorder, then begin recording.
    await audioRecorder.prepareToRecordAsync();
    await audioRecorder.record();
  };

  // Stop microphone capture.
  const stopListening = async () => {
    await audioRecorder.stop();

    const recordingUri = audioRecorder.uri;

    console.log('Recording saved to:', recordingUri);

    // Make sure Expo actually produced a recording file.
    if (!recordingUri) {
      setRecognitionMessage('No recording was created.');
      return;
    }

    // Send the temporary clip to the music-recognition service.
    await recognizeRecording(recordingUri);
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
        // Start or stop the actual microphone recorder.
        onPress={
          recorderState.isRecording
            ? stopListening
            : startListening
        }
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>
          {recorderState.isRecording ? 'STOP' : 'LISTEN'}
        </Text>
      </Pressable>

      <Text
        style={[
          styles.status,
          { color: textColor },
        ]}
      >
        {recorderState.isRecording ? 'Listening...' : 'Stopped'}
      </Text>

      {recorderState.isRecording && (
        <>
          <Text
            style={[
              styles.recordingInfo,
              { color: textColor },
            ]}
          >
            Recording time:{' '}
            {(recorderState.durationMillis / 1000).toFixed(1)} s
          </Text>

          <Text
            style={[
              styles.recordingInfo,
              { color: textColor },
            ]}
          >
            Microphone level:{' '}
            {recorderState.metering !== undefined
              ? `${recorderState.metering.toFixed(1)} dB`
              : 'Waiting...'}
          </Text>
        </>
      )}

      {isRecognizing && (
        <Text
          style={[
            styles.recognitionText,
            { color: textColor },
          ]}
        >
          Identifying song...
        </Text>
      )}

      {detectedSong && (
        <View style={styles.songResult}>
          <Text
            style={[
              styles.songTitle,
              { color: textColor },
            ]}
          >
            {detectedSong.title}
          </Text>

          <Text
            style={[
              styles.songArtist,
              { color: textColor },
            ]}
          >
            {detectedSong.artist}
          </Text>
        </View>
      )}

      {recognitionMessage && (
        <Text
          style={[
            styles.recognitionText,
            { color: textColor },
          ]}
        >
          {recognitionMessage}
        </Text>
      )}
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

  recordingInfo: {
    fontSize: 14,
    marginTop: 8,
  },

  recognitionText: {
    fontSize: 16,
    marginTop: 16,
  },

  songResult: {
    alignItems: 'center',
    marginTop: 24,
  },

  songTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },

  songArtist: {
    fontSize: 18,
    marginTop: 4,
  },
});