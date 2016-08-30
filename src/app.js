'use strict';
angular.module('crate-spade', ['ui.router', 'crate-spade.templates', 'crate-spade.collection'])
  .config(function($locationProvider, $stateProvider, $urlRouterProvider, $logProvider, $compileProvider) {
    $logProvider.debugEnabled(true);
    $locationProvider.html5Mode(false);
    $stateProvider.state('collection', {
      url:     '/',
      views:   {
        'page': {
          controller:  'CollectionCtrl as ctrl',
          templateUrl: 'templates/collection.tpl.html'
        }
      },
      resolve: {
        releaseCache: function(Collection) {
          return Collection.getReleaseCache();
        }
      }
    }).state('tracks', {
      url:     '/tracks',
      views:   {
        'page': {
          controller:  'TracksCtrl as ctrl',
          templateUrl: 'templates/tracks.tpl.html'
        }
      },
      resolve: {
        tracks: function(Collection) {
          return Collection.getAllTracks();
        }
      }
    });
    $urlRouterProvider.otherwise('/');
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|blob|ftp|mailto|chrome-extension):/);
    
  }).controller('TracksCtrl', function($scope, tracks) {
  $scope.tracks = tracks;
}).controller('CollectionCtrl', function($scope, Collection, releaseCache, pouchDB, $sce, $q, $interval, $http, $filter,
  $log) {
  
  $scope.getDownloadLink = function(json) {
    var blob = new Blob([JSON.stringify(json, null, 2)], {type: 'application/json'});
    var url = URL.createObjectURL(blob);
    $log.debug(url);
    return url;
  };
  $scope.placeholderThumb = 'https://s.discogs.com/images/default-release.png';
  var userToken = Collection.getUserTokenCache();
  $scope.username = userToken.username || '';
  $scope.token = userToken.token || '';
  
  var getReleases = function() {
    return Collection.getReleaseCache().then(function(cachedReleases) {
      $scope.releases = cachedReleases.releases;
      $scope.collectionLink = $scope.getDownloadLink($scope.releases);
      return $scope.releases;
    });
  }; //TODO be able to come out without getReleases (move album detail to seperate view with resolve?)
  $scope.releases = releaseCache.releases;
  $scope.collectionLink = $scope.getDownloadLink($scope.releases);
  
  /*  getReleases();*/
  
  $scope.getBpm = Collection.getBpm;
  $scope.getCollection = function(username, token) {
    Collection.getAllReleases(username, token, 400).then(function(releases) {
      $scope.releases = releases;
      $scope.collectionLink = $scope.getDownloadLink($scope.releases);
    }).catch(function(err) {
      console.error('failed to get Releases', err);
    });
  };
  $scope.selectRelease = function(_release) {
    $log.debug('select release', _release);
    Collection.getDiscogsRelease(_release.id).then(function(release) {
      $log.debug('got release', release);
      release._cached = _release;
      $scope.trackMeta = null;
      $scope.logDetail = null;
      $scope.selectedRelease = release;
      $scope.selectedRelease._meta = _release._metadata;
      $scope.selectedRelease.tracklist = _release.basic_information.tracklist || release.tracklist;
      //TODO generate tracklist out of _meta.audioFeatures
      $scope.selectedRelease.thumb = _release.basic_information.thumb;
      $scope.mergedTracks =
        Collection.combineDiscogsWithSpotify($scope.selectedRelease, _release._metadata ? _release._metadata.spotifyAlbum : null, _release._metadata);
      
      $scope.auto = true;
      if ($scope.auto && !$scope.selectedRelease._meta) {
        $scope.getReleaseMeta($scope.selectedRelease).then(function() {
          getReleases().then(function(cachedReleases) {
            $scope.selectRelease(cachedReleases.find(function(r) {
              return r.id === $scope.selectedRelease.id;
            }));
          });
        }).catch(function(err) {
          console.error('Could not get metadata', err);
          
        });
      }
    });
  };
  var getReleaseById = function(id) {
    return $scope.releases.find(function(release) {
      return release.id === id;
    });
  };
  
  var spotifySearchRelease = function(release) {
    return $http.get('https://api.spotify.com/v1/search?q=album:' + release.title + ' artist:' +
      release.artists[0].name + '&type=album').then(function(res) {
      $log.debug('search res', res);
      return res.data.albums.items;
    });
  };
  
  //TODO use in search bar
  var spotifySearchAlbum = function(query) {
    return $http.get('https://api.spotify.com/v1/search?q=album:' + query + '&type=album').then(function(res) {
      $log.debug('search res', res);
      return res.data.albums.items;
    });
  };
  
  var getSpotifyAlbum = function(id) {
    return $http.get('https://api.spotify.com/v1/albums/' + id).then(function(album) {
      return album.data;
    });
  };
  var getAudioFeatures = function(album) {
    var ids = album.tracks.items.reduce(function(ids, track) {
      return ids + (ids.length ? ',' : '') + track.id;
    }, '');
    return $http.get('http://disconest.com/spotifyAudioFeatures?ids=' + ids).then(function(res) {
      return res.data.audio_features;
    });
  };
  var appendAudioFeatures = function(release, features, album, log) {
    $log.debug('release', release, 'features', features);
    log = log || [];
    release.tracklist = release.tracklist.filter(function(track) {
      return track.type_ === 'track';
    });
    /*if (features && features.length !== release.tracklist.length) {
     log.push({
     msg:     'Unterschiedliche Titelanzahl bei Discogs/Spotify. (' + release.tracklist.length + '/' +
     features.length + ')',
     verbose: album
     });
     }*/
    // album._tracks = album.tracks.items
    return Collection.syncReleaseWithMetadata(release._cached, {
      tracklist:     release.tracklist,
      spotifyAlbum:  album,
      audioFeatures: features,
      log:           log
    });
  };
  
  var addAudioFeatures = function(release, album, log) {
    log = log || [];
    return getAudioFeatures(album).then(function(res) {
      $log.debug('got audio features ', res);
      return appendAudioFeatures(release, res, album);
    });
  };
  $scope.fetchReleaseMeta = function(release) {
    $log.debug('fetch meta');
  };
  
  $scope.getReleaseMeta = function(release) {
    $log.debug('get bpm of release', release);
    return spotifySearchRelease(release).then(function(albums) {
      $log.debug('search', albums);
      if (!albums.length) {
        return false;
      }
      return getSpotifyAlbum(albums[0].id);
    }).then(function(album) {
      if (!album) {
        var log = [];
        console.warn('Album nicht auf Spotify');
        log.push({
          msg: 'Album nicht gefunden'
        });
        return appendAudioFeatures(release, null, null, log);
      }
      return addAudioFeatures(release, album);
    });
  };
  
  $scope.nextRelease = function() {
    var currentIndex = $scope.releases.indexOf(getReleaseById($scope.selectedRelease.id));
    if (currentIndex !== -1) {
      $scope.selectRelease($scope.releases[++currentIndex % $scope.releases.length]);
    }
  };
  $scope.previousRelease = function() {
    var currentIndex = $scope.releases.indexOf(getReleaseById($scope.selectedRelease.id));
    if (currentIndex !== -1) {
      $scope.selectRelease($scope.releases[--currentIndex < 0 ? $scope.releases.length - 1 : currentIndex]);
    }
  };
  $scope.unselectRelease = function() {
    $scope.selectedRelease = null;
  };
  $scope.audioFeatures = function() {
    Collection.getAllTracks().then(function(tracks) {
      $scope.tracks = tracks;
    });
  };
  $scope.isSelected = function(release) {
    return $scope.selectedRelease && release.id === $scope.selectedRelease.id;
  };
  
  $scope.showTrackMeta = function(index, track) {
    $log.debug('show track meta', index, track);
    if (!track || !track.meta) {
      return false;
    }
    $scope.trackMeta = {
      track:         track,
      audioFeatures: track.audioFeatures,
      spotifyTrack:  track.foreignMatch //TODO
    };
  };
});