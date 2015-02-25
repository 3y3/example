require('angular')
  .module('globals', [])
    .factory('globals', ['$http', function($http) {
      var vars = $http.get('/globals.sht', {
        responseType: 'json'
      });
      return vars;
    }]);
module.exports = 'globals';