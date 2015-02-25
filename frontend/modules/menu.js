angular.module('menu', [])
  .factory('menu', [function() { return new Menu(); }])
  .directive('appMenu', [function() {
    return {
      restrict: 'EA',
      replace: true,
      template: '<ul id="menu" class="" ng-controller="menu"></ul>',
      link: function($scope, $element) {
        $scope.$element = $element;
      },
      controller: 'menu'
    }
  }])
  .controller('menu', ['$scope', '$compile', 'menu', function($scope, $compile, menu) {
    menu.update = function(modules) {
      menu.clear();
      modules.forEach(function(module) {
        var directive = module.menu;
        var template = '<' + directive + '></' + directive + '>';
        var element = $compile(template)($scope);
        $scope.$element.append(element);
      });
    };
    menu.clear = function() {
      $scope.$element.children().remove();
      while($scope.$$childHead) {
        $scope.$$childHead.$destroy();
      }
    };
  }]);

var _instance;
function Menu() { if (_instance) return _instance;
  _instance = this;
}

module.exports = Menu;
module.exports._name = 'menu';
