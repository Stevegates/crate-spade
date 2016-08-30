var gulp = require('gulp');
var browserSync = require('browser-sync').create();
var sass = require('gulp-sass');
var inject = require('gulp-inject');
var wiredep = require('wiredep').stream;
var filter = require('gulp-filter');
var concat = require('gulp-concat');
var mainBowerFiles = require('gulp-main-bower-files');
var runSequence = require('run-sequence');
var debug = require('gulp-debug');
var $ = require('gulp-load-plugins')({
  pattern: ['gulp-*', 'del']
});
gulp.paths = {
  src:  'src',
  dist: 'dist',
  tmp:  'tmp'
};

gulp.task('build:bowerfiles', function() {
  return gulp.src('./bower.json')
    .pipe(mainBowerFiles({
      overrides: {
        "angular-diff": {
          "main": "angular-diff.js"
        }
      }
    }))
    .pipe(filter(['**/*.js']))
    .pipe(concat('vendor.js'))
    .pipe(gulp.dest("dist/"));
});

gulp.task('build:js', function() {
  return gulp.src(['src/**/*.js'])
    .pipe(concat('app.js'))
    .pipe(gulp.dest('dist/'));
});

gulp.task('copy:assets', function() {
  return gulp.src('src/assets/**/*')
    .pipe(gulp.dest('dist/assets'));
});

gulp.task('inject', function() {
  var injectStyles = gulp.src([
    'dist/**/*.css'], {read: false});
  
  var injectScripts = gulp.src([
    'dist/vendor.js', 'dist/templateCacheHtml.js', 'dist/app.js'], {read: false})
    .pipe(debug());
  
  var injectOptions = {
    addRootSlash: false,
    ignorePath:   ['dist']
  };
  
  var wiredepOptions = {
    directory: 'bower_components',
    overrides: {}
  };
  
  return gulp.src('src/index.html')
    .pipe(inject(injectStyles, injectOptions))
    .pipe(inject(injectScripts, injectOptions))
    .pipe(wiredep(wiredepOptions))
    .pipe(gulp.dest('dist/'));
});

gulp.task('partials', function() {
  return gulp.src('src/**/*.tpl.html')
    .pipe($.minifyHtml({
      empty:  true,
      spare:  true,
      quotes: true
    }))
    .pipe($.angularTemplatecache('templateCacheHtml.js', {
      module:     'crate-spade.templates',
      standalone: true/*,
       transformUrl: function(url) {
       return url;
       }*/
    }))
    .pipe(gulp.dest(gulp.paths.dist));
});

gulp.task('build', function(done) {
  return runSequence(['partials'], ['copy:assets', 'build:js', 'build:bowerfiles', 'sass'], ['inject'], done);
});

gulp.task('rebuild', ['build'], function() {
  browserSync.reload();
});

gulp.task('browser-sync', ['sass', 'build'], function() {
  browserSync.init({
    server: {
      baseDir: 'dist'
    }
  });
});

gulp.task('sass', function() {
  return gulp.src('src/sass/style.scss')
    .pipe(sass({
      includePaths: ['src/scss'],
      onError:      browserSync.notify
    }))
    .pipe(gulp.dest('dist/css'))
    .pipe(browserSync.reload({stream: true}));
});

gulp.task('watch', function() {
  gulp.watch('src/**/*.scss', ['sass']);
  gulp.watch(['src/**/*.html', 'src/**/*.js'], ['rebuild']);
});

gulp.task('serve', ['browser-sync', 'watch']);

gulp.task('default', ['serve']);