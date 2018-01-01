#!/usr/bin/env node
'use strict';var _assign=require('babel-runtime/core-js/object/assign'),_assign2=_interopRequireDefault(_assign),_toConsumableArray2=require('babel-runtime/helpers/toConsumableArray'),_toConsumableArray3=_interopRequireDefault(_toConsumableArray2),_regenerator=require('babel-runtime/regenerator'),_regenerator2=_interopRequireDefault(_regenerator),_asyncToGenerator2=require('babel-runtime/helpers/asyncToGenerator'),_asyncToGenerator3=_interopRequireDefault(_asyncToGenerator2),_promise=require('babel-runtime/core-js/promise'),_promise2=_interopRequireDefault(_promise);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj}}var fs=require('fs'),path=require('path'),os=require('os'),https=require('https'),GitHubApi=require('github'),program=require('commander'),chalk=require('chalk'),ProgressBar=require('progress'),thancPkg=require('./package.json'),NPM_REGISTRY_URL='https://registry.npmjs.org',EXIT_FAILURE=1,CHUNK_SIZE=35,THANC_OWNER='wilk',THANC_REPO='thanc',github=new GitHubApi,PROGRESS_BAR_BASE_CONFIG={complete:'=',incomplete:' ',width:50},authTypeSchema={properties:{type:{description:'Define the Github authentication type you want to use (basic or token)',message:'The authentication types supported are "basic" and "token"',required:!0,type:'string',pattern:/\b(basic|token)\b/}}},basicAuthSchema={properties:{username:{description:'Your Github username',type:'string',required:!0},password:{description:'Your Github password',type:'string',hidden:!0,required:!0}}},tokenAuthSchema={properties:{token:{description:'Your Github token',type:'string',required:!0}}},promptGetAsync=function(prompt,schema){return new _promise2.default(function(resolve,reject){prompt.get(schema,function(err,data){err?reject(err):resolve(data)})})},generateLockFile=function(){var _ref=(0,_asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(projectPath){return _regenerator2.default.wrap(function(_context){for(;;)switch(_context.prev=_context.next){case 0:return _context.abrupt('return',new _promise2.default(function(resolve,reject){var packageJsonPath=path.resolve(projectPath,'./package.json');try{fs.accessSync(packageJsonPath,fs.constants.R_OK)}catch(err){return console.log('\n\u2620  Cannot find package.json: make sure to specify a Node.js project folder \u2620'),reject(err)}var tmpFolder;try{tmpFolder=fs.mkdtempSync(path.join(os.tmpdir(),'thanc-'))}catch(err){return console.log('\n\u2620  Cannot create temporary folder on file system \u2620'),reject(err)}try{fs.copyFileSync(packageJsonPath,`${tmpFolder}/package.json`)}catch(err){return console.log('\n\u2620  Cannot copy package.json file on temp folder \u2620'),reject(err)}var npm=require('npm');npm.load({"package-lock-only":!0,"ignore-scripts":!0,loglevel:'silent',progress:!1},function(err){return err?(console.log('\n\u2620  Cannot load NPM \u2620'),reject(err)):void npm.commands.install(tmpFolder,[],function(err){return err?(console.log('\n\u2620  Cannot generate package-lock.json inside temp folder \u2620'),reject(err)):void resolve(`${tmpFolder}/package-lock.json`)})})}));case 1:case'end':return _context.stop();}},_callee,void 0)}));return function(){return _ref.apply(this,arguments)}}(),starReposList=function(_ref2){var chunk=_ref2.chunk,github=_ref2.github,promises=chunk.map(function(_ref3){var owner=_ref3.owner,repo=_ref3.repo;return console.log(`⭐️   ${chalk.yellow('Thanks')} to ${chalk.yellow.bold(owner)} for ${chalk.yellow.bold(repo)}`),github.activity.starRepo({owner,repo})});return _promise2.default.all(promises)},starReposProgress=function(_ref4){var chunk=_ref4.chunk,github=_ref4.github,bar=_ref4.bar;bar.tick();var promises=chunk.map(function(_ref5){var owner=_ref5.owner,repo=_ref5.repo;return github.activity.starRepo({owner,repo})});return _promise2.default.all(promises)},parseDependenciesTree=function(deps){var dependencies=[];for(var dep in deps)dependencies.push({name:dep,version:deps[dep].version}),deps[dep].dependencies&&dependencies.push.apply(dependencies,(0,_toConsumableArray3.default)(parseDependenciesTree(deps[dep].dependencies)));return dependencies},httpGetWrapper=function(url,version){return new _promise2.default(function(resolve){https.get(url,function(res){var err,statusCode=res.statusCode,contentType=res.headers['content-type'];if(200===statusCode?!/^application\/json/.test(contentType)&&(err=new Error(`Invalid content-type.\nExpected application/json but received ${contentType}`)):err=new Error(`Request Failed.\nStatus Code: ${statusCode}`),err)return res.resume(),resolve(null);res.setEncoding('utf8');var rawData='';res.on('data',function(chunk){return rawData+=chunk}),res.on('end',function(){try{var data=JSON.parse(rawData);resolve(data.versions[version])}catch(err){resolve(null)}})}).on('error',function(){return resolve(null)})})};(0,_asyncToGenerator3.default)(_regenerator2.default.mark(function _callee4(){var projectPath,auth,prompt,authType,message,manifest,manifestExists,manifestPath,dependencies,depsBar,depsPromises,deps,repos,reposMatrix,loops,i,chunk,j,diff,_chunk,_i,starRepo,bar,invalidRepoUrl,_message;return _regenerator2.default.wrap(function(_context4){for(;;)switch(_context4.prev=_context4.next){case 0:if(projectPath='.',program.version(thancPkg.version).usage('[options] <project_path>').option('--me','thank thanc package and all of its dependencies').option('-u, --username <username>','your Github username').option('-p, --password <password>','your Github password').option('-t, --token <password>','your Github token').option('-q, --quite','Show only the progress bar instead of the repos list').arguments('<path>').action(function(path){return projectPath=path?path:projectPath}).parse(process.argv),program.me&&(projectPath=__dirname),auth=void 0,!(program.token||process.env.GITHUB_TOKEN)){_context4.next=8;break}auth={type:'token',token:program.token||process.env.GITHUB_TOKEN},_context4.next=35;break;case 8:if(!(program.username&&program.password)){_context4.next=12;break}auth={type:'basic',username:program.username,password:program.password},_context4.next=35;break;case 12:return prompt=require('prompt'),prompt.start(),_context4.prev=14,_context4.next=17,promptGetAsync(prompt,authTypeSchema);case 17:if(authType=_context4.sent,'token'!==authType.type){_context4.next=24;break}return _context4.next=21,promptGetAsync(prompt,tokenAuthSchema);case 21:auth=_context4.sent,_context4.next=27;break;case 24:return _context4.next=26,promptGetAsync(prompt,basicAuthSchema);case 26:auth=_context4.sent;case 27:auth.type=authType.type,_context4.next=35;break;case 30:_context4.prev=30,_context4.t0=_context4['catch'](14),console.log('\n\u2620  Cannot fetch github user credentials \u2620'),console.error(_context4.t0),process.exit(EXIT_FAILURE);case 35:return github.authenticate(auth),_context4.prev=36,console.log('\uD83D\uDD10  Testing github credentials... '),_context4.next=40,github.activity.starRepo({owner:THANC_OWNER,repo:THANC_REPO});case 40:_context4.next=49;break;case 42:_context4.prev=42,_context4.t1=_context4['catch'](36),message=_context4.t1.toString();try{message=JSON.parse(_context4.t1.message).message}catch(err){}message=message.includes('API rate limit exceeded')?`☠  ${message} (https://developer.github.com/v3/#rate-limiting 😞). Retry again next hour 👊 ☠`:`☠  ${message} ☠`,console.log(message),process.exit(EXIT_FAILURE);case 49:manifest=void 0,manifestExists=!0;try{console.log('\uD83D\uDCC4  Reading package-lock.json file... '),manifest=fs.readFileSync(path.resolve(projectPath,'./package-lock.json'),'utf-8')}catch(err){manifestExists=!1}if(manifestExists){_context4.next=65;break}return _context4.prev=52,console.log('\u26A1  \uFE0Fpackage-lock.json does not exist in this folder \u26A1\uFE0F'),process.stdout.write('\u2699\uFE0F  Generating a temporary package-lock.json from package.json... '),_context4.next=57,generateLockFile(projectPath);case 57:manifestPath=_context4.sent,manifest=fs.readFileSync(manifestPath,'utf-8'),_context4.next=65;break;case 61:_context4.prev=61,_context4.t2=_context4['catch'](52),console.log('\u2620\uFE0F  Cannot generate package-lock.json file \u2620\uFE0F'),process.exit(EXIT_FAILURE);case 65:try{manifest=JSON.parse(manifest)}catch(err){console.log('\n\u2620  Cannot parse package-lock.json file: invalid JSON \u2620'),process.exit(EXIT_FAILURE)}return(null===manifest.dependencies||'undefined'==typeof manifest.dependencies)&&(console.log('\u2620  This project has no dependencies to star \u2620'),process.exit(EXIT_FAILURE)),dependencies=parseDependenciesTree(manifest.dependencies),program.me&&dependencies.push({name:THANC_REPO,version:thancPkg.version}),dependencies=dependencies.reduce(function(acc,dep){return-1===acc.findIndex(function(_ref7){var name=_ref7.name,version=_ref7.version;return dep.name===name&&dep.version===version})&&acc.push(dep),acc},[]),depsBar=new ProgressBar('\uD83D\uDCE6  Getting dependencies info... [:bar] :percent',(0,_assign2.default)({},PROGRESS_BAR_BASE_CONFIG,{total:dependencies.length})),depsPromises=dependencies.map(function(){var _ref9=(0,_asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2(_ref8){var encodedDep,dep,name=_ref8.name,version=_ref8.version;return _regenerator2.default.wrap(function(_context2){for(;;)switch(_context2.prev=_context2.next){case 0:return encodedDep=name.replace(/\//g,'%2f'),_context2.next=3,httpGetWrapper(`${NPM_REGISTRY_URL}/${encodedDep}`,version);case 3:return dep=_context2.sent,depsBar.tick(),_context2.abrupt('return',_promise2.default.resolve(dep));case 6:case'end':return _context2.stop();}},_callee2,void 0)}));return function(){return _ref9.apply(this,arguments)}}()),deps=[],_context4.prev=73,_context4.next=76,_promise2.default.all(depsPromises);case 76:deps=_context4.sent,deps=deps.filter(function(dep){return null!==dep}),_context4.next=85;break;case 80:_context4.prev=80,_context4.t3=_context4['catch'](73),console.log('\u2620  Cannot fetch dependencies\' info \u2620'),console.error(_context4.t3),process.exit(EXIT_FAILURE);case 85:if(repos=[],deps.forEach(function(detail){if(detail&&detail.repository&&detail.repository.url&&detail.repository.url.includes('github.com')){var splitUrl=detail.repository.url.split('/'),owner=splitUrl[splitUrl.length-2],ownerSplit=owner.split(':');1<ownerSplit.length&&0<ownerSplit[1].length&&(owner=ownerSplit[1]),repos.push({owner,repo:splitUrl[splitUrl.length-1].replace('.git',''),url:detail.repository.url})}}),repos=repos.reduce(function(acc,repository){return-1===acc.findIndex(function(_ref10){var owner=_ref10.owner,repo=_ref10.repo,url=_ref10.url;return repository.owner===owner&&repository.repo===repo&&repository.url===url})&&acc.push(repository),acc},[]),repos.sort(function(a,b){return a.owner.toLowerCase()<b.owner.toLowerCase()?-1:a.owner.toLowerCase()>b.owner.toLowerCase()?1:0}),reposMatrix=[],repos.length>CHUNK_SIZE){for(loops=Math.floor(repos.length/CHUNK_SIZE),i=0;i<loops;i++){for(chunk=[],j=0;j<CHUNK_SIZE;j++)chunk.push(repos[i*CHUNK_SIZE+j]);reposMatrix.push(chunk)}if(diff=repos.length%CHUNK_SIZE,0<diff){for(_chunk=[],_i=0;_i<diff;_i++)_chunk.push(repos[repos.length-diff+_i]);reposMatrix.push(_chunk)}}else reposMatrix=repos;return _context4.prev=91,starRepo=starReposList,bar=void 0,program.quite?(bar=new ProgressBar('\uD83C\uDF1F  Starring dependencies... [:bar] :percent',{complete:'=',incomplete:' ',width:50,total:reposMatrix.length}),starRepo=starReposProgress):console.log('\uD83C\uDF1F  Starring dependencies...\n'),invalidRepoUrl=0,_context4.next=97,reposMatrix.reduce(function(){var _ref11=(0,_asyncToGenerator3.default)(_regenerator2.default.mark(function _callee3(promise,chunk){return _regenerator2.default.wrap(function(_context3){for(;;)switch(_context3.prev=_context3.next){case 0:return _context3.prev=0,_context3.next=3,promise;case 3:return _context3.abrupt('return',starRepo({chunk,github,bar}));case 6:_context3.prev=6,_context3.t0=_context3['catch'](0),invalidRepoUrl++;case 9:case'end':return _context3.stop();}},_callee3,void 0,[[0,6]])}));return function(){return _ref11.apply(this,arguments)}}(),_promise2.default.resolve());case 97:console.log(`\n✨  Starred ${chalk.yellow.bold(repos.length-invalidRepoUrl)} repos! ✨`),_context4.next=108;break;case 100:_context4.prev=100,_context4.t4=_context4['catch'](91),console.log('\u2620  Cannot star dependencies \u2620'),_message=_context4.t4.toString();try{_message=JSON.parse(_context4.t4.message).message}catch(err){}_message=_message.includes('API rate limit exceeded')?`☠  ${_message} (https://developer.github.com/v3/#rate-limiting 😞). Retry again next hour 👊 ☠`:`☠  ${_message} ☠`,console.log(_message),process.exit(EXIT_FAILURE);case 108:case'end':return _context4.stop();}},_callee4,void 0,[[14,30],[36,42],[52,61],[73,80],[91,100]])}))();
