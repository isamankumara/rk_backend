const fs = require('fs');
const {
  FileWriter: WavFileWriter,
  Reader: WavFileReader,
  Writer: PcmToWavStream,
} = require('wav');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');

const SAMPLE_RATE = 30000;
const AUDIO_CHANNELS = 1;

const trackMetadataPromise = track => {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(track);
    command.ffprobe(function (err, metadata) {
      if (err) reject(err);
      else resolve(metadata);
    });
  });
};

const pcmToMp3Stream = (
  writeStream,
  sampleRate,
  inputChannels = AUDIO_CHANNELS
) => {
  const wavStream = new PcmToWavStream({
    sampleRate,
    channels: inputChannels,
  });

  ffmpeg(wavStream)
    .inputFormat('wav')
    //.audioCodec('pcm_s16le')
    .format('mp3')
    .pipe(writeStream)
    .on('error', function (err) {
      console.error('pcmToMp3Stream Transcoding failed with error ', err);
    });

  return wavStream;
};

const getMp3TransformStreams = (sampleRate, inputChannels = AUDIO_CHANNELS) => {
  const wavStream = new PcmToWavStream({
    sampleRate,
    channels: inputChannels,
  });

  const command = ffmpeg(wavStream)
    .inputFormat('wav')
    //.audioCodec('pcm_s16le')
    .format('mp3')
    .audioBitrate('320k')
    .on('error', function (err) {
      console.error(
        'getMp3TransformStreams Transcoding failed with error ',
        err
      );
    });

  return [wavStream, command];
};

const getFlacToMp3TransformStream = chunkStream => {
  return (
    ffmpeg(chunkStream)
      .inputFormat('flac')
      //.audioCodec('libopus')
      .format('mp3')
      .audioBitrate('320k')
      .on('error', function (err) {
        console.error(
          'getOpusToMp3TransformStream Transcoding failed with error ',
          err
        );
      })
  );
};
const getFlacToWavTransformStream = chunkStream => {
  return (
    ffmpeg(chunkStream)
      .inputFormat('flac')
      //.audioCodec('libopus')
      .format('wav')
      .on('error', function (err) {
        console.error(
          'getFlacToWavTransformStream Transcoding failed with error ',
          err
        );
      })
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const pcaToWav = (source, target, sampleRate = SAMPLE_RATE) => {
  return new Promise((resolve, reject) => {
    // common function for cleaning up a partial output file
    function errCleanup(err) {
      fs.unlink(output, function (e) {
        if (e) console.log(e);
        reject(err);
      });
    }

    let inputFileStream = fs.createReadStream(source);
    let outputFileStream = new WavFileWriter(target, {
      sampleRate,
      channels: AUDIO_CHANNELS,
    });

    // have to separately listen for read/open errors
    inputFileStream.on('error', err => {
      // have to manually close writeStream when there was an error reading
      if (outputFileStream) outputFileStream.destroy();
      errCleanup(err);
    });
    inputFileStream.pipe(outputFileStream).on('error', errCleanup);
    outputFileStream.on('finish', resolve(target));
  });
};

const wavToPca = (source, target, sampleRate = SAMPLE_RATE) => {
  return new Promise((resolve, reject) => {
    // common function for cleaning up a partial output file
    function errCleanup(err) {
      fs.unlink(target, function (e) {
        if (e) console.log(e);
        reject(err);
      });
    }

    let wavReader = new WavFileReader();
    wavReader.audioFormat = {
      sampleRate,
      channels: AUDIO_CHANNELS,
    };
    let outputFileStream = fs.createWriteStream(target);
    // the "format" event gets emitted at the end of the WAVE header
    wavReader.on('format', function () {
      // the WAVE header is stripped from the output of the reader
      wavReader.pipe(outputFileStream);
    });
    const inputFileStream = fs.createReadStream(source);

    // have to separately listen for read/open errors
    inputFileStream.on('error', err => {
      // have to manually close writeStream when there was an error reading
      if (outputFileStream) outputFileStream.destroy();
      errCleanup(err);
    });

    // pipe the WAVE file to the Reader instance
    inputFileStream.pipe(wavReader);
    wavReader.on('finish', resolve(target));
  });
};

const wavToMp3 = (source, target) => {
  return new Promise((resolve, reject) => {
    ffmpeg(source)
      .inputFormat('wav')
      //.audioCodec('pcm_s16le')
      .format('mp3')
      .save(target)
      .on('end', function () {
        resolve(target);
      })
      .on('error', function (err) {
        console.error('wavtomp3 Transcoding failed with error ', err);
        reject(err);
      });
  });
};

const mp3ToWav = (source, target, sampleRate = SAMPLE_RATE) => {
  return new Promise((resolve, reject) => {
    ffmpeg(source)
      .inputFormat('mp3')
      //.audioCodec('pcm_s16le')
      .format('wav')
      .audioFrequency(sampleRate)
      .audioChannels(AUDIO_CHANNELS)
      .save(target)
      .on('end', function () {
        resolve(target);
      })
      .on('error', function (err) {
        console.error('mp3towav Transcoding failed with error ', err);
        reject(err);
      });
  });
};

const mp3Duration = source => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(source, function (err, metadata) {
      if (err) {
        console.error(metadata.format.duration);
        reject(err);
      } else {
        resolve(metadata.format.duration);
      }
    });
  });
};

// eslint-disable-next-line no-unused-vars
const pipePcmToMp3 = (
  inStream,
  outStream,
  sampleRate,
  inputChannels = AUDIO_CHANNELS,
  endStream = true
) => {
  ffmpeg(inStream)
    .inputFormat('s16le')
    .inputFps(sampleRate)
    //.native()
    .toFormat('mp3')
    .audioFrequency(sampleRate)
    //.fps(sampleRate)
    .audioChannels(inputChannels)
    //  .audioFilters(noiseFilter ? ["highpass=f=200", "lowpass=f=3000"] : [])
    .pipe(outStream, { end: endStream })
    .on('finish', async function () {
      console.log('mp3 stream finished');
      if (endStream) outStream.destroy();
      outStream = null;
    })
    .on('error', async function (err) {
      console.error('pipeWavToMp3 ', err);
      outStream.destroy();
      outStream = null;
      throw ('pipeWavToMp3 ', err);
    });
};

// eslint-disable-next-line no-unused-vars
const pipeMp3ToPcm = (inStream, outStream, endStream = true) => {
  ffmpeg(inStream)
    .inputFormat('mp3')
    .format('s16le')
    .audioFrequency(SAMPLE_RATE)
    .audioChannels(AUDIO_CHANNELS)
    .pipe(outStream, { end: endStream })
    .on('finish', async function () {
      console.log('pcm stream finished');
      if (endStream) outStream.destroy();
    })
    .on('error', async function (err) {
      console.error('pipeMp3ToPcm ', err);
      outStream.destroy();
      throw ('pipeMp3ToPcm ', err);
    });
};

const pipeFlacToPcaBuffer = (inStream, sampleRate) => {
  return new Promise((resolve) => {
    let wavReader = new WavFileReader();
    const pcaArray = [];
    wavReader.audioFormat = {
      sampleRate,
      channels: AUDIO_CHANNELS,
    };
    const passThrough = new PassThrough();
    wavReader.on('format', function () {
      // the WAVE header is stripped from the output of the reader
      wavReader.pipe(passThrough);
    });
    passThrough.on('data', data => {
      pcaArray.push(data);
    });
    passThrough.on('finish', () => {
      resolve(Buffer.concat(pcaArray));
    });
    ffmpeg(inStream)
      .inputFormat('flac')
      .toFormat('wav')
      .pipe(wavReader)
      .on('error', async function (err) {
        console.error('pipeFlacToPca ', err);
        outStream.destroy();
        throw ('pipeFlacToPca ', err);
      });
  });
};

const concatMp3s = (mp3Filepaths, outputFilepath, tempDir) => {
  return new Promise((resolve, reject) => {
    let ffmpegCmd = ffmpeg();
    for (const path of mp3Filepaths) {
      ffmpegCmd = ffmpegCmd.addInput(path);

      ffmpegCmd
        .on('error', function (err) {
          console.error('concatMp3s error ' + err.message);
          reject(err.message);
        })
        .on('end', function () {
          resolve(outputFilepath);
        })
        .mergeToFile(outputFilepath, tempDir);
    }
  });
};

module.exports = {
  SAMPLE_RATE,
  AUDIO_CHANNELS,
  pcaToWav,
  mp3ToWav,
  wavToPca,
  wavToMp3,
  wavToPca,
  pcmToMp3Stream,
  getMp3TransformStreams,
  getFlacToMp3TransformStream,
  getFlacToWavTransformStream,
  mp3Duration,
  pipePcmToMp3,
  pipeMp3ToPcm,
  trackMetadataPromise,
  concatMp3s,
  pipeFlacToPcaBuffer,
};
