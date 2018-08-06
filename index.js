"use strict";

var _bluebird = _interopRequireDefault(require("bluebird"));

var _fs = _interopRequireDefault(require("fs"));

var _jsBeautify = require("js-beautify");

var _path = _interopRequireDefault(require("path"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var fs = _bluebird.default.promisifyAll(_fs.default); //__MODULES用于映射moduleID


var __MODULES = [// 0: 'index',
  // 1: 'module1'
  // 2: 'test/module2'
]; //读取命令行参数

if (process.argv[2]) {
  console.log("starting bundle " + process.argv[2]);
  pack(process.argv[2]);
} else {
  console.log("No File Input");
}

var outputFile = process.argv[3] || "bundle.js";

function pack(fileName) {
  var name = fileName.replace(/\.js/, "");
  var moduleTemplate = "function(module, exports, require, global){\n{{moduleContent}}\n}"; //递归打包

  bundleModule(name, './').then(function () {
    console.log(__MODULES); //把模块名替换成数字ID

    return _bluebird.default.map(__MODULES, replaceRequireWithID);
  }).then(function (moduleContents) {
    return '[' + moduleContents.map(function (content) {
      return moduleTemplate.replace(/{{moduleContent}}/, content);
    }).join(',\n') + ']';
  }) //输出
  .then(function (modules) {
    return fs.readFileAsync("packSource.js", "utf-8").then(function (content) {
      return content + "(" + modules + ")";
    });
  }).then(_jsBeautify.js_beautify).then(log).then(function (result) {
    return fs.writeFileAsync(outputFile, result);
  }).then(function () {
    return console.log("bundle success!");
  });
} //递归打包的方法
//接收两个参数：moduleName是模块名，nowPath是当前路径


function bundleModule(moduleName, nowPath) {
  console.log("reading :", _path.default.normalize(nowPath + moduleName + '.js'));
  return fs.readFileAsync(_path.default.normalize(nowPath + moduleName + '.js'), 'utf-8').then(function (contents) {
    //在__MODULES中注册这个模块名
    __MODULES.push(_path.default.normalize(nowPath + moduleName));

    return contents;
  }).then(function (contents) {
    return matchRequire(contents);
  }) //解析出require
  .then(function (requires) {
    if (requires.length > 0) {
      //对每个require分别递归打包
      return _bluebird.default.map(requires, function (requireName) {
        return bundleModule(requireName, _path.default.dirname(nowPath + moduleName) + "/");
      });
    } else {
      return _bluebird.default.resolve();
    }
  });
} //把模块名替换成ID的方法
//接收一个参数：moduleName即模块名


function replaceRequireWithID(moduleName) {
  var dirPath = _path.default.dirname(moduleName) + '/';
  return fs.readFileAsync(moduleName + '.js', 'utf-8').then(function (code) {
    matchRequire(code).forEach(function (item) {
      var regRequire = new RegExp("require\\(\"" + item + "\"\\)|" + "require\\(\'" + item + "\'\\)");

      var modulePath = _path.default.normalize(dirPath + item);

      var moduleID = __MODULES.indexOf(modulePath);

      code = code.replace(regRequire, "require(" + moduleID + ")");
    });
    return code;
  });
} //解析依赖的模块名


function matchRequire(code) {
  var requires = code.match(/require\("\S*"\)|require\('\S*'\)/g) || [];
  return requires.map(function (item) {
    return item.match(/"\S*"|'\S*'/)[0];
  }).map(function (item) {
    return item.substring(1, item.length - 1);
  });
}

function log(a) {
  console.log(a);
  return a;
}
