const fs = require("fs");
const path = require("path");
const through2 = require("through2");
const byline = require("byline");
const turf = require("@turf/turf");
const { createCanvas, loadImage } = require("canvas");
var argv = require("minimist")(process.argv.slice(2));

const probes = path.join(__dirname, argv.probes);
const frames = path.join(__dirname, argv.frames);

const bbox = [Infinity, Infinity, -Infinity, -Infinity];
const w = 1000;
const h = 1000;
const canvas = createCanvas(w, h);
const ctx = canvas.getContext("2d");

var now;
var vehicles = new Map();

fs.createReadStream(probes)
  .pipe(byline.createStream())
  .pipe(
    through2((chunk, enc, next) => {
      try {
        const probe = JSON.parse(chunk.toString());
        if (probe.geometry.coordinates[0] < bbox[0])
          bbox[0] = probe.geometry.coordinates[0];
        if (probe.geometry.coordinates[1] < bbox[1])
          bbox[1] = probe.geometry.coordinates[1];
        if (probe.geometry.coordinates[0] > bbox[2])
          bbox[2] = probe.geometry.coordinates[0];
        if (probe.geometry.coordinates[1] > bbox[3])
          bbox[3] = probe.geometry.coordinates[1];

        next();
      } catch (e) {
        console.log(e);
        next();
      }
    })
  )
  .on("finish", () => {
    // bbox hack
    var up = bbox[1];
    var down = bbox[3];
    bbox[1] = down;
    bbox[3] = up;

    var xdiff = bbox[2] - bbox[0];
    var ydiff = bbox[3] - bbox[1];
    fs.createReadStream(probes)
      .pipe(byline.createStream())
      .pipe(
        through2((chunk, enc, next) => {
          try {
            const probe = JSON.parse(chunk.toString());

            if (!now) now = probe.properties.time;

            if (now !== probe.properties.time) {
              ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
              ctx.fillRect(0, 0, w, h);
              ctx.fillStyle = "rgba(0, 0, 0, 0)";

              fs.writeFileSync(
                path.join(frames, now + ".png"),
                canvas.toBuffer()
              );

              now = probe.properties.time;
            }

            if (!vehicles.has(probe.properties.id)) {
              vehicles.set(probe.properties.id, probe);
            } else {
              var last = vehicles.get(probe.properties.id);
              vehicles.set(probe.properties.id, probe);
              ctx.beginPath();
              ctx.strokeStyle = "rgb(255,255,255,0.7)";
              ctx.fillStyle = "rgb(255,255,255,0.7)";
              ctx.lineWidth = 2;

              ctx.moveTo(
                ((last.geometry.coordinates[0] - bbox[0]) / xdiff) * w,
                ((last.geometry.coordinates[1] - bbox[1]) / ydiff) * w
              );
              ctx.lineTo(
                ((probe.geometry.coordinates[0] - bbox[0]) / xdiff) * h,
                ((probe.geometry.coordinates[1] - bbox[1]) / ydiff) * h
              );
              ctx.stroke();
              ctx.closePath();
            }

            next();
          } catch (e) {
            console.log(e);
            next();
          }
        })
      );
  });
