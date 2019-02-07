all: clean data trips.csv nyc.osm.pbf nyc.osrm traces.json

clean:
	rm -rf ./data

data:
	mkdir ./data

trips.csv:
	curl https://s3.amazonaws.com/nyc-tlc/trip+data/yellow_tripdata_2016-06.csv -o ./data/trips.csv

nyc.osm.pbf:
	curl http://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf -o ./data/nyc.osm.pbf

nyc.osrm:
	./node_modules/osrm/lib/binding/osrm-extract ./data/nyc.osm.pbf -p ./node_modules/osrm/profiles/car.lua
	./node_modules/osrm/lib/binding/osrm-contract ./data/nyc.osrm

traces.json:
	cat trips.csv | node index.js | node wrap.js > ./data/traces.json

traces-seq.json:
	cat trips.csv | node index.js > ./data/traces.json
