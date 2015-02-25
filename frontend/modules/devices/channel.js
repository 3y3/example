var Item = require('./item'),
    Coproc = require('../coproc'),
    extend = require('util')._extend,
    proxy = require('proxy').proxy,
    unproxy = require('proxy').unproxy;

var channelControl = {
  openDatabase: function() {
    this.state.set('editItem', true);
  },
  
  openMainOptions: function() {
    this.state.set('editItem', false);
  },
  
  addChannel: function(channel) {
    this.state.device.channels.push(channel);
    this._emptyTypeDeviceName();
    this.state.back();
  },
  
  _emptyTypeDeviceName: function() {
    if (this.state.device.type == 'INPUT' && this.state.device.model.TypeDevice.value) {
      this.state.device.model.TypeDevice.value = '';
    }
  },
  
  deleteChannel: function(channel) {
    channel.remove();
    this.state.back();
  },
  
  toggleCustomNames: function() {
    this.state.channel.model.customNames.value = !this.state.channel.model.customNames.value;
  },
  
  newItemDialog: function() {
    this.state.open({
      show: 'item',
      exit: function(remove) {
        if (remove) this.item.remove();
      },
      item: this.state.channel.newItem(),
      editItem: true
    });
  },
  
  openItemDialog: function(item) {
    if (!this.state.channel.model.customNames.value) return;
    if (this.state.fromTypeDevice) return;
    this.state.open({
      show: 'item',
      exit: function(remove) {
        if (remove) this.item.remove();
      },
      item: item,
      editItem: true
    });
  },
  
  deleteItem: function(item) {
    item.remove()
    this.state.back();
  },
  
  addItem: function(item) {
    this.state.channel.items.push(item);
    this.state.back();
  }
};
    
angular.module('channel', [])
  .directive('appChannel', [function() {
    return {
      scope: true,
      restrict: 'EA',
      replace: true,
      templateUrl: 'devices/channel.template',
      link: function($scope) {
        extend($scope, channelControl);
      }
    }; 
  }])
  .filter('channelDataType', function() {
    return function(input) {
      var types = {
        'TI': 'Телеизмерения',
        'TS': 'Телесигналы',
        'DTS': 'Двубитные телесигналы',
        'TU': 'Телеуправление'
      };
      return types[input] || 'Неизвестный тип';
    }
  })
  .directive('appDatabase', [function() {
    return {
      scope: true,
      restrict: 'EA',
      replace: true,
      templateUrl: 'devices/database.template',
      link: function($scope) {
        $scope.db = new DataBase($scope.state.channel);
        $scope.db.open({
          coprocs: Coproc.all(),
          show: 'coprocs'
        });
      }
    };
  }]);
  
function DataBase(channel) {
  this._channelNames = {};
  this._channel = channel;
  channel.items.forEach(function(item) {
    this._channelNames[item.model.Name.value] = true;
  }, this);
}
DataBase.prototype = {
  open: function(level) {
    level.__proto__ = this.__proto__;
    this.__proto__ = level;
  },
  close: function(level) {
    if (level && this.show == level) return;
    this.__proto__ = this.__proto__.__proto__;
    if (level && this.__proto__.close) this.close(level);
  },
  openCoproc: function(coproc) {
    this.open({
      coproc: coproc,
      devices: coproc.modules.devices.protocols[coproc.type].devices,
      show: 'devices'
    });
  },
  openDevice: function(device) {
    this.open({
      device: device,
      channels: device.channels,
      show: 'channels'
    });
  },
  openChannel: function(channel) {
    this.open({
      channel: channel,
      items: channel.items,
      show: 'items'
    });
  },
  isInChannel: function(item) {
    return !!this._channelNames[item.model.Name.value];
  },
  exportItem: function(item) {
    if (this.isInChannel(item)) return;
    this._channel.importItem(item);
    this._channelNames[item.model.Name.value] = true;
  },
  deleteItem: function(item) {
    if (!this.isInChannel(item)) return;
    this._channel.deleteItem(item);
    delete this._channelNames[item.model.Name.value];
  }
};

function Channel(parent, node, overrides) {
  if (!(this instanceof Channel)) return new Channel(parent, node);
  
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
  Object.defineProperty(this, 'nextItemUID', {
    get: function() {
      return this.items.reduce(function(UID, item) {
        return item.model.UID.value > UID ? item.model.UID.value : UID;
      }, 0) + 1;
    }
  });
  
  Channel[this.type][this.role].call(this);
  
  this.items = [];
  this.itemsCache = {};
  
  this.model.forEach(function(item, index, items) {
    proxy.call(this, item, index, items, overrides);
  }, this);
  this.items = this.model.Items.value;
  
  this.parent.channelsCache[this.model.Name.value] = this;
  
  if (this.role == 'INPUT') {
    var collapsible = this.collapsible
    if (this.model.customNames.value !== !collapsible)
      this.model.customNames.value = !collapsible;
    if (collapsible)
      this.model.itemPattern.value = collapsible;
  }
}

Channel.prototype.remove = function() {
  this.parent.channelsCache[this.model.Name.value] = null;
  this.model.forEach(unproxy, this);
  
  var index = this.parent.channels.indexOf(this);
  if (index !== -1) this.parent.channels.splice(index, 1);
  if (this.node.parentNode) this.node.parentNode.removeChild(this.node);
  
  delete this.items;
  delete this.model;
  delete this.node;
  delete this.model;
  delete this.parent;
  delete this.created;
  delete this;
};

Channel.prototype.prepareToSave = function(done) {
  function prepareToSave(item) {
    if (item) {
      item.prepareToSave(function(error, result) {
        if (error) return setTimeout(done, 0, error);
        
        var index = this.items.indexOf(item);
        prepareToSave.call(this, this.items[index+1]);
      }.bind(this));
    } else {
      this.zipChannel();
      setTimeout(done);
    }
  }
  
  prepareToSave.call(this, this.items[0]);
};

Channel.prototype.zipChannel = function() {
  if (this.role!=='INPUT') return;
  
  if (!this.model.customNames.value && this.model.itemGroup.value) {
    // Удаляем отдельные Item добавляем группу
    var group = new Item(this, null, {
      Desc: this.model.itemPattern.value,
      Name: this.model.Name.value + '_%i',
      Cfg: this.model.itemCfg.value,
      Group: this.model.itemGroup.value,
      NameFrom: 1,
      forceExpand: true
    });
    group.model.DescString.value = undefined;
    
    this.items.slice().forEach(function(item) {
      item.remove();
    });
    
    this.items.push(group);
  } else {
    // Максимально сжимаем, то что есть в несколько групп
    var _items = [];
    this.items.forEach(function(item, index, items) {
      var UID = item.model.UID.value;
      if (!index 
          || item.model.Cfg.value !== items[index-1].model.Cfg.value
          || UID !== items[index-1].model.UID.value + 1) 
        _items.length++;
      var _item = _items[_items.length-1] = _items[_items.length-1] || {
        descs: [],
        name: this.model.Name.value + '_%i',
        nameFrom: UID,
        cfg: item.model.Cfg.value
      };
      _item.descs.push(item.model.DescString.value || '');
    }, this);
    
    _items = _items.map(function(item) {
      return new Item(this, null, {
        Desc: '%s',
        DescString: item.descs.join(';'),
        Name:  item.name,
        Cfg: item.cfg,
        Group: item.descs.length,
        NameFrom: item.nameFrom,
        forceExpand: true
      });
    }, this);
    this.items.slice().forEach(function(item) {
      item.remove();
    });
    this.items.push.apply(this.items, _items);
  }
};

Object.defineProperty(Channel.prototype, 'collapsible', {
  get: function() {
    /**
     * Канал можно сжать если:
     * 1. все переменные в канале соответствуют одному шаблону
     * 2. все описания переменных соотвествуют одному шаблону
     * 3. все переменные имеют одинаковый cfg
     * или если в канале одна переменная
     */
    var cfg, desc, pattern;
    var collapsible = this.items.every(function(item, index, items) {
      if (!cfg) cfg = item.model.Cfg.value;
      if (!desc) desc = /%s/.test(item.model.Desc.value) ? 'DescString' : 'Desc';
      if (cfg !== item.model.Cfg.value) return false;
      if (index > 0) {
        var prevName = items[index-1].model[desc].value,
            prevNameParts = prevName.split(/(\d+)/),
            currName = item.model[desc].value,
            currNameParts = currName.split(/(\d+)/);
        if (prevNameParts.length !== currNameParts.length) return false;
        
        var indexes = [];
        currNameParts.forEach(function(e, i) {
          if (e !== prevNameParts[i] && e == index + 1) indexes.push(i);
        });
        if (!indexes.length) return false;
        
        indexes.forEach(function(e) {
          currNameParts[e] = '%i';
        });
        var _pattern = currNameParts.join('');
        pattern = pattern || _pattern;
        if (_pattern !== pattern) return false;
      }
      return  (index + 1) === item.model.UID.value;
    });
    return this.items.length == 0 ? 'Переменная %i' : collapsible && pattern;
  }
});

Channel[COPROC_TYPE.IEC104] = {};
Channel[COPROC_TYPE.IEC101] = {};
Channel[COPROC_TYPE.IEC104]['INPUT'] =
Channel[COPROC_TYPE.IEC101]['INPUT'] = function() {
  this.nodeName = 'InChan';
  
  this.newItem = function() {
    return new Item(this, null, {
      Name: this.model.Name.value + '_' + this.nextItemUID
    })
  };
  
  this.model = [
    { name: 'UID',
      type: 'private',
      get: function() {
        return this.model.Name.value.replace(new RegExp('^' + this.parent.model.Name.value + '_'), '')*1;
      }
    },
    { name: '_List',
      target: ':scope>List',
      type: 'tag'
    },
    { name: 'Name',
      type: 'private',
      get: function() { return this.model._List.value || this.model.Name._; },
      set: function(value) {
        this.model._List && (this.model._List.value = value);
        this.model._Name && (this.model._Name.value = value);
        this.model.Name._ = value;
      },
      _: ''
    },
    { name: '_Name',
      target: ':root>DB>ListInChans>InChan[name="{{this.model._List.value}}"]',
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
        (this.model._Desc.value = 'Новый канал ' + this.model.UID.value);
      },
      set: function(value) {
        this.model._Desc.value = value;
      }
    },
    { name: '_FirstChanNum',
      target: ':scope>FirstChanNum',
      type: 'tag'
    },
    { name: 'FirstChanNum',
      type: 'private',
      get: function() { return this.model._FirstChanNum.value ||
        (this.model._FirstChanNum.value = this.parent.channels.reduce(function(result, channel) {
          if (channel == this) return result;
          return Math.max(result, channel.model._FirstChanNum.value);
        }.bind(this), 0));
      },
      set: function(value) {
        this.model._FirstChanNum.value = value;
      }
    },
    { name: 'DataType',
      target: ':scope',
      type: 'attribute',
      attribute: 'data-type',
      options: ['TS', 'DTS', 'TI'],
      default: 'TI'
    },
    { name: 'GroupNumber',
      target: ':scope>GroupNumber',
      type: 'tag'
    },
    { name: 'itemGroup',
      type: 'private',
      get: function() {
        return this.items.length;
      },
      set: function(value) {
        // Если длина группы увеличилась - добавляем в конец.
        // Иначе забираем с конца
        var dl = value - this.items.length;
        if (dl > 0) {
          Array.apply(null, new Array(dl)).forEach(function() {
            this.items.push(new Item(this, null, {
              Name: this.model.Name.value + '_' + (this.items.length + 1),
              Desc: this.model.itemPattern.value.replace(/%i/g, this.items.length + 1),
              Cfg: this.model.itemCfg.value
            }));
          }, this);
        } else if (dl < 0) {
          Array.apply(null, new Array(-dl)).forEach(function() {
            this.items.pop().remove();
          }, this);
        }
      }
    },
    { name: 'itemPattern',
      type: 'private',
      get: function() { 
        if (this.model.customNames && this.model.customNames._) return '';
        return this.model.itemPattern._; 
      },
      set: function(value) {
        if (this.model.customNames && this.model.customNames._) return;
        this.items.forEach(function(item, index) {
          item.model.Desc.value = value.replace(/%i/, index+1);
        });
        this.model.itemPattern._ = value;
      }
    },
    { name: 'itemCfg',
      type: 'private',
      get: function() {
        if (this.model.customNames && this.model.customNames._) return '';
        return this.items.length && this.items[0].model.Cfg.value || ''; 
      },
      set: function(value) {
        if (this.model.customNames && this.model.customNames._) return;
        this.items.forEach(function(item) {
          item.model.Cfg.value = value;
        });
      }
    },
    { name: 'customNames',
      type: 'private',
      get: function() {
        if (this.model.customNames._) return this.model.customNames._;
        return this.items.some(function(item) {
          return /%s/.test(item.model.Desc.value);
        });
      },
      set: function(value) {
        if (value) {
          this.items.forEach(function(item) {
            item.model.DescString.value = item.model.Desc.value;
            item.model.Desc.value = '%s';
          }, this);
          this.model.customNames._ = value;
        } else {
          var pattern = this.collapsible;
          if (pattern) {
            this.model.customNames._ = value;
            this.items.forEach(function(item, index) {
              item.model.DescString.value = '';
              item.model.Desc.value = pattern.replace(/%i/g, index + 1);
            }, this);
            this.model.itemPattern.value = pattern;
            this.model.itemGroup.value = this.items.length;
            this.model.itemCfg.value = this.items[0] && this.items[0].model.Cfg.value || '';
          }
        }
      }
    },
    { name: 'Items',
      target: ':root>DB>ListInChans>InChan[name="{{this.model._List.value}}"]',
      type: 'list',
      Subitem: ':scope>Item',
      Subclass: Item
    }
  ];
};
Channel[COPROC_TYPE.IEC104]['OUTPUT'] =
Channel[COPROC_TYPE.IEC101]['OUTPUT'] = function() {
  this.nodeName = 'OutChan';
  
  this.newItem = function(item) {
    if (!item) throw new Error('Output channel. Bad usage: input item expected to add in channel');
    return new Item(this, null, {
      Name: item.model.Name.value,
      Desc: item.model.DescString.value || item.model.Desc.value,
      Sign: item.model.Sign.value
    });
  };
  this.importItem = function(item) {
    if (!item) throw new Error('Output channel. Bad usage: input item expected to add in channel');
    this.items.push(this.newItem(item));
  }
  this.hasItem = function(item) {
    return this.items.some(function(_item) {
      return item.model.Name.value == _item.model.Name.value;
    });
  };
  this.deleteItem = function(item) {
    this.items.forEach(function(_item) {
      if (_item.model.Name.value == item.model.Name.value) _item.remove();
    });
  };
  
  this.model = [
    { name: 'UID',
      type: 'private',
      get: function() {
        return this.model.Name.value.replace(new RegExp('^' + this.parent.model.Name.value + '_'), '')*1;
      }
    },
    { name: '_List',
      target: ':scope>List',
      type: 'tag'
    },
    { name: 'Name',
      type: 'private',
      get: function() { return this.model._List.value || this.model.Name._; },
      set: function(value) {
        this.model._List && (this.model._List.value = value);
        this.model._Name && (this.model._Name.value = value);
        this.model.Name._ = value;
      },
      _: ''
    },
    { name: '_Name',
      target: ':root>DB>ListOutChans>OutChan[name="{{this.model._List.value}}"]',
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
        (this.model._Desc.value = 'Новый канал ' + this.model.UID.value);
      },
      set: function(value) {
        this.model._Desc.value = value;
      }
    },
    { name: '_FirstChanNum',
      target: ':scope>FirstChanNum',
      type: 'tag'
    },
    { name: 'FirstChanNum',
      type: 'private',
      get: function() { return this.model._FirstChanNum.value ||
        (this.model._FirstChanNum.value = this.parent.channels.reduce(function(result, channel) {
          if (channel == this) return result;
          return Math.max(result, channel.model._FirstChanNum.value);
        }.bind(this), 0)); },
      set: function(value) {
        this.model._FirstChanNum.value = value;
      }
    },
    { name: 'DataType',
      target: ':scope',
      type: 'attribute',
      attribute: 'data-type',
      options: ['TS', 'DTS', 'TI'],
      default: 'TI'
    },
    { name: 'GroupList',
      target: ':scope>GroupList',
      type: 'attribute',
      attribute: 'group'
    },
    { name: 'Items',
      target: ':root>DB>ListOutChans>OutChan[name="{{this.model._List.value}}"]',
      type: 'list',
      Subitem: ':scope>Item',
      Subclass: Item
    }
  ];
};

module.exports = Channel;
module.exports._name = 'channel';