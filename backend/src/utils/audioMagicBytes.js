// M-3: the client-reported MIME type / filename extension is fully
// attacker-controlled — multer's fileFilter only checks those, not the
// actual file content. This checks the real magic bytes of the uploaded
// buffer against the audio formats this app claims to accept, so a
// malicious/mislabeled upload can't slip through as "audio/wav" etc.
//
// No external dependency: recent `file-type` majors are ESM-only and this
// backend is CommonJS. These signatures are simple and stable — audio
// container formats haven't changed their magic bytes in decades.

function isWav(buf) {
  return buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WAVE';
}

function isOgg(buf) {
  return buf.length >= 4 && buf.toString('ascii', 0, 4) === 'OggS';
}

function isFlac(buf) {
  return buf.length >= 4 && buf.toString('ascii', 0, 4) === 'fLaC';
}

function isMp3(buf) {
  if (buf.length < 3) return false;
  if (buf.toString('ascii', 0, 3) === 'ID3') return true;           // ID3v2 tag
  return buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;               // MPEG frame sync
}

function isMp4OrM4a(buf) {
  // ISO base media file format: 4-byte size, then "ftyp" box type
  return buf.length >= 8 && buf.toString('ascii', 4, 8) === 'ftyp';
}

function isWebm(buf) {
  // EBML header, shared by WebM and Matroska
  return buf.length >= 4 &&
    buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
}

// Returns true if the buffer's actual content matches ANY audio format this
// app claims to accept — deliberately permissive across formats (we don't
// need to know which one) but strict about it being real audio, not an
// arbitrary file wearing an audio content-type.
function isRecognizedAudio(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return false;
  return isWav(buf) || isOgg(buf) || isFlac(buf) || isMp3(buf) || isMp4OrM4a(buf) || isWebm(buf);
}

module.exports = { isRecognizedAudio };
