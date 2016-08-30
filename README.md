# crate-spade
<img src="http://i.imgur.com/3LCkQSA.jpg" alt="Crate Spade Cheap Logo" style="width: 50px;height:50px;float:left"/>
Get metadata for your Discogs record collection! Parses BPM, Key, Mode, Time Signature and much more from the Spotify API.
Based on the idea of [Disconest](http://www.disconest.com/), this app combines Spotify Album Metadata with your whole Discogs Collection. The app is currently in early development, and currently in german language only!

## What you will get:
- Tempo (Beats per minute)
- Time Signature
- Key
- Mode
- Duration
- Danceability
- Energy
- Key
- Loudness
- Speechiness
- Acousticness
- Instrumentalness
- Liveness
- Valence

## How it works
This metadata is provided thanks to the [Spotify Audio Features](https://developer.spotify.com/web-api/get-audio-features/).
CrateSpade will searches each of your Discogs Collections Releases on Spotify (artist/title search) and then automatically matches the Tracks with their coresponding metadata.

## Whats up with the tracks that are not on Spotify?
You will be able to manually fill in (at least) tempo for tracks that cannot be matched on Spotify.

## Feature Progress
- [x] display discogs collection of user
- [x] get metadata for discogs releases
- [x] handle different ordering of tracks in spotify/discogs album
- [ ] be able to manually search spotify album, if no match was found
- [ ] be able to fill in tempo manually, if no match was found
- [ ] be able to tag releases / tracks
- [ ] be able to filter album list
- [ ] filterable track list, that contains all tracks with bpms
- [ ] be able to create set lists
- [ ] english version

## Early Screenshot
Album View with tracklist + bpm:
![Album View](http://i.imgur.com/tS1rM47.jpg)

## Credits
Thanks to:
- [Discogs](https://www.discogs.com/) for the best record library
- [Spotify](https://www.spotify.com/) for the best music metadata API
- [Disconest](http://www.disconest.com/) for the original idea

## Developer?
If you want to participate, feel free to ask :)
