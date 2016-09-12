/**
 * Created by felix on 29.08.16.
 */
angular.module('crate-spade.collection', ['pouchdb', 'diff'])
  .filter('musicKey', function() {
    var keys = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    return function(value) {
      return keys[value];
    };
  })
  .filter('musicMode', function() {
    var modes = ['Minor', 'Major'];
    return function(value) {
      return modes[value];
    };
  })
  .factory('Collection', function($q, $http, $filter, $interval, $timeout, $sce, $log, pouchDB) {
    //POUCH TEST
    // PouchDB.debug.enable('*');
    PouchDB.debug.disable();
    var db = pouchDB('collection');
    
    function error(err) {
      $log.error(err);
    }
    
    function get(res) {
      if (!res.ok) {
        return error(res);
      }
      return db.get(res.id);
    }
    
    //POUCH TEST END
    
    function getReleaseCache() {
      // return JSON.parse(window.localStorage.getItem('disjockey.releaseCache'));
      return db.get('disjockey.releaseCache').then(function(releaseCache) {
        return releaseCache;
      }).catch(function(err) {
        return {
          _id:      'disjockey.releaseCache',
          releases: []
        };
      });
    }
    
    //https://gist.github.com/andrei-m/982927
    var levenshtein = function(a, b) {
      if (!a || !b) {
        return (a || b).length;
      }
      var m = [];
      for (var i = 0; i <= b.length; i++) {
        m[i] = [i];
        if (i === 0) {
          continue;
        }
        for (var j = 0; j <= a.length; j++) {
          m[0][j] = j;
          if (j === 0) {
            continue;
          }
          m[i][j] =
            b.charAt(i - 1) == a.charAt(j - 1) ? m[i - 1][j - 1] : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i -
              1][j] + 1);
        }
      }
      return m[b.length][a.length];
    };
    var simplifyTrackTitle = function(title) {
      title = title.toLowerCase();
      title = title.split('feat.')[0];
      // title = title.split('(')[0];
      // title = title.split('-')[0];
      // title = title.split('[')[0];
      // title = title.split('-')[0];
      return title;
    };
    var stringDifference = function(a, b) {
      return levenshtein(simplifyTrackTitle(a), simplifyTrackTitle(b))
    };
    var stringSimilarity = function(a, b) {
      var lev = stringDifference(a, b);
      var len = Math.max(a.length, b.length);
      return (len - lev) / len * 100;
    };
    
    var titleDiff = function(titleA, titleB) {
      return $filter('diff')(titleA.toLowerCase(), titleB.toLowerCase());
      // return diff ? diff.toUpperCase() : '';
    };
    
    var foreignValue = function(array, index, property) {
      if (!array || index >= array.length || !property) {
        return false;
      }
      return array[index][property];
    };
    
    var getForeignMatch = function(array, property, ideal, treshold) {
      var best = -1, similarity = 0, current;
      if (!array) {
        return {}
      }
      array.forEach(function(el, index) {
        current = stringSimilarity(ideal, el[property]);
        if (current > similarity) {
          similarity = current;
          if (similarity > best) {
            best = index;
          }
        }
      });
      return {
        index:      best,
        value:      array[best][property],
        similarity: similarity,
        accept:     treshold ? similarity >= treshold : undefined
      };
    };
    
    // var trackCache = getTrackCache() || [];
    
    var releaseCache = [];
    getReleaseCache().then(function(releases) {
      releaseCache = releases;
    }).catch(function(err) {
      console.error('could not get release cache', err);
    });
    
    // $log.debug('release cache init ', releaseCache);
    return {
      stringSimilarity:          stringSimilarity,
      getReleaseCache:           getReleaseCache, // getCachedTracks:         getTrackCache,
      cacheUserToken:            function(username, token) {
        if (username) {
          window.localStorage.setItem('disjockey.username', username); //TODO use pouch
        }
        if (token) {
          window.localStorage.setItem('disjockey.token', token);
        }
      },
      getUserTokenCache:         function() {
        return {
          username: window.localStorage.getItem('disjockey.username'),
          token:    window.localStorage.getItem('disjockey.token')
        };
      },
      getCachedRelease:          function(releaseID) {
        return releaseCache.releases.find(function(release) {
          return release.id === releaseID;
        });
      },
      stripRelease:              function(release) {
        /*release = pickValues({
         'self':              [
         'instance_id', 'rating', 'folder_id', 'date_added', 'id', '_metadata'],
         'basic_information': ['thumb', 'artists', 'year', 'id']
         
         });*/
        return release;
      },
      combineDiscogsWithSpotify: function(discogsRelease, spotifyAlbum, meta) {
        console.debug('combine ', discogsRelease, spotifyAlbum, meta);
        meta = meta || {};
        if (!spotifyAlbum && !discogsRelease) {
          console.warn('could not merge albums, malicious data', discogsRelease, spotifyAlbum);
          return [];
        }
        var merged = [], matchTreshold = 75, foreignMatch;
        var spotifyTracks = spotifyAlbum && spotifyAlbum.tracks ? spotifyAlbum.tracks.items : null;
        var discogsTracks = meta.tracklist || [];
        discogsTracks = discogsTracks.filter(function(track) {
          return track.type_ === 'track';
        });
        discogsTracks.forEach(function(discogsTrack, index) {
          foreignMatch = getForeignMatch(spotifyTracks, 'name', discogsTrack.title, matchTreshold);
          merged.push({
            discogsTitle:  discogsTrack.title,
            spotifyTitle:  foreignMatch.value,
            discogsArtist: discogsRelease && discogsRelease.basic_information &&
                           discogsRelease.basic_information.artists.length ? discogsRelease.basic_information.artists[0].name : 'N/A',
            spotifyArtist: spotifyAlbum && spotifyAlbum.artists &&
                           spotifyAlbum.artists.length ? spotifyAlbum.artists[0].name : 'N/A',
            discogsAlbum:  discogsRelease &&
                           discogsRelease.basic_information ? discogsRelease.basic_information.title : 'N/A',
            spotifyAlbum:  spotifyAlbum && spotifyAlbum.name,
            foreignMatch:  foreignMatch
          });
        });
        merged.forEach(function(track, index) {
          if (track.discogsTitle && track.spotifyTitle) {
            track.titleDiff = titleDiff(track.spotifyTitle, track.discogsTitle);
          }
          if (meta && meta.audioFeatures) {
            //TODO add mapping for manual tempo edits like meta._tempos=[0:120,2:220] <= this overwrites first and third
            // => spotify tempo then will be ignored...
            track.audioFeatures = /*track.foreignMatch.accept &&*/
              track.foreignMatch.index <=
              meta.audioFeatures.length ? meta.audioFeatures[track.foreignMatch.index] : null;
            track.tempo = track.audioFeatures ? track.audioFeatures.tempo : '';
            track.meta = meta;
          }
          track.position = index < discogsTracks.length ? discogsTracks[index].position : index + 1;
        });
        return merged;
      },
      getAllTracks:              function() {
        var self = this;
        return getReleaseCache().then(function(releaseCache) {
          var tracks = [];
          releaseCache.releases.forEach(function(release) {
            if (release._metadata && release._metadata.spotifyAlbum && release._metadata.audioFeatures) {
              var merged = self.combineDiscogsWithSpotify(release, release._metadata.spotifyAlbum, release._metadata);
              // tracks.concat(merged);
              merged.forEach(function(track) {
                tracks.push(track);
              });
            }
          });
          return tracks;
        });
      },
      syncReleases:              function(releases, overwrite) {
        if (!releases) {
          throw new Error('no releases to sync!');
        }
        var self = this;
        return getReleaseCache().then(function(releaseCache) {
          return releaseCache;
        }).then(function(releaseCache) {
          var cached, index;
          releases.data.releases.forEach(function(release) {
            release = self.stripRelease(release);
            cached = self.getCachedRelease(release.id);
            if (!cached) {
              releaseCache.releases.push(release);
            } else if (overwrite) {
              index = releaseCache.releases.indexOf(cached);
              releaseCache.releases[index] = self.stripRelease(release);
            }
          });
          db.put(releaseCache);
          return releaseCache.releases;
        }).catch(function(err) {
          console.error('error syncing releases', err);
        });
      },
      syncReleaseWithMetadata:   function(release, data) {
        return getReleaseCache().then(function(cachedReleases) {
          var _release = cachedReleases.releases.find(function(r) {
            return r.id === release.id;
          });
          if (!_release) {
            throw new Error('could not sync release! not in collection!', release);
          }
          // _release._metadata = data;
          _release._metadata = data;
          return db.put(cachedReleases);
        });
      },
      cacheReleaseDetails:       function(release) {
        //TODO
        $log.debug('cache release details', release);
      },
      findDiscogsTrackInCache:   function(discogsTrackID) {
        return trackCache.find(function(track) {
          return track.discogsTrackID === discogsTrackID;
        });
      },
      getAllReleases:            function(username, token, perPage) {
        var self = this;
        this.cacheUserToken(username, token);
        return $http.get('https://api.discogs.com/users/' + username + '/collection/folders/0/releases?token=' + token +
          '&per_page=' + perPage || 50).then(function(releases) {
          return self.syncReleases(releases);
        });
      },
      getCompactRelease:         function(release) {
        release = release.data;
        release = {
          id:               release.id,
          title:            release.title,
          artists:          release.artists,
          tracklist:        release.tracklist,
          estimated_weight: release.estimated_weight,
          genres:           release.genres,
          styles:           release.styles,
          identifiers:      release.identifiers,
          labels:           release.labels,
          master_id:        release.master_id,
          notes:            release.notes,
          released:         release.released,
          year:             release.year
        };
        return release;
      },
      getDiscogsRelease:         function(releaseID, noCache) {
        var deferred = $q.defer();
        // $log.debug('get release', releaseID);
        var self = this;
        var cachedRelease = JSON.parse(window.localStorage.getItem('disjockey.release.' + releaseID));
        if (!noCache && cachedRelease) {
          // $log.debug('... using cache');
          deferred.resolve(cachedRelease);
        } else {
          // $log.debug('... using api');
          $http.get('https://api.discogs.com/releases/' + releaseID).then(function(release) {
            release = self.getCompactRelease(release);
            deferred.resolve(release);
          }).catch(function(err) {
            console.error('failed to get release ', releaseID, err);
            deferred.reject();
          });
        }
        return deferred.promise;
      },
      getDiscogsTracklists:      function(releases) {
        //TODO eliminate or use again
        var deferred = $q.defer();
        // $log.debug('get tracklists', releases);
        var releaseMappings = [];
        var tracklists = {};
        var self = this;
        releases.forEach(function(release, n) {
          $timeout(function() {
            $log.debug('release', n);
            releaseMappings.push(self.getDiscogsRelease(release.id));
            if (n === releases.length - 1) {
              Promise.all(releaseMappings).then(function(mappings) {
                $log.debug('got mappings', mappings);
                mappings.forEach(function(mapping, n) {
                  if (mapping) {
                    tracklists[mapping.id] = mapping;
                  } else {
                    console.warn('mapping undefined...');
                  }
                });
                $log.debug('got tracklists of ', releases.length, 'releases:', tracklists);
                deferred.resolve(tracklists);
              });
            }
          }, n * 300);
          // releaseMappings.push(self.getDiscogsRelease(release.id));
        });
        return deferred.promise;
      },
      albumCoreData:             function(a, noTracklist) {
        return {
          artist:    a.artists.length ? a.artists[0].name : '',
          album:     a.title,
          tracklist: !noTracklist ? a.tracklist : []
        };
      }
    };
  });