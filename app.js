// [START gae_node_request_example]
const express = require("express");
const path = __dirname + "/views/build/";
const axios = require("axios");
const geohash = require("ngeohash");
var SpotifyWebApi = require("spotify-web-api-node");

const app = express();
app.use(express.static(path));

var spotifyApi = new SpotifyWebApi({
  clientId: "enter_your_key",
  clientSecret: "enter_your_key",
});

setTokenSpotify();

async function setTokenSpotify() {
  try {
    data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body["access_token"]);
    console.log("The access token expires in " + data.body["expires_in"]);
    console.log("The access token is " + data.body["access_token"]);
  } catch (err) {
    console.log("Something went wrong when retrieving an access token", err);
  }
  // spotifyApi.clientCredentialsGrant().then(
  //   function(data) {
  //     console.log('The access token expires in ' + data.body['expires_in']);
  //     console.log('The access token is ' + data.body['access_token']);
  //     spotifyApi.setAccessToken(data.body['access_token']);
  //   },
  //   function(err) {
  //     console.log('Something went wrong when retrieving an access token', err);
  //   }
  // )
}

app.get("/", (req, res) => {
  res.sendFile(path + "index.html");
});

app.get("/eventVenueDetail", async (req, res) => {
  var paramEvent = {};
  var paramVenue = {};
  const eventId = req.query.id;
  paramVenue["keyword"] = req.query.ven_name;
  paramEvent["apikey"] = "enter_your_key";
  paramVenue["apikey"] = "enter_your_key";
  url_params_venue = new URLSearchParams(paramVenue);
  url_params_event = new URLSearchParams(paramEvent);
  console.log(
    `https://app.ticketmaster.com/discovery/v2/events/${eventId}` +
      "?" +
      url_params_event
  );
  var responseVen;
  var responseEvent;
  try {
    responseVen = await axios.get(
      "https://app.ticketmaster.com/discovery/v2/venues" +
        "?" +
        url_params_venue
    );
    responseEvent = await axios.get(
      `https://app.ticketmaster.com/discovery/v2/events/${eventId}` +
        "?" +
        url_params_event
    );
    var event_detail = get_useful_event_data(responseEvent["data"]);
    var venue_detail = get_useful_venue_data(responseVen["data"]);
    // console.log(event_detail);
    var spotify_data;
    if (event_detail["name"] != -1 && event_detail["name"] != "") {
      console.log(event_detail);
      var name_artist = event_detail["name"].filter((row, i) => {
        if (event_detail["is_music"][i]) {
          return row;
        }
      });
      spotify_data = await get_spotify_data(name_artist);
    } else {
      spotify_data = -1;
    }
    result = {
      event_detail: event_detail,
      venue_detail: venue_detail,
      spotify_data: spotify_data,
    };
    res.send(result);
    res.end();
  } catch (error) {
    console.log(error);
    res.send("error");
    res.end();
  }
  // console.log(responseVen['data']);
});

app.get("/keywordAutoComp", (req, res) => {
  params = {};
  params["keyword"] = req.query.keyword;
  params["apikey"] = "enter_your_key";
  url_params = new URLSearchParams(params);
  axios
    .get("https://app.ticketmaster.com/discovery/v2/suggest" + "?" + url_params)
    .then(function (response) {
      console.log(response);
      var autocomp_data = useful_data_autocomplete(response.data);
      res.send(autocomp_data);
      res.end();
    })
    .catch(function (error) {
      console.log(error);
    });
});

app.get("/searchRes", (req, res) => {
  category_map = {
    Music: "KZFzniwnSyZfZ7v7nJ",
    Sports: "KZFzniwnSyZfZ7v7nE",
    "Arts & Theatre": "KZFzniwnSyZfZ7v7na",
    Film: "KZFzniwnSyZfZ7v7nn",
    Miscellaneous: "KZFzniwnSyZfZ7v7n1",
  };
  if (req.query.keyword) {
    params_form = {};
    params_form["keyword"] = req.query.keyword;
    if (req.query.geoPoint && req.query.geoPoint != "not_found") {
      var latlong = req.query.geoPoint.split("SEP");
      params_form["geoPoint"] = geohash.encode(latlong[0], latlong[1]);
      if (req.query.radius) {
        if (req.query.radius > 0) {
          params_form["radius"] = req.query.radius;
        } else {
          params_form["radius"] = 10;
        }
      } else {
        params_form["radius"] = 10;
      }
      if (req.query.segmentId && req.query.segmentId != "Default") {
        params_form["segmentId"] = category_map[req.query.segmentId];
      } else {
        params_form["segmentId"] = "";
      }
      params_form["unit"] = "miles";
      params_form["apikey"] = "enter_your_key";
      url_params = new URLSearchParams(params_form);
      console.log(
        "https://app.ticketmaster.com/discovery/v2/events.json" +
          "?" +
          url_params
      );

      axios
        .get(
          "https://app.ticketmaster.com/discovery/v2/events.json" +
            "?" +
            url_params
        )
        .then(function (response) {
          // console.log(response);
          if ("_embedded" in response.data) {
            table_data = useful_data_search(response.data._embedded);
            // console.log(table_data);
            if (table_data["exist"] == 1) {
              delete table_data["exist"];
              res.send(table_data);
              res.end();
            } else {
              res.send("Error");
              res.end();
            }
          } else {
            res.send("Error");
            res.end();
          }
        })
        .catch(function (error) {
          console.log(error);
        });
    }
  }
});

function get_useful_venue_data(res) {
  let data = {};
  let undefined = ["Undefined", "undefined"];

  if (
    "_embedded" in res &&
    "venues" in res["_embedded"] &&
    res["_embedded"]["venues"].length > 0
  ) {
    if (
      "name" in res["_embedded"]["venues"][0] &&
      !undefined.includes(res["_embedded"]["venues"][0]["name"])
    ) {
      data["name"] = res["_embedded"]["venues"][0]["name"];
    }
    if (
      "address" in res["_embedded"]["venues"][0] &&
      "line1" in res["_embedded"]["venues"][0]["address"] &&
      !undefined.includes(res["_embedded"]["venues"][0]["address"]["line1"])
    ) {
      data["address"] = res["_embedded"]["venues"][0]["address"]["line1"];
    }
    if (
      "city" in res["_embedded"]["venues"][0] &&
      "name" in res["_embedded"]["venues"][0]["city"] &&
      !undefined.includes(res["_embedded"]["venues"][0]["city"]["name"])
    ) {
      data["city"] = res["_embedded"]["venues"][0]["city"]["name"];
    }
    if (
      "state" in res["_embedded"]["venues"][0] &&
      "stateCode" in res["_embedded"]["venues"][0]["state"] &&
      !undefined.includes(res["_embedded"]["venues"][0]["state"]["stateCode"])
    ) {
      data["state"] = res["_embedded"]["venues"][0]["state"]["stateCode"];
    }
    if (
      "postalCode" in res["_embedded"]["venues"][0] &&
      !undefined.includes(res["_embedded"]["venues"][0]["postalCode"])
    ) {
      data["postalCode"] = res["_embedded"]["venues"][0]["postalCode"];
    }
    if (
      "url" in res["_embedded"]["venues"][0] &&
      !undefined.includes(res["_embedded"]["venues"][0]["url"])
    ) {
      data["url"] = res["_embedded"]["venues"][0]["url"];
    }
    if (
      "boxOfficeInfo" in res["_embedded"]["venues"][0] &&
      "phoneNumberDetail" in res["_embedded"]["venues"][0]["boxOfficeInfo"]
    ) {
      data["phoneNumber"] =
        res["_embedded"]["venues"][0]["boxOfficeInfo"]["phoneNumberDetail"];
    }
    if (
      "boxOfficeInfo" in res["_embedded"]["venues"][0] &&
      "openHoursDetail" in res["_embedded"]["venues"][0]["boxOfficeInfo"]
    ) {
      data["openHours"] =
        res["_embedded"]["venues"][0]["boxOfficeInfo"]["openHoursDetail"];
    }
    if (
      "generalInfo" in res["_embedded"]["venues"][0] &&
      "generalRule" in res["_embedded"]["venues"][0]["generalInfo"]
    ) {
      data["generalRule"] =
        res["_embedded"]["venues"][0]["generalInfo"]["generalRule"];
    }
    if (
      "generalInfo" in res["_embedded"]["venues"][0] &&
      "childRule" in res["_embedded"]["venues"][0]["generalInfo"]
    ) {
      data["childRule"] =
        res["_embedded"]["venues"][0]["generalInfo"]["childRule"];
    }
    if (
      "location" in res["_embedded"]["venues"][0] &&
      "longitude" in res["_embedded"]["venues"][0]["location"] &&
      "latitude" in res["_embedded"]["venues"][0]["location"]
    ) {
      data["longitude"] =
        res["_embedded"]["venues"][0]["location"]["longitude"];
      data["latitude"] = res["_embedded"]["venues"][0]["location"]["latitude"];
      console.log(data["longitude"]);
      console.log(data["latitude"]);
    }
  }
  if (Object.keys(data).length !== 0) {
    data["exist"] = 1;
  } else {
    data["exist"] = 0;
  }
  return data;
}

async function get_spotify_data(names) {
  var data;
  var res = {};
  for (let i = 0; i < names.length; i++) {
    try {
      data = await spotifyApi.searchArtists(names[i]);
    } catch (error) {
      console.log("Token expired. Resetting Spotify Access Token");
      await setTokenSpotify();
      try {
        data = await spotifyApi.searchArtists(names[i]);
      } catch (error1) {
        console.log("Cannot get spotify data 1");
        continue;
      }
    }

    temp_data = await get_useful_spotify_artist_data(
      data.body,
      data.statusCode
    );
    if (temp_data != -1) {
      res[i.toString()] = temp_data;
    }
  }
  return res;
}

async function get_useful_spotify_artist_data(res, statusCode) {
  if (statusCode == 200) {
    if (
      "artists" in res &&
      "items" in res["artists"] &&
      res["artists"]["items"].length > 0
    ) {
      if ("id" in res["artists"]["items"][0]) {
        try {
          album_data = await spotifyApi.getArtistAlbums(
            res["artists"]["items"][0]["id"],
            { limit: 3 }
          );
        } catch (error) {
          console.log("Token Expired. Resetting Spotify Access Token");
          await setTokenSpotify();
          try {
            album_data = await spotifyApi.getArtistAlbums(
              res["artists"]["items"][0]["id"],
              { limit: 3 }
            );
          } catch (error1) {
            console.log("Cannot get spotify data 2");
            res["artists"]["items"][0]["album"] = -1;
            return res["artists"]["items"][0];
          }
        }
        res["artists"]["items"][0]["album"] = album_data.body;
        return res["artists"]["items"][0];
      }
      res["artists"]["items"][0]["album"] = -1;
      return res["artists"]["items"][0];
    }
  }
  return -1;
}

function get_useful_event_data(res) {
  let data = {};
  let undefined = ["Undefined", "undefined"];
  var count = 0;
  if ("name" in res) {
    data["event_name"] = res["name"];
  } else {
    data["event_name"] = "";
  }
  if ("dates" in res) {
    if (
      "start" in res["dates"] &&
      "localDate" in res["dates"]["start"] &&
      "localTime" in res["dates"]["start"]
    ) {
      if (!undefined.includes(res["dates"]["start"]["localDate"])) {
        data["localDate"] = res["dates"]["start"]["localDate"];
      } else {
        data["localDate"] = "";
        count = count + 1;
      }
      if (!undefined.includes(res["dates"]["start"]["localTime"])) {
        data["localTime"] = res["dates"]["start"]["localTime"];
      } else {
        data["localTime"] = "";
      }
    } else {
      data["localDate"] = "";
      data["localTime"] = "";
      count = count + 1;
    }
    if (
      "status" in res["dates"] &&
      "code" in res["dates"]["status"] &&
      !undefined.includes(res["dates"]["status"]["code"])
    ) {
      data["ticket_status"] = res["dates"]["status"]["code"];
    } else {
      data["ticket_status"] = "";
      count = count + 1;
    }
  } else {
    data["localDate"] = "";
    data["localTime"] = "";
    data["ticket_status"] = "";
    count = count + 3;
  }
  let names = [];
  let url = [];
  let isMusic = [];
  if ("_embedded" in res) {
    if ("attractions" in res["_embedded"]) {
      for (let i = 0; i < res["_embedded"]["attractions"].length; i++) {
        if (
          "name" in res["_embedded"]["attractions"][i] &&
          !undefined.includes(res["_embedded"]["attractions"][i]["name"])
        ) {
          if (
            "url" in res["_embedded"]["attractions"][i] &&
            !undefined.includes(res["_embedded"]["attractions"][i]["url"])
          ) {
            url.push(res["_embedded"]["attractions"][i]["url"]);
          } else {
            url.push("");
          }
          names.push(res["_embedded"]["attractions"][i]["name"]);
          if (
            "classifications" in res["_embedded"]["attractions"][i] &&
            res["_embedded"]["attractions"][i]["classifications"].length > 0 &&
            res["_embedded"]["attractions"][i]["classifications"][0] &&
            "segment" in
              res["_embedded"]["attractions"][i]["classifications"][0] &&
            "name" in
              res["_embedded"]["attractions"][i]["classifications"][0][
                "segment"
              ] &&
            ["music", "Music"].includes(
              res["_embedded"]["attractions"][i]["classifications"][0][
                "segment"
              ]["name"]
            )
          ) {
            isMusic.push(true);
          } else {
            isMusic.push(false);
          }
        }
      }
      if (names.length != 0) {
        data["name_url"] = url;
        data["name"] = names;
        data["is_music"] = isMusic;
      } else {
        data["name"] = "";
        data["name_url"] = "";
        data["is_music"] = "";
        count = count + 1;
      }
    } else {
      data["name"] = "";
      data["name_url"] = "";
      data["is_music"] = "";
      count = count + 1;
    }
    if (
      "venues" in res["_embedded"] &&
      res["_embedded"]["venues"].length > 0 &&
      "name" in res["_embedded"]["venues"][0]
    ) {
      if (!undefined.includes(res["_embedded"]["venues"][0]["name"])) {
        data["venue"] = res["_embedded"]["venues"][0]["name"];
      } else {
        data["venue"] = "";
        count = count + 1;
      }
    } else {
      data["venue"] = "";
      count = count + 1;
    }
    let list2 = ["subGenre", "genre", "segment", "subType", "type"];
  } else {
    data["name"] = "";
    data["venue"] = "";
    data["name_url"] = "";
    count = count + 3;
  }
  if ("classifications" in res) {
    let genre = [];
    if (
      "subGenre" in res["classifications"][0] &&
      "name" in res["classifications"][0]["subGenre"] &&
      !undefined.includes(res["classifications"][0]["subGenre"]["name"])
    ) {
      genre.push(res["classifications"][0]["subGenre"]["name"]);
    }
    if (
      "genre" in res["classifications"][0] &&
      "name" in res["classifications"][0]["genre"] &&
      !undefined.includes(res["classifications"][0]["genre"]["name"])
    ) {
      genre.push(res["classifications"][0]["genre"]["name"]);
    }
    if (
      "segment" in res["classifications"][0] &&
      "name" in res["classifications"][0]["segment"] &&
      !undefined.includes(res["classifications"][0]["segment"]["name"])
    ) {
      genre.push(res["classifications"][0]["segment"]["name"]);
    }
    if (
      "subType" in res["classifications"][0] &&
      "name" in res["classifications"][0]["subType"] &&
      !undefined.includes(res["classifications"][0]["subType"]["name"])
    ) {
      genre.push(res["classifications"][0]["subType"]["name"]);
    }
    if (
      "type" in res["classifications"][0] &&
      "name" in res["classifications"][0]["type"] &&
      !undefined.includes(res["classifications"][0]["type"]["name"])
    ) {
      genre.push(res["classifications"][0]["type"]["name"]);
    }

    if (genre.length > 0) {
      data["genre"] = genre.join(" | ");
    } else {
      data["genre"] = "";
      count = count + 1;
    }
  } else {
    data["genre"] = "";
    count = count + 1;
  }

  if ("priceRanges" in res && res["priceRanges"].length > 0) {
    if (
      "min" in res["priceRanges"][0] &&
      !undefined.includes(res["priceRanges"][0]["min"])
    ) {
      if (
        "max" in res["priceRanges"][0] &&
        !undefined.includes(res["priceRanges"][0]["max"])
      ) {
        data["priceRange"] =
          res["priceRanges"][0]["min"] + "-" + res["priceRanges"][0]["max"];
      } else {
        data["priceRange"] = res["priceRanges"][0]["min"];
      }
    } else if (
      "max" in res["priceRanges"][0] &&
      !undefined.includes(res["priceRanges"][0]["max"])
    ) {
      data["priceRange"] = res["priceRanges"][0]["max"];
    } else {
      data["priceRange"] = "";
      count = count + 1;
    }
  } else {
    data["priceRange"] = "";
    count = count + 1;
  }

  if ("url" in res && !undefined.includes(res["url"])) {
    data["buy_ticket"] = res["url"];
  } else {
    data["buy_ticket"] = "";
    count = count + 1;
  }

  if (
    "seatmap" in res &&
    "staticUrl" in res["seatmap"] &&
    !undefined.includes(res["seatmap"]["staticUrl"])
  ) {
    data["seatmap"] = res["seatmap"]["staticUrl"];
  } else {
    data["buy_ticket"] = "";
    count = count + 1;
  }

  if (count == 9) {
    data["exist"] = 0;
  } else {
    data["exist"] = 1;
  }
  console.log(res);
  if (
    "location" in res["_embedded"]["venues"][0] &&
    "longitude" in res["_embedded"]["venues"][0]["location"] &&
    "latitude" in res["_embedded"]["venues"][0]["location"]
  ) {
    console.log("from event");
    console.log(res["_embedded"]["venues"][0]["location"]["longitude"]);
    console.log(res["_embedded"]["venues"][0]["location"]["latitude"]);
  }

  return data;
}

function useful_data_autocomplete(res) {
  let result = {};
  let count = 0;
  if (
    "_embedded" in res &&
    "attractions" in res["_embedded"] &&
    res["_embedded"]["attractions"].length > 0
  ) {
    for (let i = 0; i < res["_embedded"]["attractions"].length; i++) {
      if ("name" in res["_embedded"]["attractions"][i]) {
        result[count.toString()] = res["_embedded"]["attractions"][i]["name"];
        count++;
      }
    }
  }
  return result;
}

function useful_data_search(res) {
  var useful = {};
  var num = 0;
  var needed = ["localDate", "localTime", "images", "name", "segment"];
  if ("events" in res) {
    for (var i = 0; i < res["events"].length; i++) {
      if (num < 20) {
        useful[i.toString()] = {};
        if (
          "dates" in res["events"][i] &&
          "start" in res["events"][i]["dates"] &&
          "localDate" in res["events"][i]["dates"]["start"]
        ) {
          useful[i.toString()]["localDate"] =
            res["events"][i]["dates"]["start"]["localDate"];
        } else {
          useful[i.toString()]["localDate"] = "";
        }

        if (
          "dates" in res["events"][i] &&
          "start" in res["events"][i]["dates"] &&
          "localTime" in res["events"][i]["dates"]["start"]
        ) {
          useful[i.toString()]["localTime"] =
            res["events"][i]["dates"]["start"]["localTime"];
        } else {
          useful[i.toString()]["localTime"] = "";
        }

        if (
          "images" in res["events"][i] &&
          res["events"][i]["images"].length > 0 &&
          "url" in res["events"][i]["images"][0]
        ) {
          useful[i.toString()]["images"] = res["events"][i]["images"][0]["url"];
        } else {
          useful[i.toString()]["images"] = "";
        }

        if ("name" in res["events"][i]) {
          useful[i.toString()]["name"] = res["events"][i]["name"];
        } else {
          useful[i.toString()]["name"] = "";
        }

        if (
          "classifications" in res["events"][i] &&
          res["events"][i]["classifications"].length > 0 &&
          "segment" in res["events"][i]["classifications"][0] &&
          "name" in res["events"][i]["classifications"][0]["segment"]
        ) {
          useful[i.toString()]["segment"] =
            res["events"][i]["classifications"][0]["segment"]["name"];
        } else {
          useful[i.toString()]["segment"] = "";
        }

        if (
          "_embedded" in res["events"][i] &&
          "venues" in res["events"][i]["_embedded"] &&
          res["events"][i]["_embedded"]["venues"].length > 0 &&
          "name" in res["events"][i]["_embedded"]["venues"][0]
        ) {
          useful[i.toString()]["ven_name"] =
            res["events"][i]["_embedded"]["venues"][0]["name"];
        } else {
          useful[i.toString()]["ven_name"] = "";
        }

        if ("id" in res["events"][i]) {
          useful[i.toString()]["event_ID"] = res["events"][i]["id"];
        } else {
          useful[i.toString()]["event_ID"] = "";
        }

        if (Object.keys(useful[i.toString()]).length != 0) {
          num += 1;
        } else {
          delete useful[i.toString()];
        }
      } else {
        break;
      }
    }
  }
  if (Object.keys(useful).length != 0) {
    useful["exist"] = 1;
  } else {
    useful["exist"] = 0;
  }

  return useful;
}

// Start the server
const PORT = parseInt(process.env.PORT) || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log("Press Ctrl+C to quit.");
});
// [END gae_node_request_example]

module.exports = app;
