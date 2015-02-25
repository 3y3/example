require('angular').module('window', [])
  .directive('appWindow', ['$compile', function($compile) {
    return {
      scope: true,
      restrict: 'EA',
      replace: true,
      templateUrl: 'window/window.template',
      link: function($scope, $element, $attrs) {
        /* Attrs:
         * app-window-content - Имя внутренней директивы
         */
        $scope.state.open({
          show: 'window',
          title: []
        });
        $scope.window = {};
        
        var body = $element[0].querySelector('.app-window-content-body');
        var content = $attrs.appWindowContent || '';
        var directive = angular.element('<div ' + content + '></div>');

        body.appendChild(directive[0]);
        $compile(directive)($scope);
      }
    }
  }]);

module.exports = 'window';
