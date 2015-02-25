require('./modules/ping');
require('./modules/shim');

var angular = require('angular');

window.COPROC_TYPE = {
  IEC101: 'IEC101',
  IEC103: 'IEC103',
  IEC104: 'IEC104',
  STRP: 'STRP',
  MODBUS: 'MODBUS',
  IEC61850: 'IEC61850'
};

window.MAX_DEVICES_PER_PROTOCOL = 20;

window.PROTOCOLS_PER_COPROC_TYPE_ROLE = {
  TYPEDEVICES: {
    INPUT: [
      COPROC_TYPE.IEC101,
      COPROC_TYPE.IEC104
    ]
  },
  TM3COM: {
    INPUT: [],
    OUTPUT: [COPROC_TYPE.IEC101, COPROC_TYPE.IEC104]
  },
  IEC101: {
    INPUT: [COPROC_TYPE.IEC101],
    OUTPUT: [COPROC_TYPE.IEC101]
  },
  IEC103: {
    INPUT: [COPROC_TYPE.IEC103],
    OUTPUT: [COPROC_TYPE.IEC103]
  },
  IEC104: {
    INPUT: [COPROC_TYPE.IEC104],
    OUTPUT: [COPROC_TYPE.IEC104]
  },
  IEC61850: {
    INPUT: [COPROC_TYPE.IEC61850],
    OUTPUT: [COPROC_TYPE.IEC61850]
  },
  STRP: {
    INPUT: [COPROC_TYPE.STRP],
    OUTPUT: []
  },
  MODBUS: {
    INPUT: [COPROC_TYPE.MODBUS],
    OUTPUT: []
  }
};

window.LDR_SOURCE_PER_COPROC_TYPE = {
  IEC104: 'PRJ_TC04.ldr',
  IEC101: 'PRJ_TC05.ldr',
  STRP: 'PRJ_TC05_STRP.ldr',
  IEC61850: 'PRJ_61850.ldr'
}

require('app')
  .controller('param', ['$rootScope', 'xmls', function($scope, xmls) {
    $scope.title = 'ПАРАМЕТРИЗАЦИЯ';
    $scope.xmls = xmls;
    /**
     * Храним текущее состояние навигации.
     */
    $scope.state = {
      __proto__: {
        /**
         * Открыть новый уровень представления
         */
        open: function(level) {
          level.exit = level.exit || function() {};
          level.__proto__ = this.__proto__;
          this.__proto__ = level;
        },
        /**
         * Подняться на уровень вверх
         */
        back: function() {
          if (!this.exit) return;
          this.exit.apply(this, arguments);
          this.__proto__ = this.__proto__.__proto__;
        },
        /**
         * @param level Подняться по навигации до указанного уровня. Если не указан - на самый верх.
         */
        close: function(level) {
          if (level && this.show == level) return;
          this.back.apply(this, Array.prototype.splice.call(arguments, 1));
          if (this.exit) return this.close(level);
        },
        /**
         * Задать параметр для текущего уровня представления
         */
        set: function(option, value) {
          this.__proto__[option] = value;
        }
      }
    };
  }]);

angular.bootstrap(document, ['app']);
