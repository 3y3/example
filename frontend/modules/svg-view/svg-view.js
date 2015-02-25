require('angular').module('svg-view', ['window'])
  .service('svg-view', [function() {
    return {};
  }])
  .directive('svgView', [function() {
    return {
      templateUrl: 'svg-view/svg-view.template',
      restrict: 'AE',
      scope: true,
      replace: true,
      controller: 'appSvgViewController'
    };
  }])
  .controller('appSvgViewController', [
      '$scope', 'xmls', 'svg-view',
      function($scope, xmls, service) {
    Object.defineProperty($scope, 'svgClasses', {
      get: function() {
        return service.classes.join(' ');
      }
    });
    service.classes = [];
    xmls.forEach(function(xml, num) {
      xml.on('loaded', function(state) {
        if (state == 'ready') {
          var type = [
            COPROC_TYPE.IEC104,
            COPROC_TYPE.IEC61850,
            'ETH'
          ].indexOf(xml.type) > -1 ? 'ETH' : '485';
          service.classes.push('P' + num + '-' + type);
        }
      });
    });

    $scope.click = function($event, xml) {
      $scope.state.close();
      //delete $scope.state.activeCoproc;
      setTimeout(function() {
        $scope.state.open({
          show: 'coproc',
          activeCoproc: xml.num
        });
        $scope.$apply();
      });
    };
  }]);
module.exports = 'svg-view';
