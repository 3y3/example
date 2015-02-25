module.exports = angular.module('app', [
  require('xmls')._name
, require('menu')._name
, require('templates')
, require('./window')
, require('./coproc')._name
, require('./svg-view')
, require('./html-view')
, require('./devices')._name
])
.directive('ngRightClick', ['$parse', function($parse) {
  return function(scope, element, attrs) {
    var fn = $parse(attrs.ngRightClick);
    element.bind('contextmenu', function(event) {
      scope.$apply(function() {
        event.preventDefault();
        fn(scope, {$event:event});
      });
    });
  };
}])
.directive('ngFilter', ['$filter', function($filter) {
  return {
    require: 'ngModel',
    link: function($scope, __, $attrs, modelCtrl) {
      var filter = $filter($attrs['ngFilter']);
      modelCtrl.$parsers.push(function(input) {
        var transformed = filter(input);
        if (input!==transformed) {
          modelCtrl.$setViewValue(transformed);
          modelCtrl.$render();
        }
        return transformed;
      });
    }
  }
}])
.directive('swalPrompt', [function() {
  return {
    restrict: 'EA',
    replace: true,
    scope: false,
    template: '<div>'
            +   '<div class="sweet-alert showSweetAlert visible" tabindex="-1" style="display:block">'
            +     '<h2 ng-if="title">{{title}}</h2>'
            +     '<p ng-if="text">{{text}}</p>'
            +     '<div ng-if="prompt"><input class="swal-prompt-input" type="text" ng-model="prompt.result"/></div>'
            +     '<button class="cancel" tabindex="2" ng-if="buttonCancel" ng-click="cancel()">{{buttonCancel}}</button>'
            +     '<button class="confirm" tabindex="1" ng-if="buttonOk" ng-click="submit()">{{buttonOk}}</button>'
            +   '</div>'
            + '</div>'
  }
}]);