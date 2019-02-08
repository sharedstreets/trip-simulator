const through2 = require("through2");
const byline = require("byline");

console.log('{"type": "FeatureCollection","features": [');

process.stdin
  .pipe(byline.createStream())
  .pipe(
    through2((chunk, enc, next) => {
      console.log(chunk.toString() + ",");
      next();
    })
  )
  .on("finish", () => {
    console.log("]}");
  });
