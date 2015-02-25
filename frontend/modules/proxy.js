var xmls = require('xmls');
var xmlns = "http://www.w3.org/1999/xhtml";
var inherits = require('util').inherits;

/**
 * @param item Родитель списка
 * @constructor
 */
function List(item) {
  this.push = function() {
    this.__proto__.push.apply(this, arguments);
    Array.prototype.forEach.call(arguments, function(_item) {
      item._target.appendChild(_item.node);
    }.bind(this));
  };
  this.remove = function(_item) {
    if (!item) return;
    var index = this.indexOf(_item);
    if (index > -1) this.splice(index, 1);
  };
}
inherits(List, Array);

function nofilter(oldval, newval) { return newval; }

/**
 * @param item Елемент модели
 * @param index Индекс элемента модели
 * @param items Все элементы модели
 * @param overrides Переопределенные настройки компиляции
 * Устанавливает двунаправленную связь между объектом модели и xml тегом
 */
function proxy(/*context: {...}*/ item, index, items, overrides) {
  overrides = overrides || {};

  items[item.name] = item;

  if (item.type == 'private') {
    Object.defineProperty(item, 'value', {
      get: item.get && item.get.bind(this),
      set: item.set && item.set.bind(this)
    });
    item.set && (item.value = getValue(item.value, overrides[item.name], item.default));
    return;
  }

  item.value = '';

  correct.call(this, item, index, items, overrides);
  observe.call(this, item, index, items, overrides);
  watch.call(this, item, index, items, overrides);
}

/**
 * @param item Елемент модели
 * @param index Индекс элемента модели
 * @param items Все элементы модели
 * @param overrides Переопределенные настройки компиляции
 * Слушает изменения в модели
 */
function watch(item, index, items, overrides) {
  item.watch('value', function itemValueWatcher(p, o, n) {
    if (o !== n && this._target) {
      switch (this.type) {
        case 'attribute':
          if (n === undefined) {
            this._target.removeAttribute(this.attribute);
            this._mutation.disconnect();
            delete this._mutation;
          } else {
            n = (this.filter || nofilter)(o, '' + n);
            this._target.setAttribute(this.attribute, n);
          }
          break;
        case 'tag':
          if (n === undefined) {
            this._target.parentNode.removeChild(this._target);
            this._mutation.disconnect();
            delete this._mutation;
          } else {
            n = (this.filter || nofilter)(o, '' + n);
            this._target.textContent = n;
          }
          break;
        case 'list':
          if (n == undefined) {
            this.value.slice().forEach(function(item) {
              item.remove();
            });
            this._target.parentNode && this._target.parentNode.removeChild(this._target);
          }
          break;
        case 'private':
          break;
        default:
          throw new Error('Undefined item type');
      }
    }
    return n;
  }.bind(item));
}

/**
 * @param item Елемент модели
 * @param index Индекс элемента модели
 * @param items Все элементы модели
 * @param overrides Переопределенные настройки компиляции
 * Слушает изменения в xml
 */
function observe(item, index, items, overrides) {
  var observers = {
    'childList': function(mutation) {
      if (item.type == 'tag') {
        var name = item.name,
            newValue = (mutation.addedNodes[0] || {textContent : ''}).textContent,
            oldValue = mutation.removedNodes[0] && mutation.removedNodes[0].textContent || null;
        item.value = newValue;
      }
    },
    'attributes': function(mutation) {
      var name = mutation.attributeName,
          newValue = mutation.target.getAttribute(name),
          oldValue = mutation.oldValue;
      if (name === item.name) item.value = newValue;
    }
  };

  item._mutation = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      observers[mutation.type]
      && observers[mutation.type](mutation);
    });
  });

  var target = item._target;

  switch (item.type) {
    case 'attribute':
      item._mutation.observe(item._target, { attributes: true });
      item.value = (item.filter || nofilter)('', target.getAttribute(item.attribute));
      break;
    case 'tag':
      item._mutation.observe(item._target, { childList: true});
      item.value = (item.filter || nofilter)('', target.textContent);
      break;
    case 'list':
      item.value = new List(item);

      Array.prototype.forEach.call(
        item._target.querySelectorAll(item.Subitem) || [],
        function(node) {
          var subitem = item.Subclass.call(null, this, node);
          item.value.push.apply(item.value, [].concat(subitem));
        }, this);
      break;
    default:
      throw new Error('Undefined item type', item);
  }
}

/**
 * Корректно разрываем связь модель-xml
 */
function unproxy(/*context: {...},*/ item, index, items) {
  if (item.type == 'private') return;

  item.value = undefined;

  item.unwatch('value');
  delete items[item.name];
  delete item;
}

/**
 * @param item Елемент модели
 * @param index Индекс элемента модели
 * @param items Все элементы модели
 * @param overrides Переопределенные настройки компиляции
 * Восстанавливает утерянную часть xml
 */
function correct(/*context: {...},*/ item, index, items, overrides) {
  overrides = overrides || {};

  var xml = xmls[this.num].document,
      doc = xml.ownerDocument;

  var fromRoot = /^:root/.test(item.target),
      scope = xml,
      value;

  if (!fromRoot) {
    this.node = this.node || doc.createElementNS(xmlns, this.nodeName);
    scope = this.node;
  }

  // Легкий темплейтинг
  item.target = item.target.replace(
              /\{\{.*?\}\}/g,
              function(expression) { return eval(expression); }.bind(this));

  var target = point(scope, item.target, item);

  if (item.type == 'attribute') {
    value = target.getAttribute(item.attribute);
    target.setAttribute(item.attribute, getValue(value, overrides[item.name], item.default));
  } else if (item.type == 'tag') {
    value = target.textContent;
    target.textContent = getValue(value, overrides[item.name], item.default);
  }

  item._target = target;
}

/**
 * @param scope Корень для создания ветки тега
 * @param path Путь ветки тега
 * @param options Дополнительные настройки
 * Превращаем строку в DOM ветку
 */
function point(scope, path, options) {
  options = options || {};

  if (!path) return scope;

  var target = scope.querySelector(path);
  if (target) return target;

  target = scope;

  var doc = scope.ownerDocument;
  var ways = path.split(',')
                .map(function(way) {
                  return way.trim().split('>');
                });

  // Выбираем первый из возможных путей
  if (ways.length > 1 && options.type == 'comment') {
    var commented = !options.default;
    path = ways.filter(function(way) {
      var tag = findTag(way[way.length - 1]);
      return /^_/.test(tag);
    })[0];
  } else {
    path = ways[0];
  }

  path.forEach(function(path, index, way) {
    if (path === ':scope' || path === ':root') return;

    var newTarget = target.querySelector(path);
    if (!newTarget) {
      var tag = findTag(path);
      var attrs = findAttrs(path);
      newTarget = doc.createElementNS(xmlns, tag);
      Object.keys(attrs).forEach(function(key) {
        newTarget.setAttribute(key, attrs[key]);
      });
      target.appendChild(newTarget);
    }
    target = newTarget;
  }, this);

  return target;
}

function findTag(string) {
  // Ищем таг в:
  // tag
  // tag[attr=""]...
  // tag:nth-child(n)...
  var tagName = (/^(.*?)(?:(?:\[.*?\])|(?::\w+(?:-\w+)?(?:\(.*?\))?))*$/gim.exec(string.trim()) || [])[1];
  return tagName || 'Item';
}

function findAttrs(string) {
  var attrs = {};
  var rx = /(\[.*?\])/gim;
  var found;
  while(found = (rx.exec(string) || [])[1]) {
    var isFullAttr = !(/[$*|~^]=/.test(found));
    if (!isFullAttr) continue;
    var attrMatch = /\[(.*?)=.(.*).\]/.exec(found).slice(1);
    attrs[attrMatch[0]] = attrMatch[1] || '';
  }
  return attrs;
}

function getValue() {
  var result = Array.prototype.slice.call(arguments).reduceRight(function(c, e) {
    return e != null && e !== '' ? e : c;
  }, '');
  return result;
}

module.exports = {
  proxy: proxy,
  unproxy: unproxy,
  correct: correct,
  point: point,
  _name: 'proxy'
};
