# Python Speech Recognition

A collection of Python scripts demonstrating speech-to-text using the Google Speech Recognition API, covering three input scenarios: live microphone, short audio files, and long audio files.

## Scripts

| Script | Input | Description |
|--------|-------|-------------|
| `app.py` | Microphone | Records 4 seconds of live audio, adjusts for ambient noise, returns transcript |
| `app_audio.py` | WAV file | Loads a pre-recorded WAV file and returns transcript |
| `long_audio.py` | MP3 file | Splits on silence, processes chunks individually — handles files of any length |

## Dependencies

```
SpeechRecognition
PyAudio
pydub
```

> **PyAudio on Windows:** If `pip install pyaudio` fails, install via wheel:
> ```bash
> pip install pipwin
> pipwin install pyaudio
> ```

> **pydub** requires FFmpeg for MP3 support. Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to your PATH.

## Setup

```bash
# Install dependencies
pip install SpeechRecognition pydub pyaudio
```

## Usage

```bash
# Live microphone — speak within 4 seconds
python app.py

# From a WAV file
python app_audio.py

# From a long MP3 file (splits on silence automatically)
python long_audio.py
```

Sample audio files are in `sample_audio/` — `speech.wav` and `long_audio.mp3`.

## How It Works

All scripts use the `SpeechRecognition` library, which sends audio to Google's Speech-to-Text API over HTTPS. No API key is required for basic use (shared demo key with rate limits).

`long_audio.py` uses `pydub.silence.split_on_silence` to break audio into chunks before sending — Google's API has a ~1 minute per-request cap.

## Limitations

- Requires an internet connection (Google Speech API)
- Demo API key has rate limits — for production, obtain a Google Cloud Speech API key
- Accuracy drops in noisy environments without noise cancellation
