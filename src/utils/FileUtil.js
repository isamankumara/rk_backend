const fs = require('fs');
const rimraf = require('rimraf');

const dataToFile = function (data, filepath) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(filepath);
    fileStream.write(data);
    fileStream.end();
    fileStream
      .on('finish', function () {
        fileStream.close(resolve); // close() is async, call resolve after close completes.
      })
      .on('error', function (err) {
        // Handle errors
        fs.unlink(filepath, () => {}); // Delete the file async. (But we don't check the result)
        console.error(err);
        reject(err.message);
      });
  });
};

const readStreamToFile = function (readStream, filepath) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(filepath);
    readStream.pipe(fileStream);
    fileStream
      .on('finish', function () {
        fileStream.close(resolve); // close() is async, call resolve after close completes.
      })
      .on('error', function (err) {
        // Handle errors
        fs.unlink(filepath); // Delete the file async. (But we don't check the result)
        console.error(err);
        reject(err.message);
      });
  });
};

const mkDirPromise = async path => {
  return new Promise((resolve, reject) => {
    fs.mkdir(path, err => {
      if (err) reject(err);
      else resolve(path);
    });
  });
};

const rimrafPromise = async path => {
  return new Promise((resolve, reject) => {
    rimraf(path, err => {
      if (err) reject(err);
      else resolve(path);
    });
  });
};

const appendFile = (sourcePath, outPath) => {
  return new Promise(async (resolve, reject) => {
    // open destination file for appending
    const outStream = fs.createWriteStream(outPath, {
      flags: 'a',
    });
    outStream.on('close', function () {
      resolve();
    });
    outStream.on('error', function () {
      reject();
    });

    const readStream = fs.createReadStream(sourcePath);
    readStream.pipe(outStream);
  });
};

const fileExists = filePath => {
  return new Promise(async (resolve, reject) => {
    fs.stat(filePath, function (err) {
      if (err == null) {
        resolve(true);
      } else if (err.code === 'ENOENT') {
        // file does not exist
        resolve(false);
      } else {
        reject('Some other error: ', err.code);
      }
    });
  });
};
module.exports = {
  dataToFile,
  readStreamToFile,
  mkDirPromise,
  rimrafPromise,
  appendFile,
  fileExists
};
