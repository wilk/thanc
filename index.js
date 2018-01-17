#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const os = require('os')
const https = require('https')

const program = require('commander')
const chalk = require('chalk')
const ProgressBar = require('progress')
const fetch = require('node-fetch')

const thancPkg = require('./package.json')

const NPM_REGISTRY_URL = 'https://registry.npmjs.org'
const GITHUB_API_URL = 'https://api.github.com'
const GITHUB_RAW_CONTENT = 'https://raw.githubusercontent.com'
const EXIT_FAILURE = 1
const CHUNK_SIZE = 35
const THANC_REPO = 'thanc'
const PROGRESS_BAR_BASE_CONFIG = {
  complete: '=',
  incomplete: ' ',
  width: 50
}

const authTypeSchema = {
  properties: {
    type: {
      description: 'Define the Github authentication type you want to use (basic or token)',
      message: 'The authentication types supported are "basic" and "token"',
      required: true,
      type: 'string',
      pattern: /\b(basic|token)\b/
    }
  }
}

const basicAuthSchema = {
  properties: {
    username: {
      description: 'Your Github username',
      type: 'string',
      required: true
    },
    password: {
      description: 'Your Github password',
      type: 'string',
      hidden: true,
      required: true
    }
  }
}

const tokenAuthSchema = {
  properties: {
    token: {
      description: 'Your Github token',
      type: 'string',
      required: true
    }
  }
}

// prompt get wrapper with promise
const promptGetAsync = (prompt, schema) => {
  return new Promise((resolve, reject) => {
    prompt.get(schema, function (err, data) {
      if (err) reject(err)
      else resolve(data)
    })
  })
}

// npm async install command
const npmLoad = tmpFolder => {
  return new Promise((resolve, reject) => {
    // lazy loading for npm (used just in this case)
    const npm = require('npm')

    // loading npm
    // generating package-lock.json file, without installing deps, ignoring pre-post install scripts
    // and doing it silently
    npm.load({
      'package-lock-only': true,
      'ignore-scripts': true,
      loglevel: 'silent',
      progress: false
    }, err => {
      if (err) {
        console.log("\n☠  Cannot load NPM ☠")
        return reject(err)
      }

      npm.commands.install(tmpFolder, [], err => {
        if (err) {
          console.log("\n☠  Cannot generate package-lock.json inside temp folder ☠")
          return reject(err)
        }

        resolve(`${tmpFolder}/package-lock.json`)
      })
    })
  })
}

// generate lock file from in memory package.json
const generateLockFileInMemory = pkgJson => {
  return new Promise(async (resolve, reject) => {
    // creating tmp folder
    let tmpFolder
    try {
      tmpFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'thanc-'))
    } catch (err) {
      console.log("\n☠  Cannot create temporary folder on file system ☠")
      return reject(err)
    }

    try {
      fs.writeFileSync(path.resolve(tmpFolder, './package.json'), JSON.stringify(pkgJson))
    } catch (err) {
      console.log("\n☠  Cannot write package.json file on temp folder ☠")
      return reject(err)
    }

    try {
      const res = await npmLoad(tmpFolder)
      resolve(res)
    } catch (err) {
      reject(err)
    }
  })
}

// generate lock file from package.json
const generateLockFile = projectPath => {
  return new Promise(async (resolve, reject) => {
    // testing package.json (if it does exist or not)
    let packageJsonPath = path.resolve(projectPath, './package.json')
    try {
      fs.accessSync(packageJsonPath, fs.constants.R_OK)
    } catch (err) {
      console.log("\n☠  Cannot find package.json: make sure to specify a Node.js project folder ☠")
      return reject(err)
    }

    // creating tmp folder
    let tmpFolder
    try {
      tmpFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'thanc-'))
    } catch (err) {
      console.log("\n☠  Cannot create temporary folder on file system ☠")
      return reject(err)
    }

    // copying package.json into tmp folder
    try {
      fs.copyFileSync(packageJsonPath, `${tmpFolder}/package.json`)
    } catch (err) {
      console.log("\n☠  Cannot copy package.json file on temp folder ☠")
      return reject(err)
    }

    try {
      const res = await npmLoad(tmpFolder)
      resolve(res)
    } catch (err) {
      reject(err)
    }
  })
}

// star repos and list them
const starReposList = ({chunk, auth}) => {
  const promises = chunk.map(({owner, repo}) => {
    console.log(`⭐️   ${chalk.yellow('Thanks')} to ${chalk.yellow.bold(owner)} for ${chalk.yellow.bold(repo)}`)
    return fetch(`${GITHUB_API_URL}/user/starred/${owner}/${repo}`, {method: 'PUT', headers: generateGithubHeaders(auth)})
  })

  return Promise.all(promises)
}

// star repos and increment the progress bar
const starReposProgress = ({chunk, auth, bar}) => {
  bar.tick()

  const promises = chunk.map(({owner, repo}) => fetch(`${GITHUB_API_URL}/user/starred/${owner}/${repo}`, {method: 'PUT', headers: generateGithubHeaders(auth)}))

  return Promise.all(promises)
}

// generate an array of dependencies, parsing the dependencies tree
const parseDependenciesTree = deps => {
  const dependencies = []

  for (let dep in deps) {
    dependencies.push({name: dep, version: deps[dep].version})

    if (deps[dep].dependencies) dependencies.push(...parseDependenciesTree(deps[dep].dependencies))
  }

  return dependencies
}

// generate github headers
const generateGithubHeaders = auth => {
  return {
    accept: 'application/vnd.github.v3+json',
    authorization: auth.token ? `token ${auth.token}` : `Basic ${new Buffer(auth.username + ':' + auth.password).toString('base64')}`
  }
}

(async () => {
  let projectPath = '.'
  program
    .version(thancPkg.version)
    .usage('[options] <project_path>')
    .option('--me', 'thank thanc package and all of its dependencies')
    .option('-u, --username <username>', 'your Github username')
    .option('-p, --password <password>', 'your Github password')
    .option('-t, --token <password>', 'your Github token')
    .option('-q, --quite', 'Show only the progress bar instead of the repos list')
    .arguments('<path>')
    .action(path => projectPath = path ? path : projectPath)
    .parse(process.argv)

  if (program.me) projectPath = __dirname

  let auth
  // non-interactive usage
  if (program.token || process.env.GITHUB_TOKEN) auth = {type: 'token', token: program.token || process.env.GITHUB_TOKEN}
  else if (program.username && program.password) auth = {type: 'basic', username: program.username, password: program.password}
  else {
    // lazy loading for prompt (used just in this case)
    const prompt = require('prompt')
    prompt.start()

    // getting auth type and user credentials
    try {
      const authType = await promptGetAsync(prompt, authTypeSchema)

      if (authType.type === 'token') auth = await promptGetAsync(prompt, tokenAuthSchema)
      else auth = await promptGetAsync(prompt, basicAuthSchema)

      auth.type = authType.type
    } catch (err) {
      console.log("\n☠  Cannot fetch github user credentials ☠")
      console.error(err)

      process.exit(EXIT_FAILURE)
    }
  }

  // testing credentials by fetching user's rate limit
  try {
    console.log('🔐  Testing github credentials... ')
    const res = await fetch(`${GITHUB_API_URL}/rate_limit`, {headers: generateGithubHeaders(auth)})
    const data = await res.json()

    if (data.rate.remaining === 0) {
      console.log(`☠  Rate limit exceeded: (https://developer.github.com/v3/#rate-limiting 😞  ). Retry again next hour 👊  ☠`)
      process.exit(EXIT_FAILURE)
    } else {
      const rateLimitMsg = chalk.yellow.bold(`${data.rate.limit - data.rate.remaining}/${data.rate.limit}`)
      console.log(`⏳  You rate limit is ${rateLimitMsg} for this hour, so you still have ${chalk.yellow.bold(data.rate.remaining)} star to give!`)
    }
  } catch (err) {
    let message = err.toString()
    try {message = JSON.parse(err.message).message} catch (err) {}

    message = `☠  ${message} ☠`
    console.log(message)

    process.exit(EXIT_FAILURE)
  }

  let manifest, manifestExists = true

  // checking if path is an URL
  if (projectPath.startsWith('https://github.com')) {
    const urlSplit = projectPath.split('/'),
      owner = urlSplit[urlSplit.length - 2],
      repo = urlSplit[urlSplit.length - 1]

    let pkg
    try {
      console.log('🔗  Downloading package.json from Github... ')
      const res = await fetch(`${GITHUB_RAW_CONTENT}/${owner}/${repo}/master/package.json`)
      pkg = await res.json()
    } catch (err) {
      console.log('☠️  Cannot download package.json file ☠️')

      process.exit(EXIT_FAILURE)
    }

    try {
      console.log('⚙️  Generating a temporary package-lock.json from package.json... ')
      const manifestPath = await generateLockFileInMemory(pkg)
      manifest = fs.readFileSync(manifestPath, 'utf-8')
    } catch (err) {
      console.log('☠️  Cannot generate package-lock.json file ☠️')

      process.exit(EXIT_FAILURE)
    }
  } else {
    // looking for package.json file
    try {
      console.log('📄  Reading package-lock.json file... ')
      manifest = fs.readFileSync(path.resolve(projectPath, './package-lock.json'), 'utf-8')
    } catch (err) {
      manifestExists = false
    }

    if (!manifestExists) {
      try {
        console.log('⚡  ️package-lock.json does not exist in this folder ⚡️')
        process.stdout.write('⚙️  Generating a temporary package-lock.json from package.json... ')
        const manifestPath = await generateLockFile(projectPath)
        manifest = fs.readFileSync(manifestPath, 'utf-8')
      } catch (err) {
        console.log('☠️  Cannot generate package-lock.json file ☠️')

        process.exit(EXIT_FAILURE)
      }
    }
  }

  try {
    // parsing package-lock.json file
    manifest = JSON.parse(manifest)
  } catch (err) {
    console.log("\n☠  Cannot parse package-lock.json file: invalid JSON ☠")

    process.exit(EXIT_FAILURE)
  }

  if (manifest.dependencies === null || typeof manifest.dependencies === 'undefined') {
    console.log('☠  This project has no dependencies to star ☠')

    process.exit(EXIT_FAILURE)
  }

  // build dependencies array
  let dependencies = parseDependenciesTree(manifest.dependencies)

  // add thanc as a dependency to star
  if (program.me) dependencies.push({name: THANC_REPO, version: thancPkg.version})

  // remove duplicates (same name and same version)
  // packages with different versions might have different repo url
  dependencies = dependencies.reduce((acc, dep) => {
    if (acc.findIndex(({name, version}) => dep.name === name && dep.version === version) === -1) acc.push(dep)

    return acc
  }, [])

  if (dependencies.length === 0) {
    console.log('☠  This project has no dependencies to star ☠')

    process.exit(EXIT_FAILURE)
  }

  // generating deps repos promises
  const depsBar = new ProgressBar('📦  Getting dependencies info... [:bar] :percent', Object.assign({}, PROGRESS_BAR_BASE_CONFIG, {total: dependencies.length}))
  const depsPromises = dependencies.map(async ({name, version}) => {
    try {
      // encode scoped packages: @user/package -> @user%2f
      // due to this: https://github.com/npm/npm-registry-client/issues/123#issuecomment-154840629
      const encodedDep = name.replace(/\//g, '%2f')
      const res = await fetch(`${NPM_REGISTRY_URL}/${encodedDep}`)
      const data = await res.json()
      depsBar.tick()
      return Promise.resolve(data.versions[version])
    } catch (err) {
      depsBar.tick()
      return Promise.resolve(null)
    }
  })

  // getting deps repos
  let deps = []
  try {
    deps = await Promise.all(depsPromises)
    deps = deps.filter(dep => dep !== null)
  } catch (err) {
    console.log('☠  Cannot fetch dependencies\' info ☠')
    console.error(err)

    process.exit(EXIT_FAILURE)
  }

  // generating repos object: keys are repos and values are owners
  let repos = []
  deps.forEach((detail) => {
    if (!detail || !detail.repository || !detail.repository.url || !detail.repository.url.includes('github.com')) return

    // covering /<owner>/<repo> urls
    const splitUrl = detail.repository.url.split('/')

    // covering also git@github.com:<owner>/<repo> urls
    let owner = splitUrl[splitUrl.length - 2]
    const ownerSplit = owner.split(':')
    if (ownerSplit.length > 1 && ownerSplit[1].length > 0) owner = ownerSplit[1]

    repos.push({owner, repo: splitUrl[splitUrl.length - 1].replace('.git', ''), url: detail.repository.url})
  })

  // remove duplicates with same repo url, even with different version
  repos = repos.reduce((acc, repository) => {
    if (acc.findIndex(({owner, repo, url}) => repository.owner === owner && repository.repo === repo && repository.url === url) === -1) acc.push(repository)

    return acc
  }, [])

  // sort by owner asc
  repos.sort((a, b) => {
    if (a.owner.toLowerCase() < b.owner.toLowerCase()) return -1
    if (a.owner.toLowerCase() > b.owner.toLowerCase()) return 1
    return 0
  })

  let reposMatrix = []
  if (repos.length > CHUNK_SIZE) {
    // split repos in subset of CHUNK_SIZE length
    const loops = Math.floor(repos.length / CHUNK_SIZE)

    // fill the reposMatrix (array of arrays)
    for (let i = 0; i < loops; i++) {
      const chunk = []
      for (let j = 0; j < CHUNK_SIZE; j++) {
        chunk.push(repos[(i * CHUNK_SIZE) + j])
      }

      reposMatrix.push(chunk)
    }

    // last array
    const diff = repos.length % CHUNK_SIZE
    if (diff > 0) {
      const chunk = []
      for (let i = 0; i < diff; i++) {
        chunk.push(repos[repos.length - diff + i])
      }

      reposMatrix.push(chunk)
    }
  } else reposMatrix = repos

  try {
    let starRepo = starReposList, bar
    if (program.quite) {
      bar = new ProgressBar('🌟  Starring dependencies... [:bar] :percent', Object.assign({}, PROGRESS_BAR_BASE_CONFIG, {total: reposMatrix.length}))

      starRepo = starReposProgress
    } else console.log("🌟  Starring dependencies...\n")

    let invalidRepoUrl = 0
    await reposMatrix.reduce(async (promise, chunk) => {
      try {
        await promise
        return starRepo({chunk, auth, bar})
      } catch (err) {invalidRepoUrl++}
    }, Promise.resolve())
    console.log(`\n✨  Starred ${chalk.yellow.bold(repos.length - invalidRepoUrl)} repos! ✨`)
  } catch (err) {
    console.log('☠  Cannot star dependencies ☠')
    let message = err.toString()
    try {message = JSON.parse(err.message).message} catch (err) {}

    if (message.includes('API rate limit exceeded')) message = `☠  ${message} (https://developer.github.com/v3/#rate-limiting 😞). Retry again next hour 👊 ☠`
    else message = `☠  ${message} ☠`

    console.log(message)

    process.exit(EXIT_FAILURE)
  }
})()
