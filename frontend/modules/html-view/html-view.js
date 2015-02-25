require('angular').module('html-view', ['window'])
  .directive('htmlView', [function htmlViewDirective() {
    return {
      templateUrl: 'html-view/html-view.template',
      restrict: 'AE',
      scope: false,
      replace: true,
      controller: 'htmlViewController',
      link: function($scope, $element, $attrs) {
        $scope.$element = $element;
      }
    };
  }])
  .controller('htmlViewController', ['$scope', '$compile', 'htmlView',
      function htmlViewController($scope, $compile, htmlView) {
    htmlView.display = function(directive, windowOption) {
      var directive = angular.element(
        '<app-window' +
        ' app-window-content="' + directive + '"' +
        '></app-window>');
      $scope.$element.append(directive);
      $compile(directive)($scope);
    }
  }])
  .service('htmlView', [function htmlViewService() { return {}; }]);

module.exports = 'html-view';