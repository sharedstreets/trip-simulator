const through2 = require("through2");
const byline = require("byline");
const turf = require("@turf/turf");
const OSRM = require("osrm");
const random = require("random");
const moment = require("moment");

const osrm = new OSRM("./data/nyc.osrm");

const DRIFT = 0.01;
const PERIOD = 20;
var normal = random.normal();

var k = 0;

process.stdin.pipe(byline.createStream()).pipe(
  through2((chunk, enc, next) => {
    k++;
    if (k % 10000 === 0) console.error(k);
    var line = chunk.toString();

    if (line.length && k > 1) {
      // skip header or trailing endline
      var cell = line.split(",");

      var record = {
        timeA: moment(cell[1]),
        timeB: moment(cell[2]),
        ptA: [+cell[5], +cell[6]],
        ptB: [+cell[9], +cell[10]]
      };

      if (
        record.timeA &&
        record.timeB &&
        !isNaN(record.ptA[0]) &&
        !isNaN(record.ptA[1]) &&
        !isNaN(record.ptB[0]) &&
        !isNaN(record.ptB[1])
      ) {
        osrm.route(
          {
            coordinates: [record.ptA, record.ptB],
            overview: "full",
            geometries: "geojson"
          },
          (err, result) => {
            if (!err && result.routes[0]) {
              var overview = turf.lineString(
                result.routes[0].geometry.coordinates
              );
              var distance = turf.length(overview);
              var duration = result.routes[0].duration;

              if (distance > 0) {
                var trip = [];
                var timestamps = [];
                var playback = 0;
                var periodBias = normal() * 5;
                if (periodBias < 1) periodBias = 1;
                var driftBias = normal();

                while (playback <= duration) {
                  var step = normal() * PERIOD * periodBias;
                  if (step < 0) step = step * -1;
                  playback += step;
                  var progress = playback / duration;
                  var probe = turf.destination(
                    turf.along(overview, progress / distance),
                    normal() * DRIFT * driftBias,
                    normal() * 360
                  );
                  trip.push(probe.geometry.coordinates);
                  timestamps.push(
                    record.timeA.add(playback, "seconds").format()
                  );
                }

                if (trip.length >= 2) {
                  console.log(
                    JSON.stringify(
                      turf.lineString(trip, { timestamps: timestamps, speed: Math.round(distance/(duration/60/60)) })
                    )
                  );
                }
              }
            }
            next();
          }
        );
      } else next();
    } else next();
  })
);
