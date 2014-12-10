!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.ApiClient=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
// API Client
// ---------------

// Example
/*
 var github = ApiClient('https://api.github.com', {
   hooks: {
     headers: {
       Accept: 'application/vnd.github.v3+json',
       Authorization: 'token 8fbfc540f1ed1417083c70a990b4db3c9aa86efe'
     }
   }
 });

 github.add('search', {
  searchMethod: function(){
    console.log( 'search::searchMethod' );
  }
 });
 github.search.add('users', {
  usersMethod: function(){
    this.parent.searchMethod();
  }
 });

 // Добавляем ресурсы
 github.add('user');
 github.add('users');
 github.users.add('repos');

 // Прочитать репозитории (отправить гет запрос на https://api.github.com/users/repos/)
 github.users.repos.read();

 //-----------------------------

 // Не совсем REST, все запросы идут на один адрес
 var simpleApi = ApiClient('api.example.com', {});

 simpleApi().read({
  e: '/Base/Department'
 });

 simpleApi.post({ data });
 simpleApi('identity').post({ data }, { ajaxSettings });
 simpleApi('identity').post( null, { ajaxSettings });
 simpleApi.post({ data }, { ajaxSettings });
 simpleApi.post( null, { ajaxSettings });

 simpleApi.read(doneCallback).done(callback).fail(callback);

 Работа с документами (storage), он сам преобразуется через метод $__delta()
 simpleApi.post( Document );
 simpleApi.save( Document );


 // Фичи
 ajaxSettings для каждого запроса
 Identity для каждого запроса

 */

'use strict';

var resourceMixin = {
  resourceName: 'resource',
  url: '', // = resourceName

  /**
   * Добавить новый ресурс
   *
   * @param {string} resourceName
   * @param {object} [parentResource] - родительский ресурс
   * @param {object} [usersMixin] - пользовательская примесь
   * @returns {*}
   */
  add: function( resourceName, parentResource, usersMixin ){
    if ( !usersMixin ) {
      usersMixin = parentResource || {};
      parentResource = this;
    }

    // Бросить исключение, если такой ресурс уже есть
    if ( this[ resourceName ] ){
      throw new TypeError('Ресурс с названием ' + resourceName + 'уже есть.');
    }

    // Любой из этих параметров указывает на необходимость использовать хранилище
    if ( usersMixin.schemaName || usersMixin.collectionName || usersMixin.storage ) {
      // Определим название создаваемой коллекции
      usersMixin.collectionName = usersMixin.collectionName || resourceName;
    }

    // Перед созданием коллекции нужно создать ресурс, чтобы у коллекции была ссылка на него
    this[ resourceName ] = new Resource( resourceName, parentResource, usersMixin );

    // Создать коллекцию, если этого еще не сделали
    if ( usersMixin.collectionName && !storage[ usersMixin.collectionName ] ){
      // Ищем схему, если она указана
      var schema = storage.schemas[ usersMixin.schemaName ];

      if ( schema ){
        storage.createCollection( usersMixin.collectionName, schema, this[ resourceName ] );
      } else {
        throw new TypeError('Resource::' + resourceName + ' Нельзя использовать хранилище (создать коллекцию), не указав схему данных');
      }
    }

    return this[ resourceName ];
  },

  /**
   * https://github.com/aheckmann/mquery/blob/master/lib/mquery.js
   * mquery.select
   *
   * Specifies which document fields to include or exclude
   *
   * ####String syntax
   *
   * When passing a string, prefixing a path with `-` will flag that path as excluded. When a path does not have the `-` prefix, it is included.
   *
   * ####Example
   *
   *     // include a and b, exclude c
   *     query.select('a b -c');
   *
   *     // or you may use object notation, useful when
   *     // you have keys already prefixed with a "-"
   *     query.select({a: 1, b: 1, c: 0});
   *
   * ####Note
   *
   * Cannot be used with `distinct()`
   *
   * @param {Object|String} arg
   * @return {Query} this
   * @see SchemaType
   * @api public
   */
  transformFields: function select () {
    var arg = arguments[0];
    if (!arg) return this;

    if (arguments.length !== 1) {
      throw new Error("Invalid select: select only takes 1 argument");
    }

    var fields = this._fields || (this._fields = {});
    var type = typeof arg;

    if ('string' == type || 'object' == type && 'number' == typeof arg.length && !Array.isArray(arg)) {
      if ('string' == type)
        arg = arg.split(/\s+/);

      for (var i = 0, len = arg.length; i < len; ++i) {
        var field = arg[i];
        if (!field) continue;
        var include = '-' == field[0] ? 0 : 1;
        if (include === 0) field = field.substring(1);
        fields[field] = include;
      }

      return this;
    }

    if (_.isObject(arg) && !Array.isArray(arg)) {
      var keys = Object.keys(arg);
      for (var i = 0; i < keys.length; ++i) {
        fields[keys[i]] = arg[keys[i]];
      }
      return this;
    }

    throw new TypeError('Invalid select() argument. Must be string or object.');
  },

  // Пробежаться по всем родительским ресурсам и собрать url (без query string)
  constructUrl: function constructUrl( recursionCall ){
    // todo: проверить надобность закомментированного кода
    // условие с recursionCall добавляет слэш в урл перед знаком вопроса
    //var identity = this.identity ? '/' + this.identity : recursionCall ? '' : '/';
    var identity = this.identity ? '/' + this.identity : '';

    // Пробежаться по всем ресурсам и заглянуть в корень апи, чтобы собрать url
    return this.parentResource
      ? constructUrl.call( this.parentResource, true ) + '/' + this.url + identity
      : this.url;
  },

  _resourceRequest: function( method, ajaxSettings, doneCallback ){
    var url = this.constructUrl()
      , useNotifications = this.notifications;

    console.log( this.resourceName + '::' + method + ' ' + url );
    return this.instance._request( method, url, ajaxSettings.data, ajaxSettings, useNotifications, doneCallback );
  }
};

var requestsTable = [];

var methodsMap = {
  'create': 'POST',
  'read':   'GET',
  'update': 'PUT',
  'delete': 'DELETE',
  'patch':  'PATCH',

  'post':   'POST',
  'get':    'GET',
  'save':   'PUT'
};

_.forEach( Object.keys( methodsMap ), function( verb ){
  /**
   * Запросы create read update delete patch get post
   *
   * В ajaxSettings можно указать поле doNotStore - чтобы не сохранять полученный объект в storage
   *
   * @param [data]
   * @param [ajaxSettings]
   * @param [doneCallback]
   * @returns {*}
   */
  resourceMixin[ verb ] = function( data, ajaxSettings, doneCallback ){
    var resource = this,
      identity = this.identity,
      method = this.instance.methodsMap[ verb],
      documentIdString;

    // Если data - есть функция, то это doneCallback
    if ( $.isFunction( data ) ){
      doneCallback = data;
      data = undefined;
    }
    if ( $.isFunction( ajaxSettings ) ){
      doneCallback = ajaxSettings;
      ajaxSettings = undefined;
    }

    ajaxSettings = ajaxSettings || {};

    // При сохранении документа нужно сохранять только изменённые поля
    if ( method === 'POST' || method === 'PUT' ){
      // Иногда передают документ
      if ( data instanceof storage.Document ) {
        documentIdString = data._id.toString();
        data = data.$__delta();

        // Так можно понять, что мы сохраняем сущетвующий на сервере Document
      } else if ( storage.ObjectId.isValid( identity ) ) {
        documentIdString = identity;

        // При сохранении через метод save() у документа
      } else if ( data._id && storage.ObjectId.isValid( data._id ) ) {
        documentIdString = data._id.toString();
      }
    }

    ajaxSettings.data = data;

    var reqInfo = {
      method: method,
      url: this.constructUrl(),
      ajaxSettings: ajaxSettings,
      result: null,
      meta: null
    };

    //TODO: доделать кэширование
    // Кэширование на чтение
    if ( method === 'GET' ){
      var inCache = _.find( requestsTable, reqInfo );

      if ( resource.storage && identity && inCache ){
        // Если данное есть - вернуть его
        if ( inCache.result ){
          doneCallback && doneCallback( inCache.result, inCache.meta );
          this.identity = '';
          return;
        }
      }
    }

    var dfd = $.Deferred();
    this._resourceRequest( verb, ajaxSettings ).done(function( response, textStatus, jqXHR ){
      var result, fields;

      //#example    vs.api.places({fields: 'name', skip: 100}).get(function(res){console.log(res)});
      // Если была выборка по полям, нужно правильно обработать её и передать в документ
      if ( data && data.fields ){
        fields = resource.transformFields( data.fields );
      }

      // При использовании параметра doNotStore - не надо сохранять ответ в хранилище
      if ( resource.storage && !ajaxSettings.doNotStore ){
        // При сохранении и обновлении нужно обновлять документ
        if ( method === 'POST' || method === 'PUT' ){
          // Попробуем сначала найти документ по id и обновить его
          result = storage[ resource.collectionName ].findById( documentIdString );

          if ( result ){
            // Обновляем документ
            result.set( response.result );

            // Создаём ссылку по новому id в коллекции
            storage[ resource.collectionName ].documents[ documentIdString ] = result;

            // Этот документ теперь сохранён на сервере, значит он уже не новый.
            result.isNew = false;

          } else {
            result = storage[ resource.collectionName ].add( response.result || response, undefined, true );
          }

        } else if ( method === 'GET' ){
          // Не добавлять в хранилище результат запросов с выборкой полей
          if ( fields ){
            result = response.result;
          } else {
            result = storage[ resource.collectionName ].add( response.result || response, fields, true );
          }
        }
      } else {
        result = response.result || response;
      }

      // Сохранить параметры запроса и ответ для кэширования
      reqInfo.result = result;
      reqInfo.meta = response.meta;
      requestsTable.push( reqInfo );

      doneCallback && doneCallback( result, response.meta );
      dfd.resolve( result, response.meta, textStatus, jqXHR );

    }).fail(function( jqXHR, textStatus, errorThrown ){
      dfd.reject( jqXHR, textStatus, errorThrown );
    });

    //TODO: Использовать идеологю query? query объект для построения запросов

    // identity сохраняется для constructUrl, его нужно очистить для последующих запросов.
    this.identity = '';

    return dfd;
  };
});

/**
 * Как бы конструктор ресурса, но возвращает функцию-объект с примесями
 *
 * @param {string} resourceName
 * @param {object} parentResource
 * @param {object} usersMixin
 * @returns {Function} resource
 * @constructor
 */
var Resource = function( resourceName, parentResource, usersMixin ){

  /**
   * Эту функцию мы отдаём пользователю в качестве доступа к ресурсу.
   * Она позволяет задать identity и дополнительные параметры в запрос.
   *
   * @param [identity]
   * @returns {Function}
   */
  var resource = function resource( identity ){
    if ( identity && !_.isString( identity ) ){
      console.error('identity должен быть строкой, а не', identity );
    }

    resource.identity = identity || '';

    return resource;
  };

  $.extend( resource, resourceMixin, {
    resourceName: resourceName,
    url: resourceName
  }, usersMixin );

  resource.parentResource = parentResource;
  resource.instance = parentResource.instance || parentResource;

  return resource;
};

/**
 * Создать новый экземпляр api клиента
 *
 * @example
 * ApiClient('/api', {
 *   hooks: {
 *     headers: {
 *       token: 'XXXXXX'
 *     }
 *   }
 * });
 *
 * ApiClient('https://domain.com/api', {
 *   hooks: {
 *     headers: {
 *       token: 'XXXXXX'
 *     }
 *   }
 * });
 *
 * ApiClient({
 *   url: '/api'
 *   hooks: {
 *     headers: {
 *       token: 'XXXXXX'
 *     }
 *   }
 * });
 *
 * @param url - ссылка на корень api
 * @param options - опции для клиента
 */
var ApiClient = function( url, options ){
  return new ApiClient.instance.init( url, options );
};

ApiClient.instance = ApiClient.prototype = {
  constructor: ApiClient,

  /**
   * Инициализация нового апи клиента
   * @param url
   * @param options
   */
  init: function( url, options ){
    if ( typeof url === 'string' ){
      options = options || {};
      options.url = url;
    }

    // По умолчанию, уведомления отключены
    this.notifications = false;

    /**
     * Хуки для ajax settings (выступает в роли базового ajaxSettings)
     * @see http://api.jquery.com/jQuery.ajax/
     *
     * @type {Object}
     */
    this.hooks = {
      // дополнительные данные запроса
      data: {},
      // Объект для добавления произвольных заголовков ко всем запросам
      // удобно для авторизации по токенам
      headers: {}
    };

    $.extend( true, this, $.isPlainObject( url ) ? url : options );
  },

  /**
   * Добавить новый ресурс
   * @see resourceMixin.add
   */
  add: resourceMixin.add,

  methodsMap: methodsMap,

  _prepareAjaxSettings: function( method, url, data, ajaxSettings ){
    var type = this.methodsMap[ method ]
      , _ajaxSettings = $.extend( true, {}, this.hooks, ajaxSettings, {
        type: type,
        url: url
      });

    // Добавляем авторизацию по токену
    if ( this.token && ajaxSettings.headers && ajaxSettings.headers.token == null ){
      _ajaxSettings.headers.Authorization = 'token ' + this.token;
      //Accept: 'application/vnd.github.preview'
    }

    if ( type === 'GET' ){
      _.assign( _ajaxSettings.data, data );
    } else if ( data ){
      // Если сохраняем документ, нужно сделать toObject({depopulate: 1})
      if ( data.constructor && data.constructor.name && data.constructor.name === 'Document' ){
        _.assign( _ajaxSettings.data, data.toObject({depopulate: 1}) );

      } else {
        _.assign( _ajaxSettings.data, data );
      }

      if ( _ajaxSettings.contentType === 'application/json' ){
        _ajaxSettings.data = JSON.stringify( _ajaxSettings.data );
      }
    }

    // todo проверть надобность кода
    // Используется для алиасов, в которых второй параметр - есть объект настроек
    if ( $.isPlainObject( url ) ){
      console.info('Ах@*ть, нужный код!!!!');
      _ajaxSettings = url;
      debugger;
    }

    return _ajaxSettings;
  },

  /**
   * Отправить запрос на сервер
   *
   * @param {string} method   Название метода (POST, GET, PUT, DELETE, PATCH)
   * @param {string} url   Полный урл ресурса
   * @param {object} data   Объект с данными для запроса
   * @param {object} ajaxSettings   Объект с настройками
   * @param {boolean} useNotifications   Флаг, использовать ли уведомления
   * @param {function} doneCallback   Функция успешного обратного вызова
   * @returns {$.Deferred} возвращает jquery ajax объект
   *
   * @private
   */
  _request: function( method, url, data, ajaxSettings, useNotifications, doneCallback ){
    if ( !_.isString( method ) ){
      throw new Error('Параметр `method` должен быть строкой, а не ', method );
    }

    var self = this
      , type = this.methodsMap[ method ]
      , notificationType = type === 'GET' ? 'load' : ( type === 'POST' || type === 'PUT' || type === 'PATCH' ) ? 'save' : 'delete'
      , _ajaxSettings = this._prepareAjaxSettings( method, url, data, ajaxSettings );

    // Использовать значение по умолчанию, если useNotifications не задан
    // тут же порверяем, подключены ли уведомления
    if ( _.isBoolean( useNotifications ) ){
      useNotifications = useNotifications && cf.notification;
    } else {
      useNotifications = this.notifications && cf.notification;
    }

    if ( useNotifications ){
      cf.notification[ notificationType ].show();
    }

    return $.ajax( _ajaxSettings ).fail(function( jqXHR, textStatus, errorThrown ){
      console.warn( jqXHR, textStatus, errorThrown );

      // Unauthorized Callback
      if ( jqXHR.status === 401 && self.unauthorizedCallback ){
        self.unauthorizedCallback( jqXHR, method, url, data, ajaxSettings, doneCallback );

        // Не показывать сообщение с ошибкой при 401, если всё плохо, то роутер сам перекинет на форму входа
        if ( useNotifications ){
          cf.notification[ notificationType ].hide();
        }

        return;
      }

      if ( useNotifications ){
        cf.notification[ notificationType ].fail();
      }

    }).done(function(){
      if ( useNotifications ){
        cf.notification[ notificationType ].hide();
      }
    }).done( doneCallback );
  },

  /**
   * Метод для чтения корня api
   *
   * @param ajaxSettings
   * @param doneCallback
   * @returns {$.Deferred}
   */
  read: function( ajaxSettings, doneCallback ){
    console.log( 'api::read' );
    if ( $.isFunction( ajaxSettings ) ){
      doneCallback = ajaxSettings;
      ajaxSettings = undefined;
    }

    ajaxSettings = ajaxSettings || {};

    return this._request('read', this.url, undefined, ajaxSettings, false, doneCallback );
  }
};

ApiClient.instance.init.prototype = ApiClient.instance;

// exports
module.exports = ApiClient;
},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy91c2VyL1NpdGVzL2dpdGh1Yi9yZXN0LWFwaS1jbGllbnQvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL1VzZXJzL3VzZXIvU2l0ZXMvZ2l0aHViL3Jlc3QtYXBpLWNsaWVudC9zcmMvZmFrZV80NmNkMWE1Yi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBBUEkgQ2xpZW50XG4vLyAtLS0tLS0tLS0tLS0tLS1cblxuLy8gRXhhbXBsZVxuLypcbiB2YXIgZ2l0aHViID0gQXBpQ2xpZW50KCdodHRwczovL2FwaS5naXRodWIuY29tJywge1xuICAgaG9va3M6IHtcbiAgICAgaGVhZGVyczoge1xuICAgICAgIEFjY2VwdDogJ2FwcGxpY2F0aW9uL3ZuZC5naXRodWIudjMranNvbicsXG4gICAgICAgQXV0aG9yaXphdGlvbjogJ3Rva2VuIDhmYmZjNTQwZjFlZDE0MTcwODNjNzBhOTkwYjRkYjNjOWFhODZlZmUnXG4gICAgIH1cbiAgIH1cbiB9KTtcblxuIGdpdGh1Yi5hZGQoJ3NlYXJjaCcsIHtcbiAgc2VhcmNoTWV0aG9kOiBmdW5jdGlvbigpe1xuICAgIGNvbnNvbGUubG9nKCAnc2VhcmNoOjpzZWFyY2hNZXRob2QnICk7XG4gIH1cbiB9KTtcbiBnaXRodWIuc2VhcmNoLmFkZCgndXNlcnMnLCB7XG4gIHVzZXJzTWV0aG9kOiBmdW5jdGlvbigpe1xuICAgIHRoaXMucGFyZW50LnNlYXJjaE1ldGhvZCgpO1xuICB9XG4gfSk7XG5cbiAvLyDQlNC+0LHQsNCy0LvRj9C10Lwg0YDQtdGB0YPRgNGB0YtcbiBnaXRodWIuYWRkKCd1c2VyJyk7XG4gZ2l0aHViLmFkZCgndXNlcnMnKTtcbiBnaXRodWIudXNlcnMuYWRkKCdyZXBvcycpO1xuXG4gLy8g0J/RgNC+0YfQuNGC0LDRgtGMINGA0LXQv9C+0LfQuNGC0L7RgNC40LggKNC+0YLQv9GA0LDQstC40YLRjCDQs9C10YIg0LfQsNC/0YDQvtGBINC90LAgaHR0cHM6Ly9hcGkuZ2l0aHViLmNvbS91c2Vycy9yZXBvcy8pXG4gZ2l0aHViLnVzZXJzLnJlcG9zLnJlYWQoKTtcblxuIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuIC8vINCd0LUg0YHQvtCy0YHQtdC8IFJFU1QsINCy0YHQtSDQt9Cw0L/RgNC+0YHRiyDQuNC00YPRgiDQvdCwINC+0LTQuNC9INCw0LTRgNC10YFcbiB2YXIgc2ltcGxlQXBpID0gQXBpQ2xpZW50KCdhcGkuZXhhbXBsZS5jb20nLCB7fSk7XG5cbiBzaW1wbGVBcGkoKS5yZWFkKHtcbiAgZTogJy9CYXNlL0RlcGFydG1lbnQnXG4gfSk7XG5cbiBzaW1wbGVBcGkucG9zdCh7IGRhdGEgfSk7XG4gc2ltcGxlQXBpKCdpZGVudGl0eScpLnBvc3QoeyBkYXRhIH0sIHsgYWpheFNldHRpbmdzIH0pO1xuIHNpbXBsZUFwaSgnaWRlbnRpdHknKS5wb3N0KCBudWxsLCB7IGFqYXhTZXR0aW5ncyB9KTtcbiBzaW1wbGVBcGkucG9zdCh7IGRhdGEgfSwgeyBhamF4U2V0dGluZ3MgfSk7XG4gc2ltcGxlQXBpLnBvc3QoIG51bGwsIHsgYWpheFNldHRpbmdzIH0pO1xuXG4gc2ltcGxlQXBpLnJlYWQoZG9uZUNhbGxiYWNrKS5kb25lKGNhbGxiYWNrKS5mYWlsKGNhbGxiYWNrKTtcblxuINCg0LDQsdC+0YLQsCDRgSDQtNC+0LrRg9C80LXQvdGC0LDQvNC4IChzdG9yYWdlKSwg0L7QvSDRgdCw0Lwg0L/RgNC10L7QsdGA0LDQt9GD0LXRgtGB0Y8g0YfQtdGA0LXQtyDQvNC10YLQvtC0ICRfX2RlbHRhKClcbiBzaW1wbGVBcGkucG9zdCggRG9jdW1lbnQgKTtcbiBzaW1wbGVBcGkuc2F2ZSggRG9jdW1lbnQgKTtcblxuXG4gLy8g0KTQuNGH0LhcbiBhamF4U2V0dGluZ3Mg0LTQu9GPINC60LDQttC00L7Qs9C+INC30LDQv9GA0L7RgdCwXG4gSWRlbnRpdHkg0LTQu9GPINC60LDQttC00L7Qs9C+INC30LDQv9GA0L7RgdCwXG5cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciByZXNvdXJjZU1peGluID0ge1xuICByZXNvdXJjZU5hbWU6ICdyZXNvdXJjZScsXG4gIHVybDogJycsIC8vID0gcmVzb3VyY2VOYW1lXG5cbiAgLyoqXG4gICAqINCU0L7QsdCw0LLQuNGC0Ywg0L3QvtCy0YvQuSDRgNC10YHRg9GA0YFcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IHJlc291cmNlTmFtZVxuICAgKiBAcGFyYW0ge29iamVjdH0gW3BhcmVudFJlc291cmNlXSAtINGA0L7QtNC40YLQtdC70YzRgdC60LjQuSDRgNC10YHRg9GA0YFcbiAgICogQHBhcmFtIHtvYmplY3R9IFt1c2Vyc01peGluXSAtINC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjNGB0LrQsNGPINC/0YDQuNC80LXRgdGMXG4gICAqIEByZXR1cm5zIHsqfVxuICAgKi9cbiAgYWRkOiBmdW5jdGlvbiggcmVzb3VyY2VOYW1lLCBwYXJlbnRSZXNvdXJjZSwgdXNlcnNNaXhpbiApe1xuICAgIGlmICggIXVzZXJzTWl4aW4gKSB7XG4gICAgICB1c2Vyc01peGluID0gcGFyZW50UmVzb3VyY2UgfHwge307XG4gICAgICBwYXJlbnRSZXNvdXJjZSA9IHRoaXM7XG4gICAgfVxuXG4gICAgLy8g0JHRgNC+0YHQuNGC0Ywg0LjRgdC60LvRjtGH0LXQvdC40LUsINC10YHQu9C4INGC0LDQutC+0Lkg0YDQtdGB0YPRgNGBINGD0LbQtSDQtdGB0YLRjFxuICAgIGlmICggdGhpc1sgcmVzb3VyY2VOYW1lIF0gKXtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ9Cg0LXRgdGD0YDRgSDRgSDQvdCw0LfQstCw0L3QuNC10LwgJyArIHJlc291cmNlTmFtZSArICfRg9C20LUg0LXRgdGC0YwuJyk7XG4gICAgfVxuXG4gICAgLy8g0JvRjtCx0L7QuSDQuNC3INGN0YLQuNGFINC/0LDRgNCw0LzQtdGC0YDQvtCyINGD0LrQsNC30YvQstCw0LXRgiDQvdCwINC90LXQvtCx0YXQvtC00LjQvNC+0YHRgtGMINC40YHQv9C+0LvRjNC30L7QstCw0YLRjCDRhdGA0LDQvdC40LvQuNGJ0LVcbiAgICBpZiAoIHVzZXJzTWl4aW4uc2NoZW1hTmFtZSB8fCB1c2Vyc01peGluLmNvbGxlY3Rpb25OYW1lIHx8IHVzZXJzTWl4aW4uc3RvcmFnZSApIHtcbiAgICAgIC8vINCe0L/RgNC10LTQtdC70LjQvCDQvdCw0LfQstCw0L3QuNC1INGB0L7Qt9C00LDQstCw0LXQvNC+0Lkg0LrQvtC70LvQtdC60YbQuNC4XG4gICAgICB1c2Vyc01peGluLmNvbGxlY3Rpb25OYW1lID0gdXNlcnNNaXhpbi5jb2xsZWN0aW9uTmFtZSB8fCByZXNvdXJjZU5hbWU7XG4gICAgfVxuXG4gICAgLy8g0J/QtdGA0LXQtCDRgdC+0LfQtNCw0L3QuNC10Lwg0LrQvtC70LvQtdC60YbQuNC4INC90YPQttC90L4g0YHQvtC30LTQsNGC0Ywg0YDQtdGB0YPRgNGBLCDRh9GC0L7QsdGLINGDINC60L7Qu9C70LXQutGG0LjQuCDQsdGL0LvQsCDRgdGB0YvQu9C60LAg0L3QsCDQvdC10LPQvlxuICAgIHRoaXNbIHJlc291cmNlTmFtZSBdID0gbmV3IFJlc291cmNlKCByZXNvdXJjZU5hbWUsIHBhcmVudFJlc291cmNlLCB1c2Vyc01peGluICk7XG5cbiAgICAvLyDQodC+0LfQtNCw0YLRjCDQutC+0LvQu9C10LrRhtC40Y4sINC10YHQu9C4INGN0YLQvtCz0L4g0LXRidC1INC90LUg0YHQtNC10LvQsNC70LhcbiAgICBpZiAoIHVzZXJzTWl4aW4uY29sbGVjdGlvbk5hbWUgJiYgIXN0b3JhZ2VbIHVzZXJzTWl4aW4uY29sbGVjdGlvbk5hbWUgXSApe1xuICAgICAgLy8g0JjRidC10Lwg0YHRhdC10LzRgywg0LXRgdC70Lgg0L7QvdCwINGD0LrQsNC30LDQvdCwXG4gICAgICB2YXIgc2NoZW1hID0gc3RvcmFnZS5zY2hlbWFzWyB1c2Vyc01peGluLnNjaGVtYU5hbWUgXTtcblxuICAgICAgaWYgKCBzY2hlbWEgKXtcbiAgICAgICAgc3RvcmFnZS5jcmVhdGVDb2xsZWN0aW9uKCB1c2Vyc01peGluLmNvbGxlY3Rpb25OYW1lLCBzY2hlbWEsIHRoaXNbIHJlc291cmNlTmFtZSBdICk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdSZXNvdXJjZTo6JyArIHJlc291cmNlTmFtZSArICcg0J3QtdC70YzQt9GPINC40YHQv9C+0LvRjNC30L7QstCw0YLRjCDRhdGA0LDQvdC40LvQuNGJ0LUgKNGB0L7Qt9C00LDRgtGMINC60L7Qu9C70LXQutGG0LjRjiksINC90LUg0YPQutCw0LfQsNCyINGB0YXQtdC80YMg0LTQsNC90L3Ri9GFJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNbIHJlc291cmNlTmFtZSBdO1xuICB9LFxuXG4gIC8qKlxuICAgKiBodHRwczovL2dpdGh1Yi5jb20vYWhlY2ttYW5uL21xdWVyeS9ibG9iL21hc3Rlci9saWIvbXF1ZXJ5LmpzXG4gICAqIG1xdWVyeS5zZWxlY3RcbiAgICpcbiAgICogU3BlY2lmaWVzIHdoaWNoIGRvY3VtZW50IGZpZWxkcyB0byBpbmNsdWRlIG9yIGV4Y2x1ZGVcbiAgICpcbiAgICogIyMjI1N0cmluZyBzeW50YXhcbiAgICpcbiAgICogV2hlbiBwYXNzaW5nIGEgc3RyaW5nLCBwcmVmaXhpbmcgYSBwYXRoIHdpdGggYC1gIHdpbGwgZmxhZyB0aGF0IHBhdGggYXMgZXhjbHVkZWQuIFdoZW4gYSBwYXRoIGRvZXMgbm90IGhhdmUgdGhlIGAtYCBwcmVmaXgsIGl0IGlzIGluY2x1ZGVkLlxuICAgKlxuICAgKiAjIyMjRXhhbXBsZVxuICAgKlxuICAgKiAgICAgLy8gaW5jbHVkZSBhIGFuZCBiLCBleGNsdWRlIGNcbiAgICogICAgIHF1ZXJ5LnNlbGVjdCgnYSBiIC1jJyk7XG4gICAqXG4gICAqICAgICAvLyBvciB5b3UgbWF5IHVzZSBvYmplY3Qgbm90YXRpb24sIHVzZWZ1bCB3aGVuXG4gICAqICAgICAvLyB5b3UgaGF2ZSBrZXlzIGFscmVhZHkgcHJlZml4ZWQgd2l0aCBhIFwiLVwiXG4gICAqICAgICBxdWVyeS5zZWxlY3Qoe2E6IDEsIGI6IDEsIGM6IDB9KTtcbiAgICpcbiAgICogIyMjI05vdGVcbiAgICpcbiAgICogQ2Fubm90IGJlIHVzZWQgd2l0aCBgZGlzdGluY3QoKWBcbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBhcmdcbiAgICogQHJldHVybiB7UXVlcnl9IHRoaXNcbiAgICogQHNlZSBTY2hlbWFUeXBlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuICB0cmFuc2Zvcm1GaWVsZHM6IGZ1bmN0aW9uIHNlbGVjdCAoKSB7XG4gICAgdmFyIGFyZyA9IGFyZ3VtZW50c1swXTtcbiAgICBpZiAoIWFyZykgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBzZWxlY3Q6IHNlbGVjdCBvbmx5IHRha2VzIDEgYXJndW1lbnRcIik7XG4gICAgfVxuXG4gICAgdmFyIGZpZWxkcyA9IHRoaXMuX2ZpZWxkcyB8fCAodGhpcy5fZmllbGRzID0ge30pO1xuICAgIHZhciB0eXBlID0gdHlwZW9mIGFyZztcblxuICAgIGlmICgnc3RyaW5nJyA9PSB0eXBlIHx8ICdvYmplY3QnID09IHR5cGUgJiYgJ251bWJlcicgPT0gdHlwZW9mIGFyZy5sZW5ndGggJiYgIUFycmF5LmlzQXJyYXkoYXJnKSkge1xuICAgICAgaWYgKCdzdHJpbmcnID09IHR5cGUpXG4gICAgICAgIGFyZyA9IGFyZy5zcGxpdCgvXFxzKy8pO1xuXG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gYXJnLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgIHZhciBmaWVsZCA9IGFyZ1tpXTtcbiAgICAgICAgaWYgKCFmaWVsZCkgY29udGludWU7XG4gICAgICAgIHZhciBpbmNsdWRlID0gJy0nID09IGZpZWxkWzBdID8gMCA6IDE7XG4gICAgICAgIGlmIChpbmNsdWRlID09PSAwKSBmaWVsZCA9IGZpZWxkLnN1YnN0cmluZygxKTtcbiAgICAgICAgZmllbGRzW2ZpZWxkXSA9IGluY2x1ZGU7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGlmIChfLmlzT2JqZWN0KGFyZykgJiYgIUFycmF5LmlzQXJyYXkoYXJnKSkge1xuICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhhcmcpO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGZpZWxkc1trZXlzW2ldXSA9IGFyZ1trZXlzW2ldXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgc2VsZWN0KCkgYXJndW1lbnQuIE11c3QgYmUgc3RyaW5nIG9yIG9iamVjdC4nKTtcbiAgfSxcblxuICAvLyDQn9GA0L7QsdC10LbQsNGC0YzRgdGPINC/0L4g0LLRgdC10Lwg0YDQvtC00LjRgtC10LvRjNGB0LrQuNC8INGA0LXRgdGD0YDRgdCw0Lwg0Lgg0YHQvtCx0YDQsNGC0YwgdXJsICjQsdC10LcgcXVlcnkgc3RyaW5nKVxuICBjb25zdHJ1Y3RVcmw6IGZ1bmN0aW9uIGNvbnN0cnVjdFVybCggcmVjdXJzaW9uQ2FsbCApe1xuICAgIC8vIHRvZG86INC/0YDQvtCy0LXRgNC40YLRjCDQvdCw0LTQvtCx0L3QvtGB0YLRjCDQt9Cw0LrQvtC80LzQtdC90YLQuNGA0L7QstCw0L3QvdC+0LPQviDQutC+0LTQsFxuICAgIC8vINGD0YHQu9C+0LLQuNC1INGBIHJlY3Vyc2lvbkNhbGwg0LTQvtCx0LDQstC70Y/QtdGCINGB0LvRjdGIINCyINGD0YDQuyDQv9C10YDQtdC0INC30L3QsNC60L7QvCDQstC+0L/RgNC+0YHQsFxuICAgIC8vdmFyIGlkZW50aXR5ID0gdGhpcy5pZGVudGl0eSA/ICcvJyArIHRoaXMuaWRlbnRpdHkgOiByZWN1cnNpb25DYWxsID8gJycgOiAnLyc7XG4gICAgdmFyIGlkZW50aXR5ID0gdGhpcy5pZGVudGl0eSA/ICcvJyArIHRoaXMuaWRlbnRpdHkgOiAnJztcblxuICAgIC8vINCf0YDQvtCx0LXQttCw0YLRjNGB0Y8g0L/QviDQstGB0LXQvCDRgNC10YHRg9GA0YHQsNC8INC4INC30LDQs9C70Y/QvdGD0YLRjCDQsiDQutC+0YDQtdC90Ywg0LDQv9C4LCDRh9GC0L7QsdGLINGB0L7QsdGA0LDRgtGMIHVybFxuICAgIHJldHVybiB0aGlzLnBhcmVudFJlc291cmNlXG4gICAgICA/IGNvbnN0cnVjdFVybC5jYWxsKCB0aGlzLnBhcmVudFJlc291cmNlLCB0cnVlICkgKyAnLycgKyB0aGlzLnVybCArIGlkZW50aXR5XG4gICAgICA6IHRoaXMudXJsO1xuICB9LFxuXG4gIF9yZXNvdXJjZVJlcXVlc3Q6IGZ1bmN0aW9uKCBtZXRob2QsIGFqYXhTZXR0aW5ncywgZG9uZUNhbGxiYWNrICl7XG4gICAgdmFyIHVybCA9IHRoaXMuY29uc3RydWN0VXJsKClcbiAgICAgICwgdXNlTm90aWZpY2F0aW9ucyA9IHRoaXMubm90aWZpY2F0aW9ucztcblxuICAgIGNvbnNvbGUubG9nKCB0aGlzLnJlc291cmNlTmFtZSArICc6OicgKyBtZXRob2QgKyAnICcgKyB1cmwgKTtcbiAgICByZXR1cm4gdGhpcy5pbnN0YW5jZS5fcmVxdWVzdCggbWV0aG9kLCB1cmwsIGFqYXhTZXR0aW5ncy5kYXRhLCBhamF4U2V0dGluZ3MsIHVzZU5vdGlmaWNhdGlvbnMsIGRvbmVDYWxsYmFjayApO1xuICB9XG59O1xuXG52YXIgcmVxdWVzdHNUYWJsZSA9IFtdO1xuXG52YXIgbWV0aG9kc01hcCA9IHtcbiAgJ2NyZWF0ZSc6ICdQT1NUJyxcbiAgJ3JlYWQnOiAgICdHRVQnLFxuICAndXBkYXRlJzogJ1BVVCcsXG4gICdkZWxldGUnOiAnREVMRVRFJyxcbiAgJ3BhdGNoJzogICdQQVRDSCcsXG5cbiAgJ3Bvc3QnOiAgICdQT1NUJyxcbiAgJ2dldCc6ICAgICdHRVQnLFxuICAnc2F2ZSc6ICAgJ1BVVCdcbn07XG5cbl8uZm9yRWFjaCggT2JqZWN0LmtleXMoIG1ldGhvZHNNYXAgKSwgZnVuY3Rpb24oIHZlcmIgKXtcbiAgLyoqXG4gICAqINCX0LDQv9GA0L7RgdGLIGNyZWF0ZSByZWFkIHVwZGF0ZSBkZWxldGUgcGF0Y2ggZ2V0IHBvc3RcbiAgICpcbiAgICog0JIgYWpheFNldHRpbmdzINC80L7QttC90L4g0YPQutCw0LfQsNGC0Ywg0L/QvtC70LUgZG9Ob3RTdG9yZSAtINGH0YLQvtCx0Ysg0L3QtSDRgdC+0YXRgNCw0L3Rj9GC0Ywg0L/QvtC70YPRh9C10L3QvdGL0Lkg0L7QsdGK0LXQutGCINCyIHN0b3JhZ2VcbiAgICpcbiAgICogQHBhcmFtIFtkYXRhXVxuICAgKiBAcGFyYW0gW2FqYXhTZXR0aW5nc11cbiAgICogQHBhcmFtIFtkb25lQ2FsbGJhY2tdXG4gICAqIEByZXR1cm5zIHsqfVxuICAgKi9cbiAgcmVzb3VyY2VNaXhpblsgdmVyYiBdID0gZnVuY3Rpb24oIGRhdGEsIGFqYXhTZXR0aW5ncywgZG9uZUNhbGxiYWNrICl7XG4gICAgdmFyIHJlc291cmNlID0gdGhpcyxcbiAgICAgIGlkZW50aXR5ID0gdGhpcy5pZGVudGl0eSxcbiAgICAgIG1ldGhvZCA9IHRoaXMuaW5zdGFuY2UubWV0aG9kc01hcFsgdmVyYl0sXG4gICAgICBkb2N1bWVudElkU3RyaW5nO1xuXG4gICAgLy8g0JXRgdC70LggZGF0YSAtINC10YHRgtGMINGE0YPQvdC60YbQuNGPLCDRgtC+INGN0YLQviBkb25lQ2FsbGJhY2tcbiAgICBpZiAoICQuaXNGdW5jdGlvbiggZGF0YSApICl7XG4gICAgICBkb25lQ2FsbGJhY2sgPSBkYXRhO1xuICAgICAgZGF0YSA9IHVuZGVmaW5lZDtcbiAgICB9XG4gICAgaWYgKCAkLmlzRnVuY3Rpb24oIGFqYXhTZXR0aW5ncyApICl7XG4gICAgICBkb25lQ2FsbGJhY2sgPSBhamF4U2V0dGluZ3M7XG4gICAgICBhamF4U2V0dGluZ3MgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgYWpheFNldHRpbmdzID0gYWpheFNldHRpbmdzIHx8IHt9O1xuXG4gICAgLy8g0J/RgNC4INGB0L7RhdGA0LDQvdC10L3QuNC4INC00L7QutGD0LzQtdC90YLQsCDQvdGD0LbQvdC+INGB0L7RhdGA0LDQvdGP0YLRjCDRgtC+0LvRjNC60L4g0LjQt9C80LXQvdGR0L3QvdGL0LUg0L/QvtC70Y9cbiAgICBpZiAoIG1ldGhvZCA9PT0gJ1BPU1QnIHx8IG1ldGhvZCA9PT0gJ1BVVCcgKXtcbiAgICAgIC8vINCY0L3QvtCz0LTQsCDQv9C10YDQtdC00LDRjtGCINC00L7QutGD0LzQtdC90YJcbiAgICAgIGlmICggZGF0YSBpbnN0YW5jZW9mIHN0b3JhZ2UuRG9jdW1lbnQgKSB7XG4gICAgICAgIGRvY3VtZW50SWRTdHJpbmcgPSBkYXRhLl9pZC50b1N0cmluZygpO1xuICAgICAgICBkYXRhID0gZGF0YS4kX19kZWx0YSgpO1xuXG4gICAgICAgIC8vINCi0LDQuiDQvNC+0LbQvdC+INC/0L7QvdGP0YLRjCwg0YfRgtC+INC80Ysg0YHQvtGF0YDQsNC90Y/QtdC8INGB0YPRidC10YLQstGD0Y7RidC40Lkg0L3QsCDRgdC10YDQstC10YDQtSBEb2N1bWVudFxuICAgICAgfSBlbHNlIGlmICggc3RvcmFnZS5PYmplY3RJZC5pc1ZhbGlkKCBpZGVudGl0eSApICkge1xuICAgICAgICBkb2N1bWVudElkU3RyaW5nID0gaWRlbnRpdHk7XG5cbiAgICAgICAgLy8g0J/RgNC4INGB0L7RhdGA0LDQvdC10L3QuNC4INGH0LXRgNC10Lcg0LzQtdGC0L7QtCBzYXZlKCkg0YMg0LTQvtC60YPQvNC10L3RgtCwXG4gICAgICB9IGVsc2UgaWYgKCBkYXRhLl9pZCAmJiBzdG9yYWdlLk9iamVjdElkLmlzVmFsaWQoIGRhdGEuX2lkICkgKSB7XG4gICAgICAgIGRvY3VtZW50SWRTdHJpbmcgPSBkYXRhLl9pZC50b1N0cmluZygpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGFqYXhTZXR0aW5ncy5kYXRhID0gZGF0YTtcblxuICAgIHZhciByZXFJbmZvID0ge1xuICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICB1cmw6IHRoaXMuY29uc3RydWN0VXJsKCksXG4gICAgICBhamF4U2V0dGluZ3M6IGFqYXhTZXR0aW5ncyxcbiAgICAgIHJlc3VsdDogbnVsbCxcbiAgICAgIG1ldGE6IG51bGxcbiAgICB9O1xuXG4gICAgLy9UT0RPOiDQtNC+0LTQtdC70LDRgtGMINC60Y3RiNC40YDQvtCy0LDQvdC40LVcbiAgICAvLyDQmtGN0YjQuNGA0L7QstCw0L3QuNC1INC90LAg0YfRgtC10L3QuNC1XG4gICAgaWYgKCBtZXRob2QgPT09ICdHRVQnICl7XG4gICAgICB2YXIgaW5DYWNoZSA9IF8uZmluZCggcmVxdWVzdHNUYWJsZSwgcmVxSW5mbyApO1xuXG4gICAgICBpZiAoIHJlc291cmNlLnN0b3JhZ2UgJiYgaWRlbnRpdHkgJiYgaW5DYWNoZSApe1xuICAgICAgICAvLyDQldGB0LvQuCDQtNCw0L3QvdC+0LUg0LXRgdGC0YwgLSDQstC10YDQvdGD0YLRjCDQtdCz0L5cbiAgICAgICAgaWYgKCBpbkNhY2hlLnJlc3VsdCApe1xuICAgICAgICAgIGRvbmVDYWxsYmFjayAmJiBkb25lQ2FsbGJhY2soIGluQ2FjaGUucmVzdWx0LCBpbkNhY2hlLm1ldGEgKTtcbiAgICAgICAgICB0aGlzLmlkZW50aXR5ID0gJyc7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGRmZCA9ICQuRGVmZXJyZWQoKTtcbiAgICB0aGlzLl9yZXNvdXJjZVJlcXVlc3QoIHZlcmIsIGFqYXhTZXR0aW5ncyApLmRvbmUoZnVuY3Rpb24oIHJlc3BvbnNlLCB0ZXh0U3RhdHVzLCBqcVhIUiApe1xuICAgICAgdmFyIHJlc3VsdCwgZmllbGRzO1xuXG4gICAgICAvLyNleGFtcGxlICAgIHZzLmFwaS5wbGFjZXMoe2ZpZWxkczogJ25hbWUnLCBza2lwOiAxMDB9KS5nZXQoZnVuY3Rpb24ocmVzKXtjb25zb2xlLmxvZyhyZXMpfSk7XG4gICAgICAvLyDQldGB0LvQuCDQsdGL0LvQsCDQstGL0LHQvtGA0LrQsCDQv9C+INC/0L7Qu9GP0LwsINC90YPQttC90L4g0L/RgNCw0LLQuNC70YzQvdC+INC+0LHRgNCw0LHQvtGC0LDRgtGMINC10ZEg0Lgg0L/QtdGA0LXQtNCw0YLRjCDQsiDQtNC+0LrRg9C80LXQvdGCXG4gICAgICBpZiAoIGRhdGEgJiYgZGF0YS5maWVsZHMgKXtcbiAgICAgICAgZmllbGRzID0gcmVzb3VyY2UudHJhbnNmb3JtRmllbGRzKCBkYXRhLmZpZWxkcyApO1xuICAgICAgfVxuXG4gICAgICAvLyDQn9GA0Lgg0LjRgdC/0L7Qu9GM0LfQvtCy0LDQvdC40Lgg0L/QsNGA0LDQvNC10YLRgNCwIGRvTm90U3RvcmUgLSDQvdC1INC90LDQtNC+INGB0L7RhdGA0LDQvdGP0YLRjCDQvtGC0LLQtdGCINCyINGF0YDQsNC90LjQu9C40YnQtVxuICAgICAgaWYgKCByZXNvdXJjZS5zdG9yYWdlICYmICFhamF4U2V0dGluZ3MuZG9Ob3RTdG9yZSApe1xuICAgICAgICAvLyDQn9GA0Lgg0YHQvtGF0YDQsNC90LXQvdC40Lgg0Lgg0L7QsdC90L7QstC70LXQvdC40Lgg0L3Rg9C20L3QviDQvtCx0L3QvtCy0LvRj9GC0Ywg0LTQvtC60YPQvNC10L3RglxuICAgICAgICBpZiAoIG1ldGhvZCA9PT0gJ1BPU1QnIHx8IG1ldGhvZCA9PT0gJ1BVVCcgKXtcbiAgICAgICAgICAvLyDQn9C+0L/RgNC+0LHRg9C10Lwg0YHQvdCw0YfQsNC70LAg0L3QsNC50YLQuCDQtNC+0LrRg9C80LXQvdGCINC/0L4gaWQg0Lgg0L7QsdC90L7QstC40YLRjCDQtdCz0L5cbiAgICAgICAgICByZXN1bHQgPSBzdG9yYWdlWyByZXNvdXJjZS5jb2xsZWN0aW9uTmFtZSBdLmZpbmRCeUlkKCBkb2N1bWVudElkU3RyaW5nICk7XG5cbiAgICAgICAgICBpZiAoIHJlc3VsdCApe1xuICAgICAgICAgICAgLy8g0J7QsdC90L7QstC70Y/QtdC8INC00L7QutGD0LzQtdC90YJcbiAgICAgICAgICAgIHJlc3VsdC5zZXQoIHJlc3BvbnNlLnJlc3VsdCApO1xuXG4gICAgICAgICAgICAvLyDQodC+0LfQtNCw0ZHQvCDRgdGB0YvQu9C60YMg0L/QviDQvdC+0LLQvtC80YMgaWQg0LIg0LrQvtC70LvQtdC60YbQuNC4XG4gICAgICAgICAgICBzdG9yYWdlWyByZXNvdXJjZS5jb2xsZWN0aW9uTmFtZSBdLmRvY3VtZW50c1sgZG9jdW1lbnRJZFN0cmluZyBdID0gcmVzdWx0O1xuXG4gICAgICAgICAgICAvLyDQrdGC0L7RgiDQtNC+0LrRg9C80LXQvdGCINGC0LXQv9C10YDRjCDRgdC+0YXRgNCw0L3RkdC9INC90LAg0YHQtdGA0LLQtdGA0LUsINC30L3QsNGH0LjRgiDQvtC9INGD0LbQtSDQvdC1INC90L7QstGL0LkuXG4gICAgICAgICAgICByZXN1bHQuaXNOZXcgPSBmYWxzZTtcblxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQgPSBzdG9yYWdlWyByZXNvdXJjZS5jb2xsZWN0aW9uTmFtZSBdLmFkZCggcmVzcG9uc2UucmVzdWx0IHx8IHJlc3BvbnNlLCB1bmRlZmluZWQsIHRydWUgKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIGlmICggbWV0aG9kID09PSAnR0VUJyApe1xuICAgICAgICAgIC8vINCd0LUg0LTQvtCx0LDQstC70Y/RgtGMINCyINGF0YDQsNC90LjQu9C40YnQtSDRgNC10LfRg9C70YzRgtCw0YIg0LfQsNC/0YDQvtGB0L7QsiDRgSDQstGL0LHQvtGA0LrQvtC5INC/0L7Qu9C10LlcbiAgICAgICAgICBpZiAoIGZpZWxkcyApe1xuICAgICAgICAgICAgcmVzdWx0ID0gcmVzcG9uc2UucmVzdWx0O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQgPSBzdG9yYWdlWyByZXNvdXJjZS5jb2xsZWN0aW9uTmFtZSBdLmFkZCggcmVzcG9uc2UucmVzdWx0IHx8IHJlc3BvbnNlLCBmaWVsZHMsIHRydWUgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdCA9IHJlc3BvbnNlLnJlc3VsdCB8fCByZXNwb25zZTtcbiAgICAgIH1cblxuICAgICAgLy8g0KHQvtGF0YDQsNC90LjRgtGMINC/0LDRgNCw0LzQtdGC0YDRiyDQt9Cw0L/RgNC+0YHQsCDQuCDQvtGC0LLQtdGCINC00LvRjyDQutGN0YjQuNGA0L7QstCw0L3QuNGPXG4gICAgICByZXFJbmZvLnJlc3VsdCA9IHJlc3VsdDtcbiAgICAgIHJlcUluZm8ubWV0YSA9IHJlc3BvbnNlLm1ldGE7XG4gICAgICByZXF1ZXN0c1RhYmxlLnB1c2goIHJlcUluZm8gKTtcblxuICAgICAgZG9uZUNhbGxiYWNrICYmIGRvbmVDYWxsYmFjayggcmVzdWx0LCByZXNwb25zZS5tZXRhICk7XG4gICAgICBkZmQucmVzb2x2ZSggcmVzdWx0LCByZXNwb25zZS5tZXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApO1xuXG4gICAgfSkuZmFpbChmdW5jdGlvbigganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICl7XG4gICAgICBkZmQucmVqZWN0KCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKTtcbiAgICB9KTtcblxuICAgIC8vVE9ETzog0JjRgdC/0L7Qu9GM0LfQvtCy0LDRgtGMINC40LTQtdC+0LvQvtCz0Y4gcXVlcnk/IHF1ZXJ5INC+0LHRitC10LrRgiDQtNC70Y8g0L/QvtGB0YLRgNC+0LXQvdC40Y8g0LfQsNC/0YDQvtGB0L7QslxuXG4gICAgLy8gaWRlbnRpdHkg0YHQvtGF0YDQsNC90Y/QtdGC0YHRjyDQtNC70Y8gY29uc3RydWN0VXJsLCDQtdCz0L4g0L3Rg9C20L3QviDQvtGH0LjRgdGC0LjRgtGMINC00LvRjyDQv9C+0YHQu9C10LTRg9GO0YnQuNGFINC30LDQv9GA0L7RgdC+0LIuXG4gICAgdGhpcy5pZGVudGl0eSA9ICcnO1xuXG4gICAgcmV0dXJuIGRmZDtcbiAgfTtcbn0pO1xuXG4vKipcbiAqINCa0LDQuiDQsdGLINC60L7QvdGB0YLRgNGD0LrRgtC+0YAg0YDQtdGB0YPRgNGB0LAsINC90L4g0LLQvtC30LLRgNCw0YnQsNC10YIg0YTRg9C90LrRhtC40Y4t0L7QsdGK0LXQutGCINGBINC/0YDQuNC80LXRgdGP0LzQuFxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSByZXNvdXJjZU5hbWVcbiAqIEBwYXJhbSB7b2JqZWN0fSBwYXJlbnRSZXNvdXJjZVxuICogQHBhcmFtIHtvYmplY3R9IHVzZXJzTWl4aW5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gcmVzb3VyY2VcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgUmVzb3VyY2UgPSBmdW5jdGlvbiggcmVzb3VyY2VOYW1lLCBwYXJlbnRSZXNvdXJjZSwgdXNlcnNNaXhpbiApe1xuXG4gIC8qKlxuICAgKiDQrdGC0YMg0YTRg9C90LrRhtC40Y4g0LzRiyDQvtGC0LTQsNGR0Lwg0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GOINCyINC60LDRh9C10YHRgtCy0LUg0LTQvtGB0YLRg9C/0LAg0Log0YDQtdGB0YPRgNGB0YMuXG4gICAqINCe0L3QsCDQv9C+0LfQstC+0LvRj9C10YIg0LfQsNC00LDRgtGMIGlkZW50aXR5INC4INC00L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0L/QsNGA0LDQvNC10YLRgNGLINCyINC30LDQv9GA0L7RgS5cbiAgICpcbiAgICogQHBhcmFtIFtpZGVudGl0eV1cbiAgICogQHJldHVybnMge0Z1bmN0aW9ufVxuICAgKi9cbiAgdmFyIHJlc291cmNlID0gZnVuY3Rpb24gcmVzb3VyY2UoIGlkZW50aXR5ICl7XG4gICAgaWYgKCBpZGVudGl0eSAmJiAhXy5pc1N0cmluZyggaWRlbnRpdHkgKSApe1xuICAgICAgY29uc29sZS5lcnJvcignaWRlbnRpdHkg0LTQvtC70LbQtdC9INCx0YvRgtGMINGB0YLRgNC+0LrQvtC5LCDQsCDQvdC1JywgaWRlbnRpdHkgKTtcbiAgICB9XG5cbiAgICByZXNvdXJjZS5pZGVudGl0eSA9IGlkZW50aXR5IHx8ICcnO1xuXG4gICAgcmV0dXJuIHJlc291cmNlO1xuICB9O1xuXG4gICQuZXh0ZW5kKCByZXNvdXJjZSwgcmVzb3VyY2VNaXhpbiwge1xuICAgIHJlc291cmNlTmFtZTogcmVzb3VyY2VOYW1lLFxuICAgIHVybDogcmVzb3VyY2VOYW1lXG4gIH0sIHVzZXJzTWl4aW4gKTtcblxuICByZXNvdXJjZS5wYXJlbnRSZXNvdXJjZSA9IHBhcmVudFJlc291cmNlO1xuICByZXNvdXJjZS5pbnN0YW5jZSA9IHBhcmVudFJlc291cmNlLmluc3RhbmNlIHx8IHBhcmVudFJlc291cmNlO1xuXG4gIHJldHVybiByZXNvdXJjZTtcbn07XG5cbi8qKlxuICog0KHQvtC30LTQsNGC0Ywg0L3QvtCy0YvQuSDRjdC60LfQtdC80L/Qu9GP0YAgYXBpINC60LvQuNC10L3RgtCwXG4gKlxuICogQGV4YW1wbGVcbiAqIEFwaUNsaWVudCgnL2FwaScsIHtcbiAqICAgaG9va3M6IHtcbiAqICAgICBoZWFkZXJzOiB7XG4gKiAgICAgICB0b2tlbjogJ1hYWFhYWCdcbiAqICAgICB9XG4gKiAgIH1cbiAqIH0pO1xuICpcbiAqIEFwaUNsaWVudCgnaHR0cHM6Ly9kb21haW4uY29tL2FwaScsIHtcbiAqICAgaG9va3M6IHtcbiAqICAgICBoZWFkZXJzOiB7XG4gKiAgICAgICB0b2tlbjogJ1hYWFhYWCdcbiAqICAgICB9XG4gKiAgIH1cbiAqIH0pO1xuICpcbiAqIEFwaUNsaWVudCh7XG4gKiAgIHVybDogJy9hcGknXG4gKiAgIGhvb2tzOiB7XG4gKiAgICAgaGVhZGVyczoge1xuICogICAgICAgdG9rZW46ICdYWFhYWFgnXG4gKiAgICAgfVxuICogICB9XG4gKiB9KTtcbiAqXG4gKiBAcGFyYW0gdXJsIC0g0YHRgdGL0LvQutCwINC90LAg0LrQvtGA0LXQvdGMIGFwaVxuICogQHBhcmFtIG9wdGlvbnMgLSDQvtC/0YbQuNC4INC00LvRjyDQutC70LjQtdC90YLQsFxuICovXG52YXIgQXBpQ2xpZW50ID0gZnVuY3Rpb24oIHVybCwgb3B0aW9ucyApe1xuICByZXR1cm4gbmV3IEFwaUNsaWVudC5pbnN0YW5jZS5pbml0KCB1cmwsIG9wdGlvbnMgKTtcbn07XG5cbkFwaUNsaWVudC5pbnN0YW5jZSA9IEFwaUNsaWVudC5wcm90b3R5cGUgPSB7XG4gIGNvbnN0cnVjdG9yOiBBcGlDbGllbnQsXG5cbiAgLyoqXG4gICAqINCY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINC90L7QstC+0LPQviDQsNC/0Lgg0LrQu9C40LXQvdGC0LBcbiAgICogQHBhcmFtIHVybFxuICAgKiBAcGFyYW0gb3B0aW9uc1xuICAgKi9cbiAgaW5pdDogZnVuY3Rpb24oIHVybCwgb3B0aW9ucyApe1xuICAgIGlmICggdHlwZW9mIHVybCA9PT0gJ3N0cmluZycgKXtcbiAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgICAgb3B0aW9ucy51cmwgPSB1cmw7XG4gICAgfVxuXG4gICAgLy8g0J/QviDRg9C80L7Qu9GH0LDQvdC40Y4sINGD0LLQtdC00L7QvNC70LXQvdC40Y8g0L7RgtC60LvRjtGH0LXQvdGLXG4gICAgdGhpcy5ub3RpZmljYXRpb25zID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiDQpdGD0LrQuCDQtNC70Y8gYWpheCBzZXR0aW5ncyAo0LLRi9GB0YLRg9C/0LDQtdGCINCyINGA0L7Qu9C4INCx0LDQt9C+0LLQvtCz0L4gYWpheFNldHRpbmdzKVxuICAgICAqIEBzZWUgaHR0cDovL2FwaS5qcXVlcnkuY29tL2pRdWVyeS5hamF4L1xuICAgICAqXG4gICAgICogQHR5cGUge09iamVjdH1cbiAgICAgKi9cbiAgICB0aGlzLmhvb2tzID0ge1xuICAgICAgLy8g0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQtNCw0L3QvdGL0LUg0LfQsNC/0YDQvtGB0LBcbiAgICAgIGRhdGE6IHt9LFxuICAgICAgLy8g0J7QsdGK0LXQutGCINC00LvRjyDQtNC+0LHQsNCy0LvQtdC90LjRjyDQv9GA0L7QuNC30LLQvtC70YzQvdGL0YUg0LfQsNCz0L7Qu9C+0LLQutC+0LIg0LrQviDQstGB0LXQvCDQt9Cw0L/RgNC+0YHQsNC8XG4gICAgICAvLyDRg9C00L7QsdC90L4g0LTQu9GPINCw0LLRgtC+0YDQuNC30LDRhtC40Lgg0L/QviDRgtC+0LrQtdC90LDQvFxuICAgICAgaGVhZGVyczoge31cbiAgICB9O1xuXG4gICAgJC5leHRlbmQoIHRydWUsIHRoaXMsICQuaXNQbGFpbk9iamVjdCggdXJsICkgPyB1cmwgOiBvcHRpb25zICk7XG4gIH0sXG5cbiAgLyoqXG4gICAqINCU0L7QsdCw0LLQuNGC0Ywg0L3QvtCy0YvQuSDRgNC10YHRg9GA0YFcbiAgICogQHNlZSByZXNvdXJjZU1peGluLmFkZFxuICAgKi9cbiAgYWRkOiByZXNvdXJjZU1peGluLmFkZCxcblxuICBtZXRob2RzTWFwOiBtZXRob2RzTWFwLFxuXG4gIF9wcmVwYXJlQWpheFNldHRpbmdzOiBmdW5jdGlvbiggbWV0aG9kLCB1cmwsIGRhdGEsIGFqYXhTZXR0aW5ncyApe1xuICAgIHZhciB0eXBlID0gdGhpcy5tZXRob2RzTWFwWyBtZXRob2QgXVxuICAgICAgLCBfYWpheFNldHRpbmdzID0gJC5leHRlbmQoIHRydWUsIHt9LCB0aGlzLmhvb2tzLCBhamF4U2V0dGluZ3MsIHtcbiAgICAgICAgdHlwZTogdHlwZSxcbiAgICAgICAgdXJsOiB1cmxcbiAgICAgIH0pO1xuXG4gICAgLy8g0JTQvtCx0LDQstC70Y/QtdC8INCw0LLRgtC+0YDQuNC30LDRhtC40Y4g0L/QviDRgtC+0LrQtdC90YNcbiAgICBpZiAoIHRoaXMudG9rZW4gJiYgYWpheFNldHRpbmdzLmhlYWRlcnMgJiYgYWpheFNldHRpbmdzLmhlYWRlcnMudG9rZW4gPT0gbnVsbCApe1xuICAgICAgX2FqYXhTZXR0aW5ncy5oZWFkZXJzLkF1dGhvcml6YXRpb24gPSAndG9rZW4gJyArIHRoaXMudG9rZW47XG4gICAgICAvL0FjY2VwdDogJ2FwcGxpY2F0aW9uL3ZuZC5naXRodWIucHJldmlldydcbiAgICB9XG5cbiAgICBpZiAoIHR5cGUgPT09ICdHRVQnICl7XG4gICAgICBfLmFzc2lnbiggX2FqYXhTZXR0aW5ncy5kYXRhLCBkYXRhICk7XG4gICAgfSBlbHNlIGlmICggZGF0YSApe1xuICAgICAgLy8g0JXRgdC70Lgg0YHQvtGF0YDQsNC90Y/QtdC8INC00L7QutGD0LzQtdC90YIsINC90YPQttC90L4g0YHQtNC10LvQsNGC0YwgdG9PYmplY3Qoe2RlcG9wdWxhdGU6IDF9KVxuICAgICAgaWYgKCBkYXRhLmNvbnN0cnVjdG9yICYmIGRhdGEuY29uc3RydWN0b3IubmFtZSAmJiBkYXRhLmNvbnN0cnVjdG9yLm5hbWUgPT09ICdEb2N1bWVudCcgKXtcbiAgICAgICAgXy5hc3NpZ24oIF9hamF4U2V0dGluZ3MuZGF0YSwgZGF0YS50b09iamVjdCh7ZGVwb3B1bGF0ZTogMX0pICk7XG5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIF8uYXNzaWduKCBfYWpheFNldHRpbmdzLmRhdGEsIGRhdGEgKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCBfYWpheFNldHRpbmdzLmNvbnRlbnRUeXBlID09PSAnYXBwbGljYXRpb24vanNvbicgKXtcbiAgICAgICAgX2FqYXhTZXR0aW5ncy5kYXRhID0gSlNPTi5zdHJpbmdpZnkoIF9hamF4U2V0dGluZ3MuZGF0YSApO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHRvZG8g0L/RgNC+0LLQtdGA0YLRjCDQvdCw0LTQvtCx0L3QvtGB0YLRjCDQutC+0LTQsFxuICAgIC8vINCY0YHQv9C+0LvRjNC30YPQtdGC0YHRjyDQtNC70Y8g0LDQu9C40LDRgdC+0LIsINCyINC60L7RgtC+0YDRi9GFINCy0YLQvtGA0L7QuSDQv9Cw0YDQsNC80LXRgtGAIC0g0LXRgdGC0Ywg0L7QsdGK0LXQutGCINC90LDRgdGC0YDQvtC10LpcbiAgICBpZiAoICQuaXNQbGFpbk9iamVjdCggdXJsICkgKXtcbiAgICAgIGNvbnNvbGUuaW5mbygn0JDRhUAq0YLRjCwg0L3Rg9C20L3Ri9C5INC60L7QtCEhISEnKTtcbiAgICAgIF9hamF4U2V0dGluZ3MgPSB1cmw7XG4gICAgICBkZWJ1Z2dlcjtcbiAgICB9XG5cbiAgICByZXR1cm4gX2FqYXhTZXR0aW5ncztcbiAgfSxcblxuICAvKipcbiAgICog0J7RgtC/0YDQsNCy0LjRgtGMINC30LDQv9GA0L7RgSDQvdCwINGB0LXRgNCy0LXRgFxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbWV0aG9kICAg0J3QsNC30LLQsNC90LjQtSDQvNC10YLQvtC00LAgKFBPU1QsIEdFVCwgUFVULCBERUxFVEUsIFBBVENIKVxuICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsICAg0J/QvtC70L3Ri9C5INGD0YDQuyDRgNC10YHRg9GA0YHQsFxuICAgKiBAcGFyYW0ge29iamVjdH0gZGF0YSAgINCe0LHRitC10LrRgiDRgSDQtNCw0L3QvdGL0LzQuCDQtNC70Y8g0LfQsNC/0YDQvtGB0LBcbiAgICogQHBhcmFtIHtvYmplY3R9IGFqYXhTZXR0aW5ncyAgINCe0LHRitC10LrRgiDRgSDQvdCw0YHRgtGA0L7QudC60LDQvNC4XG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gdXNlTm90aWZpY2F0aW9ucyAgINCk0LvQsNCzLCDQuNGB0L/QvtC70YzQt9C+0LLQsNGC0Ywg0LvQuCDRg9Cy0LXQtNC+0LzQu9C10L3QuNGPXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGRvbmVDYWxsYmFjayAgINCk0YPQvdC60YbQuNGPINGD0YHQv9C10YjQvdC+0LPQviDQvtCx0YDQsNGC0L3QvtCz0L4g0LLRi9C30L7QstCwXG4gICAqIEByZXR1cm5zIHskLkRlZmVycmVkfSDQstC+0LfQstGA0LDRidCw0LXRgiBqcXVlcnkgYWpheCDQvtCx0YrQtdC60YJcbiAgICpcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9yZXF1ZXN0OiBmdW5jdGlvbiggbWV0aG9kLCB1cmwsIGRhdGEsIGFqYXhTZXR0aW5ncywgdXNlTm90aWZpY2F0aW9ucywgZG9uZUNhbGxiYWNrICl7XG4gICAgaWYgKCAhXy5pc1N0cmluZyggbWV0aG9kICkgKXtcbiAgICAgIHRocm93IG5ldyBFcnJvcign0J/QsNGA0LDQvNC10YLRgCBgbWV0aG9kYCDQtNC+0LvQttC10L0g0LHRi9GC0Ywg0YHRgtGA0L7QutC+0LksINCwINC90LUgJywgbWV0aG9kICk7XG4gICAgfVxuXG4gICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgICAsIHR5cGUgPSB0aGlzLm1ldGhvZHNNYXBbIG1ldGhvZCBdXG4gICAgICAsIG5vdGlmaWNhdGlvblR5cGUgPSB0eXBlID09PSAnR0VUJyA/ICdsb2FkJyA6ICggdHlwZSA9PT0gJ1BPU1QnIHx8IHR5cGUgPT09ICdQVVQnIHx8IHR5cGUgPT09ICdQQVRDSCcgKSA/ICdzYXZlJyA6ICdkZWxldGUnXG4gICAgICAsIF9hamF4U2V0dGluZ3MgPSB0aGlzLl9wcmVwYXJlQWpheFNldHRpbmdzKCBtZXRob2QsIHVybCwgZGF0YSwgYWpheFNldHRpbmdzICk7XG5cbiAgICAvLyDQmNGB0L/QvtC70YzQt9C+0LLQsNGC0Ywg0LfQvdCw0YfQtdC90LjQtSDQv9C+INGD0LzQvtC70YfQsNC90LjRjiwg0LXRgdC70LggdXNlTm90aWZpY2F0aW9ucyDQvdC1INC30LDQtNCw0L1cbiAgICAvLyDRgtGD0YIg0LbQtSDQv9C+0YDQstC10YDRj9C10LwsINC/0L7QtNC60LvRjtGH0LXQvdGLINC70Lgg0YPQstC10LTQvtC80LvQtdC90LjRj1xuICAgIGlmICggXy5pc0Jvb2xlYW4oIHVzZU5vdGlmaWNhdGlvbnMgKSApe1xuICAgICAgdXNlTm90aWZpY2F0aW9ucyA9IHVzZU5vdGlmaWNhdGlvbnMgJiYgY2Yubm90aWZpY2F0aW9uO1xuICAgIH0gZWxzZSB7XG4gICAgICB1c2VOb3RpZmljYXRpb25zID0gdGhpcy5ub3RpZmljYXRpb25zICYmIGNmLm5vdGlmaWNhdGlvbjtcbiAgICB9XG5cbiAgICBpZiAoIHVzZU5vdGlmaWNhdGlvbnMgKXtcbiAgICAgIGNmLm5vdGlmaWNhdGlvblsgbm90aWZpY2F0aW9uVHlwZSBdLnNob3coKTtcbiAgICB9XG5cbiAgICByZXR1cm4gJC5hamF4KCBfYWpheFNldHRpbmdzICkuZmFpbChmdW5jdGlvbigganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICl7XG4gICAgICBjb25zb2xlLndhcm4oIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApO1xuXG4gICAgICAvLyBVbmF1dGhvcml6ZWQgQ2FsbGJhY2tcbiAgICAgIGlmICgganFYSFIuc3RhdHVzID09PSA0MDEgJiYgc2VsZi51bmF1dGhvcml6ZWRDYWxsYmFjayApe1xuICAgICAgICBzZWxmLnVuYXV0aG9yaXplZENhbGxiYWNrKCBqcVhIUiwgbWV0aG9kLCB1cmwsIGRhdGEsIGFqYXhTZXR0aW5ncywgZG9uZUNhbGxiYWNrICk7XG5cbiAgICAgICAgLy8g0J3QtSDQv9C+0LrQsNC30YvQstCw0YLRjCDRgdC+0L7QsdGJ0LXQvdC40LUg0YEg0L7RiNC40LHQutC+0Lkg0L/RgNC4IDQwMSwg0LXRgdC70Lgg0LLRgdGRINC/0LvQvtGF0L4sINGC0L4g0YDQvtGD0YLQtdGAINGB0LDQvCDQv9C10YDQtdC60LjQvdC10YIg0L3QsCDRhNC+0YDQvNGDINCy0YXQvtC00LBcbiAgICAgICAgaWYgKCB1c2VOb3RpZmljYXRpb25zICl7XG4gICAgICAgICAgY2Yubm90aWZpY2F0aW9uWyBub3RpZmljYXRpb25UeXBlIF0uaGlkZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoIHVzZU5vdGlmaWNhdGlvbnMgKXtcbiAgICAgICAgY2Yubm90aWZpY2F0aW9uWyBub3RpZmljYXRpb25UeXBlIF0uZmFpbCgpO1xuICAgICAgfVxuXG4gICAgfSkuZG9uZShmdW5jdGlvbigpe1xuICAgICAgaWYgKCB1c2VOb3RpZmljYXRpb25zICl7XG4gICAgICAgIGNmLm5vdGlmaWNhdGlvblsgbm90aWZpY2F0aW9uVHlwZSBdLmhpZGUoKTtcbiAgICAgIH1cbiAgICB9KS5kb25lKCBkb25lQ2FsbGJhY2sgKTtcbiAgfSxcblxuICAvKipcbiAgICog0JzQtdGC0L7QtCDQtNC70Y8g0YfRgtC10L3QuNGPINC60L7RgNC90Y8gYXBpXG4gICAqXG4gICAqIEBwYXJhbSBhamF4U2V0dGluZ3NcbiAgICogQHBhcmFtIGRvbmVDYWxsYmFja1xuICAgKiBAcmV0dXJucyB7JC5EZWZlcnJlZH1cbiAgICovXG4gIHJlYWQ6IGZ1bmN0aW9uKCBhamF4U2V0dGluZ3MsIGRvbmVDYWxsYmFjayApe1xuICAgIGNvbnNvbGUubG9nKCAnYXBpOjpyZWFkJyApO1xuICAgIGlmICggJC5pc0Z1bmN0aW9uKCBhamF4U2V0dGluZ3MgKSApe1xuICAgICAgZG9uZUNhbGxiYWNrID0gYWpheFNldHRpbmdzO1xuICAgICAgYWpheFNldHRpbmdzID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGFqYXhTZXR0aW5ncyA9IGFqYXhTZXR0aW5ncyB8fCB7fTtcblxuICAgIHJldHVybiB0aGlzLl9yZXF1ZXN0KCdyZWFkJywgdGhpcy51cmwsIHVuZGVmaW5lZCwgYWpheFNldHRpbmdzLCBmYWxzZSwgZG9uZUNhbGxiYWNrICk7XG4gIH1cbn07XG5cbkFwaUNsaWVudC5pbnN0YW5jZS5pbml0LnByb3RvdHlwZSA9IEFwaUNsaWVudC5pbnN0YW5jZTtcblxuLy8gZXhwb3J0c1xubW9kdWxlLmV4cG9ydHMgPSBBcGlDbGllbnQ7Il19
(1)
});
