/**
 * Created by felix on 27.08.16.
 */
(function() {
  "use strict";
  angular.module('crate-spade').directive('releaseThumb', function() {
    return {
      restrict:    'A',
      replace:     true,
      scope:       {
        releaseThumb: '=?',
        active:       '=?'
      },
      templateUrl: 'templates/release-thumb.tpl.html',
      link:        function(scope, el, attr) {
        var placeholderThumb = 'https://s.discogs.com/images/default-release.png';
        scope.thumb = scope.releaseThumb.basic_information.thumb || placeholderThumb;
        // if (scope.releaseThumb._metadata && scope.releaseThumb._metadata.spotifyAlbum &&
        //   scope.releaseThumb._metadata.spotifyAlbum.images) {
        //   scope.thumb = scope.releaseThumb._metadata.spotifyAlbum.images[1].url;
        // }
      }
    };
  });
}());
