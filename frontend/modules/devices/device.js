var EventEmitter = require('events').EventEmitter,
    Coproc = require('../coproc'),
    Channel = require('./channel'),
    Item = require('./item'),
    inherits = require('util').inherits,
    extend = require('util')._extend,
    proxy = require('proxy').proxy,
    unproxy = require('proxy').unproxy,
    xmls = require('xmls');

function fromDeviceToDevice(from, to) {
  from.channels.forEach(function(channel) {
    var _channel = new Channel(to, null, {
      Name: to.model.Name.value + '_' + to.nextChannelUID,
      _Desc: channel.model.Desc.value,
      FirstChanNum: channel.model.FirstChanNum.value,
      DataType: channel.model.DataType.value,
      GroupNumber: channel.model.GroupNumber.value
    });
    channel.items.forEach(function(item) {
      _channel.items.push(new Item(_channel, null, {
        Name: _channel.model.Name.value + '_' + _channel.nextItemUID,
        Desc: item.model.Desc.value,
        DescString: item.model.DescString.value,
        Cfg: item.model.Cfg.value
      }));
    });
    to.channels.push(_channel);
  });
}



var deviceControl = {

  toggleChannelState: function(channel) {
    channel.state = channel.state == 'selected' ? '' : 'selected';
  },

  toggleParam: function(param) {
    this.state.device.model[param].value = !this.state.device.model[param].value;
  },

  newChannel: function() {
    this.state.open({
      show: 'channel',
      exit: function(remove) {
        if (remove) this.channel.remove();
      },
      editChannel: true,
      channel: this.state.device.newChannel(),
      title: this.state.title.concat({
        title: 'НОВЫЙ КАНАЛ'
      })
    });
  },

  openChannel: function(channel) {
    this.state.open({
      show: 'channel',
      exit: function(remove) {
        if (remove) this.channel.remove();
      },
      editChannel: true,
      channel: channel,
      title: this.state.title.concat({
        title: 'КАНАЛ ДАННЫХ',
        info: channel.model.Desc.value,
      })
    });
  },

  fromTypeDevices: function() {
    var coproc = new Coproc(11, xmls[11].document);
    var typeProtocol = coproc.modules.devices.protocols[this.state.protocol.type];
    this.state.open({
      show: 'typedevices',
      fromTypeDevice: true,
      typeProtocol: typeProtocol,
      title: this.state.title.concat({
        title: 'ИЗ ТИПОВЫХ УСТРОЙСТВ'
      })
    });
  },

  selectTypeDevice: function(typeDevice) {
    this.state.device.channels.forEach(function(channel) {
      channel.remove();
    });

    this.state.device.model.TypeDevice.value = typeDevice.model.Name.value;
    fromDeviceToDevice(typeDevice, this.state.device);

    this.state.close('device');
  },

  saveAsTypeDeviceDialog: function() {
    var prompt = this.$compile('<swal-prompt></swal-prompt>')(
      extend(this.$new(), {
        title: "Новое типовое устройство",
        text: "Имя типового устройства",
        buttonOk: "Подтвердить",
        buttonCancel: "Отмена",
        submit: function() {
          this.saveAsTypeDevice(this.prompt.result);
          prompt.remove();
        },
        cancel: function() {
          prompt.remove();
        },
        prompt: { result: '' }
      }));
    angular.element(document.body).append(prompt);
  },

  saveAsTypeDevice: function(desc) {
    var coproc = new Coproc(11);
    var protocol = coproc.modules.devices.protocols[this.state.device.type];
    var device = protocol.newDevice();
    device.model.Desc.value = desc;

    fromDeviceToDevice(this.state.device, device);

    protocol.devices.push(device);

    this.state.device.model.TypeDevice.value = device.model.Name.value;
  }
};

angular.module('device', [Channel._name])
  .directive('appDevice', ['$compile', function($compile) {
    return {
      scope: true,
      restrict: 'EA',
      replace: true,
      templateUrl: 'devices/device.template',
      link: function($scope) {
        extend($scope, deviceControl);
        $scope.$compile = $compile;
      }
    };
  }])
  .directive('appTypeDevice', [function() {
    return {
      scope: true,
      restrict: 'EA',
      replace: true,
      templateUrl: 'devices/type-device.template',
      link: function($scope) {
        extend($scope, deviceControl);
      }
    };
  }]);

inherits(Device, EventEmitter);
function Device(parent, node, overrides) {
  if (!(this instanceof Device)) return new Device(parent, node);

  this.parent = parent;
  this.num = parent.num;
  this.type = parent.type;
  this.role = parent.role;
  this.node = node;

  Object.defineProperty(this, 'created', {
    get: function() {
      return this.node && !!this.node.parentNode;
    }
  });
  Object.defineProperty(this, 'nextChannelUID', {
    get: function() {
      return this.channels.reduce(function(UID, item) {
        return item.model.UID.value > UID ? item.model.UID.value : UID;
      }, 0) + 1;
    }
  });
  Object.defineProperty(this, 'itemsCount', {
    get: function() {
      return this.channels.reduce(function(count, channel) {
        return count + channel.items.length;
      }, 0);
    }
  });
  Device[this.type][this.role].call(this);

  this.channels = [];
  this.channelsCache = {};

  this.model.forEach(function(item, index, items) {
    proxy.call(this, item, index, items, overrides);
  }, this);
  this.channels = this.model.channels.value;
  this.parent.devicesCache[this.model.Name.value] = this;
}

Device.prototype = {
  remove: function() {
    this.channels.slice().forEach(function(channel) {
      channel.remove();
    });
    var index = this.parent.devices.indexOf(this);
    if (index !== -1) this.parent.devices.splice(index, 1);
    if (this.node.parentNode) this.node.parentNode.removeChild(this.node);

    this.parent.devicesCache[this.model.Name.value] = this;
    this.model.forEach(unproxy, this);

    this.node = null;
    this.model = null;
    this.parent = null;
    delete this;
  },
  prepareToSave: function(done) {
    function prepareToSave(item) {
      if (item) {
        item.prepareToSave(function(error, result) {
          if (error) return done(error);

          var index = this.channels.indexOf(item);
          prepareToSave.call(this, this.channels[index+1]);
        }.bind(this));
      } else done();
    }

    prepareToSave.call(this, this.channels[0]);
  },
  getUID: function() {
    return this.model.Name.value.replace(new RegExp('^' + this.parent.model.Name.value + '_'), '') * 1;
  },
  newChannel: function() {
    return new Channel(this, null, {
      Name: this.model.Name.value + '_' + this.nextChannelUID
    });
  }
};

Device[COPROC_TYPE.IEC104] = {};
Device[COPROC_TYPE.IEC104]['INPUT'] = function() {
  this.nodeName = 'Protocol';
  this.model = [
    { name: 'UID',
      type: 'private',
      get: function() { return this.getUID(); }
    },
    { name: 'Name',
      target: ':scope',
      type: 'attribute',
      attribute: 'name'
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
      default: 'Client'
    },
    { name: '_Desc',
      target: ':scope',
      type: 'attribute',
      attribute: 'desc'
    },
    { name: 'Desc',
      type: 'private',
      get: function() { return this.model._Desc.value ||
        (this.model._Desc.value = 'Новое устройство ' + this.model.UID.value);
      },
      set: function(value) {
        this.model._Desc.value = value;
      }
    },
    { name: '_RemoteIP',
      target: ':scope>RemoteIP',
      type: 'tag',
      filter: function(oldval, newval) {
        if (!newval) return newval;
        if (oldval.replace(newval, '') == '.') return newval;

        var parts = newval.replace(/\.+$/g, '.').replace(/\.$/, '').split('.');
        var isValidIP = parts.every(function(part) {
          return part*1 < 256 && part*1 > 0;
        });
        if (!isValidIP) return oldval;
        if (parts.length == 4) return newval;
        parts[parts.length-1] += (parts[parts.length-1] + '0')*1 > 255 ? '.' : '';
        return parts.join('.');
      }
    },
    { name: 'RemoteIP',
      type: 'private',
      get: function() {
        return this.model._RemoteIP.value;
      },
      set: function(value) {
        this.model._RemoteIP.value = value;
        this.model.ASDU_Addr
        && (this.model.ASDU_Addr.value = value.split('.')[3] || this.model.ASDU_Addr.value);
      },
      valide: function() {
        if (!this.value) return false;
        var parts = this.value.split('.');
        if (parts.length !== 4) return false;
        return parts.every(function(part) {
          return part*1 < 256 && part*1 >= 0;
        });
      }
    },
    { name: 'RemotePort',
      target: ':scope>RemotePort',
      type: 'tag',
      default: '2404'
    },
    { name: 'TypeDevice',
      target: ':scope',
      type: 'attribute',
      attribute: 'typedevice'
    },
    { name: 'TypeDeviceName',
      type: 'private',
      get: function() {
        var name = this.model.TypeDevice.value;
        if (!name) return '';
        var coproc = new Coproc(11, xmls[11].document);
        var _protocol = name.split('_')[1],
            protocol = coproc.modules.devices.protocols[_protocol],
            device = protocol.devices.filter(function(device) {
              return device.model.Name.value == name;
            })[0];
        return device && device.model.Desc.value || '';
      }
    },
    { name: '_ASDU_Addr',
      target: ':scope>ASDU_Addr',
      type: 'tag'
    },
    { name: 'IECAddress',
      target: ':scope>AbonentList>Abonent>IECAddress',
      type: 'tag'
    },
    { name: 'ASDU_Addr',
      type: 'private',
      get: function() {
        return this.model._ASDU_Addr.value;
      },
      set: function(value) {
        this.model._ASDU_Addr.value = value;
        this.model.IECAddress.value = value;
      }
    },
    { name: 'ASDU_Size',
      target: ':scope>ASDU_Size',
      type: 'tag',
      default: '253'
    },
    { name: '_LocalTime',
      target: ':scope>LocalTime',
      type: 'tag',
      default: '1'
    },
    { name: 'LocalTime',
      type: 'private',
      get: function() {
        return this.model._LocalTime.value === '1';
      },
      set: function(value) {
        this.model._LocalTime.value = value === true ? '1' : '0';
      }
    },
    { name: '_UsePulsSync',
      target: ':scope>UsePulsSync',
      type: 'tag',
      default: '0'
    },
    { name: 'UsePulsSync',
      type: 'private',
      get: function() {
        return this.model._UsePulsSync.value === '1';
      },
      set: function(value) {
        this.model._UsePulsSync.value = value === true ? '1' : '0';
      }
    },
    { name: '_SynchroSlave',
      target: ':scope>AbonentList>Abonent>SynchroSlave',
      type: 'tag',
      default: '0'
    },
    { name: 'SynchroSlave',
      type: 'private',
      get: function() {
        return this.model._SynchroSlave.value === '1';
      },
      set: function(value) {
        this.model._SynchroSlave.value = value === true ? '1' : '0';
      }
    },
    { name: 'channels',
      target: ':scope>AbonentList>Abonent>InChans',
      type: 'list',
      Subitem: ':scope>InChan',
      Subclass: Channel
    }
  ];

  this.canAddChannel = function() {
    return this.model.RemoteIP.valide();
  }
}
Device[COPROC_TYPE.IEC104]['OUTPUT'] = function() {
  this.nodeName = 'Protocol';
  this.model = [
    { name: 'UID',
      type: 'private',
      get: function() { return this.getUID(); }
    },
    { name: 'Name',
      target: ':scope',
      type: 'attribute',
      attribute: 'name'
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
      default: 'Server'
    },
    { name: '_Desc',
      target: ':scope',
      type: 'attribute',
      attribute: 'desc'
    },
    { name: 'Desc',
      type: 'private',
      get: function() { return this.model._Desc.value ||
        (this.model._Desc.value = 'Новое устройство ' + this.model.UID.value);
      },
      set: function(value) {
        this.model._Desc.value = value;
      }
    },
    { name: 'MyPort',
      target: ':scope>MyPort',
      type: 'tag',
      default: '2404'
    },
    { name: 'InputSynchro',
      target: ':scope>InputSynchro',
      type: 'tag',
      default: 'Disabled'
    },
    { name: 'LocalTime',
      target: ':scope>LocalTime',
      type: 'tag',
      default: '1'
    },
    { name: 'ASDU_Addr',
      target: ':scope>ASDU_Addr',
      type: 'tag',
      default: '1'
    },
    { name: 'ASDU_Size',
      target: ':scope>ASDU_Size',
      type: 'tag',
      default: '253'
    },
    { name: 'channels',
      target: ':scope>AbonentList>Abonent>OutChans',
      type: 'list',
      Subitem: ':scope>OutChan',
      Subclass: Channel
    }
  ];
}

Device[COPROC_TYPE.IEC101] = {};
Device[COPROC_TYPE.IEC101]['INPUT'] = function() {
  this.nodeName = 'Abonent';
  this.model = [
    { name: 'UID',
      type: 'private',
      get: function() { return this.getUID(); }
    },
    { name: 'Name',
      target: ':scope',
      type: 'attribute',
      attribute: 'name'
    },
    { name: '_Desc',
      target: ':scope',
      type: 'attribute',
      attribute: 'desc'
    },
    { name: 'Desc',
      type: 'private',
      get: function() { return this.model._Desc.value ||
        (this.model._Desc.value = 'Новое устройство ' + this.model.UID.value);
      },
      set: function(value) {
        this.model._Desc.value = value;
      }
    },
    { name: 'ChanAddress',
      target: ':scope>ChanAddress',
      type: 'tag'
    },
    { name: 'IECAddress',
      target: ':scope>IECAddress',
      type: 'tag'
    },
    { name: 'TypeDevice',
      target: ':scope',
      type: 'attribute',
      attribute: 'typedevice'
    },
    { name: 'TypeDeviceName',
      type: 'private',
      get: function() {
        var name = this.model.TypeDevice.value;
        if (!name) return 'Не определено';
        var coproc = new Coproc(11, xmls[11].document);
        var _protocol = name.split('_')[1],
            protocol = coproc.modules.devices.protocols[_protocol],
            device = protocol.devices.filter(function(device) {
              return device.model.Name.value == name;
            })[0];
        return device.model.Desc.value || 'Не определено';
      }
    },
    { name: 'channels',
      target: ':scope>InChans',
      type: 'list',
      Subitem: ':scope>InChan',
      Subclass: Channel
    }
  ];
}

module.exports = Device;
module.exports._name = 'device';