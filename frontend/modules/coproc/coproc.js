module.exports = Coproc;
module.exports._name = 'coproc';

var extend = require('util')._extend,
    Devices = require('../devices'),
    xmls = require('xmls'),
    proxy = require('proxy').proxy,
    unproxy = require('proxy').unproxy;

var IGNORE_DEPENDS = true;

WhenXmlsLoaded( InitXmls );

function WhenXmlsLoaded(callback) {
  var state = 0;
  xmls.forEach(function(xml) {
    xml.once('loaded', function() {
      if (++state == 12) callback();
    });
  });
}

function InitXmls() {
  xmls.forEach(function(xml, num) {
    if (xml.state == 'ready') Coproc(num);
  });
}

angular.module('coproc', ['menu'])
  .directive('appCoproc', ['$compile', '$window', 'menu', 'xmls',
      function($compile, $window, menu, xmls) {
    return {
      scope: true,
      restrict: 'EA',
      replace: true,
      templateUrl: 'coproc/coproc.template',
      link: function postLink($scope, $element) {
        menu.update([]);
        var xml = xmls[$scope.state.activeCoproc];
        $scope.xml = xml;

        $scope.display = function(/*context: XML*/) {
          if (this.state == 'ready') {
            var coproc = new Coproc(this.num);
            menu.update(coproc.items);
            if ($scope.active) {
              var template =
                '<app-window' +
                  " app-window-content='" + coproc.modules[$scope.active].content + "'" +
                '></app-window>';
              var directive = $compile(template)($scope);
              var element = $scope.$element[0].querySelector('.coproc');
              angular.element(element).append(directive);
            }
            
            delete $scope.state.displayCoprocTypes;
          } else {
            menu.update([]);
          }
        }
        
        $scope.closeCoproc = function() {
          menu.update([]);
          delete $scope.state.activeCoproc;
          delete $scope.state.activeMenuTab;
        };
        
        if (xmls[11].state == 'loading') {
          xmls[11].once('loaded', init);
        } else init();
        function init() {
          if (xml.state == 'loading') {
            xml.once('loaded', $scope.display);
          } else $scope.display.call(xml, xml.state);
        }
      }
    };
  }])
  .directive('appCoprocMenuItem', ['$q', '$rootScope', '$timeout', 'menu', function($q, $rootScope, $timeout, menu) {
    return {
      scope: false,
      restrict: 'EA',
      replace: true,
      templateUrl: 'coproc/coproc-menu-item.template',
      link: function($scope) {
        $scope.closeCoproc = function() {
          menu.update([]);
          $scope.state.close();
        };
        
        $scope.deleteCoproc = function() {
          var num = $scope.state.activeCoproc;
          var coproc = new Coproc(num);
          var xml = xmls[num];
          $scope.closeCoproc();
          setTimeout(function() {
            coproc.remove();
            xml.empty();
            if (num == 0) {
              var parser = new DOMParser();
              var document = parser.parseFromString('<KIPP_3></KIPP_3>', 'text/xml').documentElement;
              document.setAttribute('prm_type', 'TM3COM');
              document.setAttribute('prm_role', 'OUTPUT');
              xml.update(document);
              Coproc(num);
            }
          }, 0);
        };
        $scope.saveCoproc = function() {
          var state = extend({}, $scope.state);
          var num = $scope.state.activeCoproc;
          $scope.closeCoproc();
          setTimeout(function() {
            var saved = xmls.map(function(xml, num) {
              if (xml.state !== 'ready') return;
              var coproc = new Coproc(num);
              var deferred = $q.defer();
              coproc.prepareToSave(function(error, result) {
                if (error) return deferred.reject(error);
                xml.save(function(error, result) {
                  if (error) return deferred.reject(error);
                  deferred.resolve();
                });
              });
              return deferred.promise;
            });
            $q.all(saved).then(function() {
              WhenXmlsLoaded(function() {
                InitXmls();
                swal({
                  title: 'Сохранение конфигурации',
                  text: 'Конфигурация успешно сохранена.',
                  type: "success"
                });
                $timeout(function() {
                  $rootScope.state = state;
                }, 0);
              });
              xmls.forEach(function(xml, num) {
                if (xml.state == 'ready') Coproc(num).remove(IGNORE_DEPENDS);
                xml.ask();
              });
            }).catch(function(error) {
              swal({
                title: 'Сохранение конфигурации',
                text: 'При сохранении конфигурации произошла ошибка' + error,
                type: "error"
              });
            });
          });
        }
      }
    };
  }])
  .directive('appCoprocTypes', [function() {
    return {
      scope: false,
      restrict: 'EA',
      replace: true,
      templateUrl: 'coproc/coproc-types.template',
      link: function($scope) {
        var coproc = document.querySelector('.tm3com-nav-cfg-' + $scope.state.activeCoproc);
        var coprocR = coproc.getBoundingClientRect();
        
        $scope.state.open({
          show: 'coproc-types',
          title: $scope.state.title.concat({
            title: 'Тип сопроцессора'
          })
        });
    
        $scope.window.style = {
          'display': 'block',
          'top': coprocR.top,
          'left': coprocR.left + coprocR.width/2,
          'transform': 'translate(-50%, calc(-100% - 1em)) scale(0, 0)',
          'transform-origin': 'center bottom'
        };
        
        setTimeout(function() {
          $scope.window.style['transform'] = 'translate(-50%, calc(-100% - 1em)) scale(1, 1)';
          $scope.window.style['transition'] = 'transform .3s';
          $scope.$apply();
        }, 100);
    
        $scope.window.close = $scope.closeCoproc;
        $scope.sections = [
          {
            role: 'INPUT',
            title: 'Прием данных',
            height: '15.5em',
            state: $scope.state.activeCoproc < 8 ? 'expanded' : 'collapsed',
            types: [
              COPROC_TYPE.IEC104,
              COPROC_TYPE.IEC103,
              COPROC_TYPE.IEC101,
              COPROC_TYPE.IEC61850,
              COPROC_TYPE.STRP,
              COPROC_TYPE.MODBUS
            ]
          },
          {
            role: 'OUTPUT',
            title: 'Передача данных',
            height: '15.5em',
            state: 'collapsed',
            types: [
              COPROC_TYPE.IEC104,
              COPROC_TYPE.IEC101,
              COPROC_TYPE.IEC61850
            ]
          }
        ];
        
        // Временно заблокировать некоторые типы
        $scope.isAllowed = function(type) {
          return [COPROC_TYPE.IEC104, COPROC_TYPE.IEC101].indexOf(type) > -1;
        };
        
        $scope.toggleSectionsState = function(section) {
          $scope.sections.forEach(function(section) {
            section.state = 'collapsed';
            section.style = {};
          });
          section.state = 'expanded';
          section.style = {
            height: section.height
          };
        };
        $scope.toggleSectionsState($scope.sections[$scope.state.activeCoproc < 9 ? 0 : 1]);
        
        $scope.typeActivated = function($event, type, role) {
          if (!$scope.isAllowed(type)) return;
          
          var parser = new DOMParser(),
              document = parser.parseFromString('<KIPP_3></KIPP_3>', 'text/xml').documentElement;
            
          var xml = xmls[$scope.state.activeCoproc];
          
          document.setAttribute('prm_type', type);
          document.setAttribute('prm_role', role);
          xml.update(document);
          
          $scope.display.call(xml, xml.state);
        };
      }
    };
  }]);

var _instance = {};

function Coproc(num) {
  if (!(this instanceof Coproc)) return new Coproc(num);
  if (_instance[num]) return _instance[num];

  _instance[num] = this;

  this.num = num * 1;
  this.items = [{
    menu: 'app-coproc-menu-item',
    remove: function() {}
  }];

  if (this.num === 0) {
    this.model = [
      { name: 'Configs',
        target: ':root>Coprocessor',
        type: 'list',
        Subitem: ':scope>Config',
        Subclass: CoprocMock
      },
      { name: 'Type',
        target: ':root',
        type: 'attribute',
        attribute: 'prm_type'
      },
      { name: 'Role',
        target: ':root',
        type: 'attribute',
        attribute: 'prm_role'
      }
    ];
  } else {
    this.model = [
      { name: 'Type',
        target: ':root',
        type: 'attribute',
        attribute: 'prm_type'
      },
      { name: 'Role',
        target: ':root',
        type: 'attribute',
        attribute: 'prm_role'
      },
      { name: 'Tag',
        target: ':root>Config',
        type: 'tag'
      },
      { name: 'Sport',
        target: ':root>Config',
        type: 'attribute',
        attribute: 'sport',
        default: this.num
      },
      { name: 'Load',
        target: ':root>Config',
        type: 'attribute',
        attribute: 'load',
        default: 'sd:\\' + LDR_SOURCE_PER_COPROC_TYPE[xmls[this.num].type]
      },
      { name: 'Config',
        target: ':root>Config',
        type: 'attribute',
        attribute: 'config',
        default: 'sd:\\Config' + this.num + '.xml'
      }
    ];
  }

  this.model.forEach(proxy.bind(this));

  if (this.num == 0) {
    this.configs = this.model.Configs.value;
    this.configs.slice().forEach(function(config) {
      config.remove();
    });
    this.node = this.model.Configs._target;
  } else if (this.num < 11) {
    this.node = this.model.Tag._target;
    Coproc(0).configs.push(this);
  }

  this.modules = {};
  this.type = this.model.Type.value;
  this.role = this.model.Role.value;

  var Items = [Devices];
  
  Items.forEach(function(Item) {
    this.items.push(new Item(this));
  }, this);

  return _instance[num];
}

Coproc.all = function() {
  return Object.keys(_instance).map(function(key) { return _instance[key]; });
};

Coproc.prototype.remove = function(IGNORE_DEPENDS) {
  this.items.slice().forEach(function(item) {
    item.remove();
  });

  if (this.configs){
    !IGNORE_DEPENDS
    && this.configs.slice().forEach(function(config) {
      config.remove();
    });
  } else if (!IGNORE_DEPENDS) {
    var index = Coproc(0).configs.indexOf(this);
    if (index > -1) Coproc(0).configs.splice(index, 1);
  }

  this.model.forEach(unproxy.bind(this));

  xmls[this.num].empty();

  delete this.parent;
  delete this.node;
  delete this.items;
  delete this.configs;
  delete this.modules;
  delete _instance[this.num];
  delete this;
};

Coproc.prototype.prepareToSave = function(done) {
  var prepareToSave = function(item) {
    if (item) {
      item.prepareToSave(function(error, result) {
        if (error) return setTimeout(done, 0, error);
        var index = this.items.indexOf(item);
        prepareToSave(this.items[index+1]);
      }.bind(this));
    } else setTimeout(done);
  }.bind(this);
  prepareToSave(this.items[1]);
}

function CoprocMock(parent, node) {
  if (!(this instanceof CoprocMock)) return new CoprocMock(parent, node);
  this.num = parent.num;
  this.parent = parent;
  this.node = node;
  this.model = [
    { name: 'Sport',
      target: ':scope',
      type: 'attribute',
      attribute: 'sport'
    },
    { name: 'Load',
      target: ':scope',
      type: 'attribute',
      attribute: 'load'
    },
    { name: 'Config',
      target: ':scope',
      type: 'attribute',
      attribute: 'config'
    }
  ];
  this.model.forEach(proxy.bind(this));
  return this;
}

CoprocMock.prototype.remove = function() {
  this.model.forEach(unproxy.bind(this));
  this.node.parentNode.removeChild(this.node);
  this.parent.configs.remove(this);
  delete this.parent;
  delete this.node;
  delete this;
};