#!/usr/bin/env node

const GitHubApi = require('github')
const fs = require('fs')
const program = require('commander')
const path = require('path')
const os = require('os')
const RegistryClient = require('npm-registry-client')
const chalk = require('chalk')
const thancPkg = require('./package.json')

const client = new RegistryClient({
  log: {
    verbose() {},
    info() {},
    verbose() {},
    http() {}
  }
})
const NPM_REGISTRY_URL = 'https://registry.npmjs.org'
const EXIT_FAILURE = 1
const CHUNK_SIZE = 35
const THANC_OWNER = 'wilk'
const THANC_REPO = 'thanc'
const github = new GitHubApi()

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

// generate lock file from package.json
const generateLockFile = async projectPath => {
  return new Promise((resolve, reject) => {
    // testing package.json (if it does exist or not)
    let packageJsonPath = path.resolve(projectPath, './package.json')
    try {
      fs.accessSync(packageJsonPath, fs.constants.R_OK)
    } catch (err) {
      console.log("☠  Cannot find package.json: make sure to specify a Node.js project folder ☠")
      return reject(err)
    }

    // creating tmp folder
    let tmpFolder
    try {
      tmpFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'thanc-'))
    } catch (err) {
      console.log("☠  Cannot create temporary folder on file system ☠")
      return reject(err)
    }

    // copying package.json into tmp folder
    try {
      fs.copyFileSync(packageJsonPath, `${tmpFolder}/package.json`)
    } catch (err) {
      console.log("☠  Cannot copy package.json file on temp folder ☠")
      return reject(err)
    }

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
        console.log("☠  Cannot load NPM ☠")
        return reject(err)
      }

      npm.commands.install(tmpFolder, [], err => {
        if (err) {
          console.log("☠  Cannot generate package-lock.json inside temp folder ☠")
          return reject(err)
        }

        resolve(`${tmpFolder}/package-lock.json`)
      })
    })
  })
}

// star repos and list them
const starReposList = ({chunk, github}) => {
  const promises = chunk.map(({owner, repo}) => {
    console.log(`⭐️   ${chalk.yellow('Thanks')} to ${chalk.yellow.bold(owner)} for ${chalk.yellow.bold(repo)}`)
    return github.activity.starRepo({owner, repo})
  })

  return Promise.all(promises)
}

// star repos and increment the progress bar
const starReposProgress = ({chunk, github, bar}) => {
  bar.tick()

  const promises = chunk.map(({owner, repo}) => github.activity.starRepo({owner, repo}))

  return Promise.all(promises)
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

  github.authenticate(auth)

  // testing credentials by starring "thanc" repo
  try {
    console.log('🔐  Testing github credentials... ')
    await github.activity.starRepo({owner: THANC_OWNER, repo: THANC_REPO})
  } catch (err) {
    let message = err.toString()
    try {message = JSON.parse(err.message).message} catch (err) {}
    console.log(message)

    process.exit(EXIT_FAILURE)
  }

  let manifest, manifestExists = true

  // looking for package.json file
  try {
    console.log('📄  Reading package-lock.json file... ')
    manifest = fs.readFileSync(path.resolve(projectPath, './package-lock.json'), 'utf-8')
  } catch (err) {
    manifestExists = false
  }

  if (!manifestExists) {
    try {
      console.log("⚡  ️package-lock.json does not exist in this folder ⚡️")
      process.stdout.write('⚙️  Generating a temporary package-lock.json from package.json... ')
      const manifestPath = await generateLockFile(projectPath)
      manifest = fs.readFileSync(manifestPath, 'utf-8')
    } catch (err) {
      console.log("☠️  Cannot generate package-lock.json file ☠️")
      console.error(err)

      process.exit(EXIT_FAILURE)
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

  // add thanc as a dependency to star
  if (program.me) manifest.dependencies[THANC_REPO] = {version: thancPkg.version}

  // generating deps repos promises
  const depsPromises = Object.keys(manifest.dependencies).map(dep => {
    return new Promise(resolve => {
      client.get(`${NPM_REGISTRY_URL}/${dep}`, {}, (err, data) => {
        // discard non-existing repos
        if (err || !data.versions[manifest.dependencies[dep].version]) resolve(null)
        else resolve(data.versions[manifest.dependencies[dep].version])
      })
    })
  })

  // getting deps repos
  let deps = []
  try {
    console.log('📦  Getting dependencies... ')
    deps = await Promise.all(depsPromises)
    deps = deps.filter(dep => dep !== null)
  } catch (err) {
    console.log('☠  Cannot fetch dependencies\' repos ☠')
    console.error(err)

    process.exit(EXIT_FAILURE)
  }

  // generating repos object: keys are repos and values are owners
  const repos = []
  deps.forEach((detail) => {
    if (!detail || !detail.repository || !detail.repository.url) return

    // covering /<owner>/<repo> urls
    const splitUrl = detail.repository.url.split('/')

    // covering also git@github.com:<owner>/<repo> urls
    let owner = splitUrl[splitUrl.length - 2]
    const ownerSplit = owner.split(':')
    if (ownerSplit.length > 1 && ownerSplit[1].length > 0) owner = ownerSplit[1]

    repos.push({owner, repo: splitUrl[splitUrl.length - 1].replace('.git', '')})
  })

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
      const ProgressBar = require('progress')

      bar = new ProgressBar("🌟  Starring dependencies... [:bar] :percent", {
        complete: '=',
        incomplete: ' ',
        width: 50,
        total: reposMatrix.length
      })

      starRepo = starReposProgress
    } else console.log("🌟  Starring dependencies...\n")

    let invalidRepoUrl = 0
    await reposMatrix.reduce(async (promise, chunk) => {
      try {
        await promise
        return starRepo({chunk, github, bar})
      } catch (err) {invalidRepoUrl++}
    }, Promise.resolve())
    console.log(`\n✨  Starred ${chalk.yellow.bold(repos.length - invalidRepoUrl)} repos! ✨`)
  } catch (err) {
    console.log('☠  Cannot star dependencies ☠')
    let message = err.toString()
    try {message = JSON.parse(err.message).message} catch (err) {}
    console.log(message)

    process.exit(EXIT_FAILURE)
  }
})()
