# Voice Authentication CNN

> **Status: Held out / research phase.** Not integrated into the VPay app. This is a standalone research exploration, currently paused, kept in the repo for reference only.

Speaker verification system using a pre-trained Convolutional Neural Network. Enrolls users by extracting voice embeddings from audio and authenticates by comparing new audio against stored embeddings via cosine distance.

## How It Works

```
Audio file
    → Preprocessing (DC removal, pre-emphasis, framing)
    → FFT spectrum extraction (512-point)
    → CNN model inference
    → 128-dim voice embedding (speaker "fingerprint")
    → Cosine distance vs stored embeddings
    → Accept (distance < 0.35) or Reject
```

## Project Structure

```
Voice-Authentication-CNN/
├── voice_auth.py          # CLI entry point — enroll / authenticate
├── feature_extraction.py  # CNN inference → voice embeddings
├── preprocess.py          # Audio → FFT spectra
├── parameters.py          # Config constants (sample rate, frame size, threshold)
├── voice_auth_model_cnn/  # Pre-trained TensorFlow/Keras model
├── data/
│   ├── wav/               # Raw audio files per user (WAV / FLAC)
│   └── embed/             # Stored embeddings (.npy) per enrolled user
├── res/                   # Model evaluation results (CSV)
└── requirments.txt
```

## Audio Parameters

| Parameter | Value |
|-----------|-------|
| Sample rate | 16,000 Hz |
| Frame length | 25 ms |
| Frame step | 10 ms |
| FFT size | 512 |
| Max audio duration | 10 seconds |
| Auth threshold (cosine distance) | 0.35 |

## Dependencies

```
librosa
scipy
numpy
python_speech_features
keras
tensorflow
pandas
```

```bash
pip install -r requirments.txt
```

> TensorFlow 2.x recommended. For GPU support use `tensorflow-gpu`.

## Usage

### Enroll a new user

```bash
# Single audio file
python voice_auth.py -t enroll -n "Name" -f path/to/audio.wav

# Batch enroll from CSV (columns: name, filepath)
python voice_auth.py -t enroll -f path/to/list.csv
```

The embedding is saved to `data/embed/<name>.npy`.

### Authenticate

```bash
python voice_auth.py -t recognize -f path/to/audio.flac
```

Returns the matched user name and cosine distance, or rejects if no stored embedding is below the threshold.

## Pre-enrolled Speakers

The repo includes embeddings for three sample speakers: **Amy**, **Collin**, and **Ethan**.

## Limitations

- Model accuracy degrades on microphones or environments significantly different from the training data
- 10-second audio cap — longer clips are truncated
- No anti-spoofing protection (replay attacks are not defended against)
