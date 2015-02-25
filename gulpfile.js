var gulp = require('gulp');
var dest = gulp.dest;
var wrap = require('gulp-insert').wrap;
var rename = require('gulp-rename');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var streamify = require('gulp-streamify');
var templateCache = require('gulp-angular-templatecache');
var autoprefixer = require('gulp-autoprefixer');

var source = require('vinyl-source-stream');
var browserify = require('browserify');
//var imagemin = require('gulp-imagemin');

var dst = 'build';
var paths = {
  css: {
    index: {},
    param: [
      'css/*.css',
      '../bower_components/sweetalert/lib/sweet-alert.css',
      'modules/**/*.css'
    ]
  },
  fonts: {
    index: ['icomoon.ttf'],
    param: ['icomoon.ttf']
  },
  other: {
    param: [
      'index.html',
      'globals.sht'
    ]
  }
}

gulp.task('app', ['css'], function() { 
/*COPY FONTS*/
  gulp.src(paths.fonts['param'], {cwd: './frontend/css/fonts'})
      .pipe(dest('./' + dst + '/css/fonts'));
      
  gulp.src(['./**'], {cwd: './frontend/img'})
      .pipe(dest('./' + dst + '/img'));
/*COPY OTHER*/  
  gulp.src(paths.other['param'], {cwd: './frontend'}).pipe(dest('./' + dst));
});

gulp.task('css', function() {
  gulp.src(paths.css['param'], {cwd: './frontend'})
      .pipe(concat('param.min.css'))
      .pipe(autoprefixer({
          browsers: ['last 2 versions'],
          cascade: false
      }))
      //.pipe(uglify())
      .pipe(dest('./' + dst + '/css'));
  global._needsReload = true;
});

gulp.task('bfy-angular', function() {
  var angular = browserify();
  angular.require('./frontend/external.js', {expose: 'angular'});
  angular = angular.bundle();
  angular
    .pipe(source('./external.js'))
    .pipe(dest('./' + dst));
});

gulp.task('bfy-scripts', ['ng-templates'], function() {
  var index;
  index = browserify('./frontend/index.js');
  
  index.external('angular');
  index.external('templates');
  [
    'app',      './frontend/modules/app.js',
    'xmls',     './frontend/modules/xmls.js',
    'menu',     './frontend/modules/menu.js',
    'globals',  './frontend/modules/globals.js',
    'proxy',   './frontend/modules/proxy.js'
  ].forEach(function(link, i, a) {
    if (i%2) index.require(link, {expose: a[i-1]});
  });
  
  index = index.bundle();
  index
    .pipe(source('./index.js'))
    //.pipe(streamify(uglify()))
    .pipe(dest('./' + dst)).on('end', function() {
      global._needsReload = true;
    });
});

gulp.task('ng-templates', function() {
  gulp.src(['modules/**/*.template'], {cwd: './frontend'})
    .pipe(templateCache())
    .pipe(wrap(
      'angular.module("templates", []);\r\n', 
      '\r\nmodule.exports = "templates";'))
    .pipe(dest('./' + dst)).on('end', function() {
      var templates = browserify();
      templates.require('./' + dst + '/templates.js', {expose: 'templates'})
      templates.bundle()
        .pipe(source('./templates.js'))
        .pipe(dest('./' + dst))
        .on('end', function() {
          global._needsReload = true;
        });
    });
});

gulp.task('default', ['bfy-angular', 'bfy-scripts', 'app']);
gulp.task('server', ['default'], function() {
  var server = require(__dirname + '/server.js');
  
  gulp.watch([
      'index.js',
      'modules/*.js',
      'modules/*/**.js'
    ], 
    {cwd: './frontend/'},
    ['bfy-scripts']
  );
  
  gulp.watch([
      'modules/**/*.template'
    ],
    {cwd: './frontend/'},
    ['ng-templates']
  );
  
  gulp.watch(
    paths.css.param, 
    {cwd: './frontend/'}, 
    ['css']
  );
  
  paths.other.param.forEach(function(target) {
    gulp.watch(target, {cwd: './frontend/'}, function() {
      gulp.src(target, {cwd: './frontend'})
        .pipe(dest('./' + dst));
      global._needsReload = true;
    });
  });
});