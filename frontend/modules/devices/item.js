var extend = require('util')._extend,
    proxy = require('proxy').proxy,
    unproxy = require('proxy').unproxy,
    Coproc = require('../coproc');

function Item(parent, node, overrides) {
  if (!(this instanceof Item)) return new Item(parent, node);
  
  this.parent = parent;
  this.num = parent.num;
  this.type = parent.type;
  this.role = parent.role;
  this.nodeName = 'Item';
  this.node = node;
  
  Object.defineProperty(this, 'created', {
    get: function() {
      return this.node && !!this.node.parentNode;
    }
  });
  
  this.model = [
    { name: 'UID',
      type: 'private',
      get: function() {
        return this.model.Name.value.replace(new RegExp('^' + this.parent.model.Name.value + '_'), '')*1;
      }
    },
    { name: 'Desc',
      target: ':scope',
      type: 'attribute',
      attribute: 'desc'
    },
    { name: 'DescString',
      target: ':scope',
      type: 'attribute',
      attribute: 'desc_string'
    },
    { name: 'Name',
      target: ':scope',
      type: 'attribute',
      attribute: 'name'
    },
    { name: 'Group',
      target: ':scope',
      type: 'attribute',
      attribute: 'group'
    },
    { name: 'NameFrom',
      target: ':scope',
      type: 'attribute',
      attribute: 'name_from'
    },
    { name: 'Cfg',
      target: ':scope',
      type: 'attribute',
      attribute: 'cfg'
    },
    { name: 'Sign',
      target: ':scope',
      type: 'attribute',
      attribute: 'sign'
    },
    { name: 'forceExpand',
      type: 'private',
      get: function() {
        return this.model.forceExpand._;
      },
      set: function(value) {
        this.model.forceExpand._ = value;
      },
      default: false
    }
  ];
  this.model.forEach(function(item, index, array) {
    proxy.call(this, item, index, array, overrides);
  }, this);
  
  if (this.model.NameFrom.value && this.model.Group.value && !this.model.forceExpand.value) {
    this.parent.model.itemPattern.value = this.model.Desc.value;
    this.parent.model.itemCfg.value = this.model.Cfg.value;
    var items = Array.apply(null, new Array(this.model.Group.value*1)).map(function(_, index) {
      return new Item(this.parent, null, {
        Name: this.model.Name.value.replace(/%i/g, this.model.NameFrom.value*1 + index),
        Desc: /%s/.test(this.model.Desc.value) 
          ? '%s'
          : this.model.Desc.value.replace(/%i/g, this.model.NameFrom.value*1 + index),
        DescString: /%s/.test(this.model.Desc.value)
          ? this.model.Desc.value.replace(/%s/g, this.model.DescString.value.split(';')[index]||'')
          : '',
        Cfg: this.model.Cfg.value
      });
    }, this);
    this.remove();
    return items;
  }

  this.parent.itemsCache[this.model.Name.value] = this;
}

Item.prototype.remove = function() {
  this.parent.itemsCache[this.model.Name.value] = null;
  this.model.forEach(unproxy.bind(this));
  
  var index = this.parent.items.indexOf(this);
  if (index > -1) this.parent.items.splice(index, 1);
  
  if (this.node.parentNode) this.node.parentNode.removeChild(this.node);
  
  delete this.model;
  delete this.node;
  delete this.parent;
  delete this;
};
Item.prototype.prepareToSave = function(done) {
  this.model.forEach(function(item) {
    if (['attribute', 'tag'].indexOf(item.type) > -1 && !item.value) {
      item.value = undefined;
    }
  });
  setTimeout(done, 0);
};
Item.prototype.getSource = function() {
  var itemName = this.model.Name.value;
  var parts = itemName.split('_');
  var coprocNum = parts[0];
  var coproc = new Coproc(coprocNum);
  var protocol = coproc.modules.devices.protocols[parts[1]];
  var deviceName = parts.slice(0, 3).join('_');
  var device = protocol.devicesCache[deviceName];
  var channelName = parts.slice(0, 4).join('_');
  var channel = device.channelsCache[channelName];
  var item = channel.itemsCache[itemName];
  return item;
}
Item.prototype.getSourcePath = function() {
  var source = this.getSource();
  
  return [
    'Сопроцессор ' + source.num,
    source.parent.parent.model.Desc.value,
    source.parent.model.Desc.value
  ];
}

module.exports = Item;
module.exports._name = 'item';