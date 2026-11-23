import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { Vibration } from "react-native";

const sources = {
  scanOk: require("../assets/sounds/scan-ok.wav"),
  scanError: require("../assets/sounds/scan-error.wav"),
  success: require("../assets/sounds/success.wav"),
  newOrder: require("../assets/sounds/new-order.wav"),
  notify: require("../assets/sounds/notify.wav"),
} as const;

type SoundName = keyof typeof sources;
const players: Partial<Record<SoundName, AudioPlayer>> = {};
let ready = false;

function play(name: SoundName, vibrate: number | number[]) {
  try {
    if (!ready) {
      ready = true;
      void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => undefined);
    }
    const player = (players[name] ??= createAudioPlayer(sources[name]));
    void player.seekTo(0);
    player.play();
  } catch {
    /* sound is optional */
  }
  Vibration.vibrate(vibrate);
}

export const sounds = {
  scanOk: () => play("scanOk", 60),
  scanError: () => play("scanError", [0, 200, 100, 300]),
  success: () => play("success", [0, 80, 60, 120]),
  newOrder: () => play("newOrder", [0, 400, 200, 400, 200, 400]),
  notify: () => play("notify", 150),
};
