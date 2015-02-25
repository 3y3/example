var EventEmitter = require('events'),
    inherits = require('util').inherits,
    extend = require('util')._extend;

inherits(XML, EventEmitter);
function XML(num, state) {
  this.num = num;
  this._type = '';
  this.state = state || 'loading';
}

Object.defineProperties(XML.prototype, {
  type: {
    get: function() {
      return this._type ||
        (this._type = this.document.attributes['prm_type'].value);
    }
  },
  empty: {
    value: function() {
      this.document = null;
      this.type = null;
      this.role = null;
      this.state = 'empty';
      this.emit('loaded', this.state);
    }
  },
  update: {
    value: function(document) {
      this.document = document;
      this.state = 'ready';
      this.emit('loaded', this.state);
    }
  },
  serialize: {
    value: function() {
      var serializer = new XMLSerializer();
      var xmlstr = '<?xml version="1.0" encoding="utf-8"?>' +
                    serializer.serializeToString(this.document)
                      .replace(/\r|\n|\t/gim, '')
                      .replace(/(<.*?>)\s+(<.*?>)/g, '$1$2')
                      .replace(/(<.*?>)\s+(<.*?>)/g, '$1$2')
                      .replace(/ xmlns=".*?"/g, '')
                      .replace(/<!--.*?-->/g, '')
                      .split(/(<.*?>)/)
                      .filter(function(e) {return e;})
                      .map(function(e, i, a) {
                          if (/^<[^/].*[^/]>$/.test(e)) {//<tag>
                            e = '\r\n' + Array(++this.tab).join('\t') + e;
                          }
                          if (/^<\//.test(e)) {//</tag>
                            if (/^<\/|\/>$/.test(a[i-1]))
                              e = '\r\n' + Array(this.tab).join('\t') + e;
                            this.tab--
                          }
                          if (/\/>$/.test(e)) //<tag/>
                            e = '\r\n' + Array(this.tab + 1).join('\t') + e;
                          return e;
                        }, { tab: 0 })
                      .join('')
                      .replace(/^\r\n/, '');
      return new Blob([xmlstr], {type: 'text/xml; charset=utf-8'});
    }
  }
});

var xmls = Array.apply(null, new Array(12)).map(function(_, i) {
  return new XML(i);
});

require('angular')
  .module('xmls', [require('globals')])
    .factory('xmls', ['$http', '$q', 'globals', function($http, $q, globals) {
      var global = {};
      xmls.forEach(function(xml, num) {
        xml.on('loaded', function(state) {
          if (state == 'ready') {
            xml.type = this.document.getAttribute('prm_type');
            xml.role = this.document.getAttribute('prm_role');
          } else {
          }
        });
        xml.save = function(done) {
          var data = new FormData();
          data.append('config', this.serialize(), 'config.xml');
          var params = '?type=' + (num == 0 ? 'cfg' : num == 11 ? 'typedevices' : 'coproc' + '&num=' + num);
          $http.post('/~cfg_save_xml' + params, data, {
            transformRequest: angular.identity,
            headers: {'Content-Type': undefined}
          })
            .success(function(result) {
              xml.emit('saved', true);
              done(null, result);
            })
            .error(function(error) {
              xml.emit('saved', false);
              done(error);
            });
        };
        xml.ask = function(done) {
          done = done || function(error, result) {
            if (error) console.error('Unexpected error in xml.ask', error);
          }
          if (global.device !== "TM3COM" && num > 0) {
            return done(new Error('NOEXTRACONFIG', 'Дополнительные конфигурации для данного устройства не доступны.'));
          }
          var xml = xmls[num];
          var params = '?type=' + (num == 0 ? 'cfg' : num == 11 ? 'typedevices' : 'coproc' + '&num=' + num);
          $http.get('/~cfg_ask_xml' + params, { responseType: 'document' })
            .success(function(document) {
              xml.update(document.documentElement);
              done(null, xml.document);
            })
            .error(function(error) {
              xml.empty();
              done(error);
            });
        }
      });
      globals.success(function(_global) {
        extend(global, _global);
        var deferred = $q.defer();
        xmls[0].ask(function(error, result) {
          if (error) deferred.reject(error);
          deferred.resolve();
        });
        deferred.promise.then(function() {
          return [1,2,3,4,5,6,7,8,9,10,11].map(function(num) {
            var deferred = $q.defer();
            xmls[num].ask(function(error, result) {
              if (error) deferred.reject(error);
              deferred.resolve();
            });
            return deferred.promise;
          });
        });
      });
      return xmls;
    }]);

module.exports = xmls;
module.exports._name = 'xmls';