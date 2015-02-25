var EventEmitter = require('events').EventEmitter,
    inherits = require('util').inherits,
    extend = require('util')._extend,
    Device = require('./device'),
    Coproc = require('../coproc/coproc.js'),
    xmls = require('xmls'),
    proxy = require('proxy').proxy,
    point = require('proxy').point;

var devicesControl = {
  toggleProtocolOptions: function() {
    if (this.state.editProtocol)
      this.state.back();
    else
      this.state.open({ show: 'protocol', editProtocol: true });
  },
  newDevice: function() {
    this.state.open({
      show: 'device',
      exit: function(remove) {
        if (remove) this.device.remove();
      },
      title: this.state.title.concat({
        title: 'НОВОЕ УСТРОЙТВО'
      }),
      device: this.state.protocol.newDevice(),
      editDevice: true
    });
  },
  addDevice: function(device) {
    this.state.protocol.devices.push(device);
    this.state.back();
  },
  openDevice: function(device) {
    this.state.open({
      show: 'device',
      exit: function(remove) {
        if (remove) this.device.remove();
      },
      title: this.state.title.concat({
        title: 'РЕДАКТИРОВАТЬ УСТРОЙСТВО',
        info: device.model.Desc.value,
      }),
      device: device,
      editDevice: true
    });
  },
  deleteDevice: function(device) {
    device.remove();
    this.state.back();
  }
};

angular.module('devices', [Device._name])
  .directive('appDevicesMenuItem', [function() {
    return {
      scope: true,
      restrict: 'EA',
      replace: true,
      templateUrl: 'devices/devices-menu-item.template',
      link: function($scope) {
        $scope.title = 'Устройства';
        $scope.click = function($event, item) {
          $scope.state.open({
            show: 'tab',
            activeMenuTab: 'devices'
          });
        };
      }
    };
  }])
  .directive('appInputDevices', ['$compile', function($compile) {
    return {
      scope: false,
      restrict: 'EA',
      replace: true,
      templateUrl: 'devices/devices.template',
      link: function($scope) {
        var devices = _instance[$scope.state.activeCoproc];
        extend($scope, devicesControl);
        extend($scope.window, {
          style: {
            left: '17em'
          }
        });
        $scope.state.open({
          show: 'devices',
          protocol: devices.protocols[devices.type],
          editProtocol: false,
          title: $scope.state.title.concat({
            title: 'Устройства'
          })
        });
      }
    };
  }])
  .directive('appOutputDevices', ['$compile', function($compile) {
    return {
      scope: false,
      restrict: 'EA',
      replace: true,
      templateUrl: 'devices/devices.template',
      link: function($scope) {
        var devices = _instance[$scope.state.activeCoproc];
        extend($scope, devicesControl);
        extend($scope.window, {
          style: {
            left: '17em'
          }
        });
        $scope.state.open({
          show: 'devices',
          protocol:  devices.protocols[devices.type],
          title: $scope.state.title.concat({
            title: 'Направления ретрансляции'
          })
        });
      }
    };
  }])
  .directive('appTypeDevices', ['$compile', function($compile) {
    return {
      scope: true,
      restrict: 'EA',
      replace: true,
      templateUrl: 'devices/type-devices.template',
      link: function($scope) {
        $scope.openTypeDevice = function(device) {
          this.state.open({
            show: 'typedevice',
            typeDevice: device,
            editTypeDevice: true,
            title: this.state.title.slice(0, -1).concat({
              title: this.state.title.slice(-1).title,
              info: device.model.Desc.value
            })
          });
        }
      }
    };
  }]);

var _instance = {};
inherits(Devices, EventEmitter);
function Devices(parent) {
  if (_instance[parent.num]) return _instance[parent.num];

  var name = module.exports._name;
  var num = parent.num;

  this.num = num;
  this.type = parent.type;
  this.role = parent.role;
  this.parent = parent;
  parent.modules[name] = this;

  this.content = 'app-' + name;
  this.menu = 'app-' + name + '-menu-item';

  this.protocols = {};
  PROTOCOLS_PER_COPROC_TYPE_ROLE[this.type][this.role].forEach(function(type) {
    this.protocols[type] = new Protocol(this.num, type, this.role);
  }, this);

  _instance[this.num] = this;
}

Devices.prototype.remove = function() {
  var name = module.exports._name;
  Object.keys(this.protocols).forEach(function(key) {
    this.protocols[key].remove();
  }, this);
  this.protocols = null;
  this.parent.modules[name] = null;
  this.parent = null;
  delete _instance[this.num];
  delete this;
};

Devices.prototype.prepareToSave = function(done) {
  var protocols = this.protocols,
      type = this.type,
      role = this.role;

  var prepareToSave = function(index) {
    var item = protocols[PROTOCOLS_PER_COPROC_TYPE_ROLE[type][role][index]];
    if (item) {
      item.prepareToSave(function(error, result) {
        if (error) return setTimeout(done, 0, error);

        prepareToSave(index+1);
      }.bind(this));
    } else setTimeout(done, 0);
  }.bind(this);

  prepareToSave(0);
};

module.exports = Devices;
module.exports._name = 'devices';

function Protocol(num, type, role) {
  this.num = num;
  this.type = type;

  this.role = role;

  Protocol[type][role].call(this);

  this.devices = [];
  this.devicesCache = {};

  this.model.forEach(proxy, this);
  this.devices = this.model.devices.value;
}

Protocol.prototype = {
  toggleDeviceState: function(device) {
    device.state = device.state == 'selected' ? '' : 'selected';
  },
  get hasSelectedDevices() {
    return this.devices.some(function(device) {
      return device.state == 'selected';
    });
  },
  selectionCopy: function() {},
  selectionCancel: function() {
    this.devices.forEach(function(device) {
      device.state = '';
    });
  },
  selectionRemove: function() {
    this.devices.slice().forEach(function(device) {
      if (device.state === 'selected') {
        device.remove();
      }
    });
  },
  remove: function() {
    this.devices.slice().forEach(function(device) {
      device.remove();
    });
    this.devices = null;
    this.model = null;
    this.node = null;
    delete this;
  },
  prepareToSave: function(done) {
    var prepareToSave = function(item) {
      if (item) {
        item.prepareToSave(function(error, result) {
          if (error) return setTimeout(done, 0, error);

          var index = this.devices.indexOf(item);
          prepareToSave(this.devices[index+1]);
        }.bind(this));
      } else setTimeout(done, 0)
    }.bind(this);

    prepareToSave(this.devices[0]);
  },
  newDevice: function() {
    return new Device(this, null, {
      Name: this.model.Name.value + '_' + this.nextDeviceUID
    });
  },
  get nextDeviceUID() {
    return this.devices.reduce(function(UID, item) {
      return item.model.UID.value > UID ? item.model.UID.value : UID;
    }, 0) + 1;
  }
};

Protocol[COPROC_TYPE.IEC104] = {};
Protocol[COPROC_TYPE.IEC104]['INPUT'] = function() {
  this.nodeName = 'Protocols';
  this.node = xmls[this.num].document;
  this.devicesLimit = 16;

  this.model = [
    { name: 'Name',
      type: 'private',
      get: function() {
        return this.num + '_' + this.type;
      }
    },
    { name: 'devices',
      target: ':scope>Protocols',
      type: 'list',
      Subitem: ':scope>Protocol[type="' + this.type + '"][role="Client"]',
      Subclass: Device
    }
  ];
};
Protocol[COPROC_TYPE.IEC104]['OUTPUT'] = function() {
  this.nodeName = 'Protocols';
  this.node = xmls[this.num].document;
  this.devicesLimit = 5;

  this.model = [
    { name: 'Name',
      type: 'private',
      get: function() {
        return this.num + '_' + this.type;
      }
    },
    { name: 'devices',
      target: ':scope>Protocols',
      type: 'list',
      Subitem: ':scope>Protocol[type="' + this.type + '"][role="Server"]',
      Subclass: Device
    }
  ];
};

Protocol[COPROC_TYPE.IEC101] = {};
Protocol[COPROC_TYPE.IEC101]['INPUT'] = function() {
  this.nodeName = 'Protocol';
  this.node = point(xmls[this.num].document, ':root>Protocols>Protocol[type="' + this.type + '"]');
  this.devicesLimit = 20;

  this.model = [
    { name: 'Name',
      type: 'private',
      get: function() {
        return this.num + '_' + this.type;
      }
    },
    { name: 'Type',
      target: ':scope',
      type: 'attribute',
      attribute: 'type',
      default: 'IEC104'
    },
    { name: 'Role',
      target: ':scope',
      type: 'attribute',
      attribute: 'role',
      default: 'Master'
    },
    { name: 'Device',
      target: ':scope>Device',
      type: 'tag',
      default: 'UART0'
    },
    { name: 'devices',
      target: ':scope',
      type: 'list',
      Subitem: ':scope>AbonentsList>Abonent',
      Subclass: Device
    },
    { name: 'BaudRate',
      target: ':scope>BaudRate',
      type: 'tag',
      default: '9600',
      options: [
        {name: '9600', value: '9600'},
        {name: '14400', value: '14400'},
        {name: '28800', value: '28800'},
        {name: '57600', value: '57600'},
        {name: '115200', value: '115200'},
        {name: '460800', value: '460800'}
      ]
    },
    { name: 'ChanAddr',
      target: ':scope>ChanAddr',
      type: 'tag'
    }
  ];
};
Protocol[COPROC_TYPE.IEC101]['OUTPUT'] = function() {
  this.nodeName = 'Protocol';
  this.devicesLimit = 5;

  this.model = [
    { name: 'Name',
      type: 'private',
      get: function() {
        return this.num + '_' + this.type;
      }
    },
    { name: 'Type',
      target: ':scope>Type',
      type: 'tag',
      default: 'Telnet'
    },
    { name: 'Device',
      target: ':scope>Device',
      type: 'tag',
      default: 'UART0'
    },
    { name: 'devices',
      target: ':scope',
      type: 'list',
      Subitem: ':scope>AbonentsList>Abonent',
      Subclass: Device
    }
  ];
};
