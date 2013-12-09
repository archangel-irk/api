RESTfull api client
---
Постройте удобный клиент к серверному api.
Библиотека использует подход "цепочки вызывов" для организации прозрачного запроса.
Авторизация доступна по токену.

Dependencies
---
1. jQuery ajax

Basic usage
---
```javascript
var github = api('https://api.github.com', {
  token: '8fbfc540f1ed1417083c70a990b4db3c9aa86efe',
  unauthorizedCallback: function(){} // Вызывается всякий раз, когда код ответа от сервера 401
});

github.read();               // GET https://api.github.com

github.add('user');          // /user
github.add('users');         // /users
github.users.add('repos');   // /users/repos

github.user.read();                                                // GET /user
github.users('archangel-irk').repos.read();                        // GET /users/archangel-irk/repos
github.users('archangel-irk').repos({ sort: 'pushed' }).read();    // GET /users/archangel-irk/repos?sort=pushed
```

Вызов родительских функций
---
```javascript
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

github.search.users.usersMethod(); // search::searchMethod
```

Api
---
Сначала опишем самый верхний уровень.  
`api( url, options )` - функция-конструктор апи клиента, но также используется как обычный объект с методами.  
&nbsp;&nbsp;`url` - адрес к апи, может быть относительным или полным.  
&nbsp;&nbsp;`options` - будет полностью скопирован методом `$.extend` в объект апи.  

Базовые методы для отправки запросов (все они возвращают jsXHR).  
`api._request( method, url, data, headers )` - отправить кастомный ajax запрос.  
`api._request( settings )` - отправить кастомный ajax запрос, передав любые настройки.  
Для удобства есть алиасы `create read update delete patch`  
`api.create( settings, doneCallback )` - отправить кастомный post запрос.  

Так же этот объект можно дополнить своими методами или свойствами используя `api.extend( object )`.  

Тепепь поговорим о апи клиенте, который возвращает функция-конструктор `api()`.  
`api.instance` - прототип апи клиента.  
`api.instance.add( resourceName, base, mixin )` - добавить ресурс к апи клиенту.  
`api.instance.extend( object )` - расширить прототип апи клиента.  
У апи клиента для отправки запросов есть методы `_request( method, url, data, headers )` и
`.read( headers, doneCallback )` т.к. другие методы (post, delete и т.д.) просто не нужны для корня апи.  

И немного о самих ресурсах.  
Resource - это функция со свойствами и методами, позволяющая делать запросы к ресурсам апи.  
Как мы уже знаем, чтобы добавить ресурс к апи, нужно просто вызвать метод `.add( resourceName )` у апи клиента.  
Теперь посмотрим что же есть в самих ресурсах:  
&nbsp;&nbsp;`resourceName` - свойство с именем ресурса, который по умолчанию совпадает с url ресурса.  
&nbsp;&nbsp;`url` - сам url, по умолчанию совпадает с именем ресурса.  
&nbsp;&nbsp;`.constructUrl()` - строим url для отправки запроса.  
&nbsp;&nbsp;`.add( resourceName, base, mixin )` - добавить новый ресурс к уже существующему русурсу.  
&nbsp;&nbsp;`._request( method, headers )` - отправить кастомный запрос на ресурс с заданным методом и заголовками.  
И методы `create read update delete patch` служат только для отправки запросов:  
&nbsp;&nbsp;`.read( headers, doneCallback )` - отправить get запрос.  

Todo
===
Кэширование и работа со [storage](https://github.com/archangel-irk/storage)
