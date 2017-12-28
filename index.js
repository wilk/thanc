#!/usr/bin/env node

const axios = require('axios')
const prompt = require('prompt')
const fs = require('fs')
const program = require('commander')
const path = require('path')
const npm = require('npm')
const os = require('os')
const RegistryClient = require('npm-registry-client')
const ProgressBar = require('progress')

const client = new RegistryClient({
  log: {
    verbose() {},
    info() {},
    verbose() {},
    http() {}
  }
})
const NPM_REGISTRY_URL = 'https://registry.npmjs.org'
const GITHUB_API_URL = 'https://api.github.com'
const GITHUB_STAR_URL = `${GITHUB_API_URL}/user/starred`
const EXIT_FAILURE = 1
const thancPkg = require('./package.json')
const CHUNK_SIZE = 35

const schema = {
  properties: {
    username: {
      description: 'Your github username',
      type: 'string',
      required: true
    },
    password: {
      description: 'Your github password',
      type: 'string',
      hidden: true,
      required: true
    }
  }
}

// get user info
const getUserInfo = schema => {
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
      console.log('Cannot find package.json: make sure to specify a Node.js project folder')
      return reject(err)
    }

    // creating tmp folder
    let tmpFolder
    try {
      tmpFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'thanc-'))
    } catch (err) {
      console.log('Cannot create temporary folder on the file system')
      return reject(err)
    }

    // copying package.json into tmp folder
    try {
      fs.copyFileSync(packageJsonPath, `${tmpFolder}/package.json`)
    } catch (err) {
      console.log('Cannot copy package.json file on temp folder')
      return reject(err)
    }

    // loading npm
    // generating package-lock.json file, without installing deps, ignoring pre-post install scripts
    // and doing it silently
    // @todo: silent: true does not work, due to a regression bug: https://github.com/npm/npm/issues/7990#issuecomment-353955251
    npm.load({
      'package-lock-only': true,
      'ignore-scripts': true,
      loglevel: 'silent',
      progress: false
    }, err => {
      if (err) {
        console.log('Cannot load NPM')
        return reject(err)
      }

      npm.commands.install(tmpFolder, [], err => {
        if (err) {
          console.log('Cannot generate package-lock.json inside temp folder')
          return reject(err)
        }

        resolve(`${tmpFolder}/package-lock.json`)
      })
    })
  })
}

(async () => {
  let projectPath = '.'
  program
    .version(thancPkg.version)
    .usage('[options] <project_path>')
    .option('--me', 'thank thanc package and all of its dependencies')
    .option('-u, --username <username>', 'your Github username')
    .option('-p, --password <password>', 'your Github password')
    .arguments('<path>')
    .action(path => projectPath = path ? path : projectPath)
    .parse(process.argv)

  if (program.me) projectPath = __dirname

  let auth
  // non-interactive usage
  if (program.username && program.password) auth = {username: program.username, password: program.password}
  else {
    prompt.start()

    // getting credentials from the user
    try {
      auth = await getUserInfo(schema)
    } catch (err) {
      console.log('Cannot fetch github user credentials')
      console.error(err)

      process.exit(EXIT_FAILURE)
    }
  }

  // testing credentials
  try {
    process.stdout.write('Testing github credentials... ')
    await axios({url: GITHUB_API_URL, method: 'get', auth})
    console.log('done!')
  } catch (err) {
    if (err && err.response && err.response.data && err.response.data.message) console.log(err.response.data.message)
    else console.error(err)

    process.exit(EXIT_FAILURE)
  }

  let manifest, manifestExists = true

  // looking for package.json file
  try {
    process.stdout.write('Reading package-lock.json file... ')
    manifest = fs.readFileSync(path.resolve(projectPath, './package-lock.json'), 'utf-8')
  } catch (err) {
    manifestExists = false
  }

  if (!manifestExists) {
    try {
      process.stdout.write("\npackage-lock.json does not exist in this folder: generating it from package.json... ")
      const manifestPath = await generateLockFile(projectPath)
      manifest = fs.readFileSync(manifestPath, 'utf-8')
    } catch (err) {
      console.log('Cannot generate package-lock.json file')
      console.error(err)

      process.exit(EXIT_FAILURE)
    }
  }

  try {
    // parsing package-lock.json file
    manifest = JSON.parse(manifest)
  } catch (err) {
    console.log('Cannot parse package-lock.json file: invalid JSON')

    process.exit(EXIT_FAILURE)
  }

  console.log('done!')

  // add thanc as a dependency to star
  if (program.me) manifest.dependencies['thanc'] = {version: thancPkg.version}

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
    process.stdout.write('Getting dependencies... ')
    deps = await Promise.all(depsPromises)
    deps = deps.filter(dep => dep !== null)
    console.log('done!')
  } catch (err) {
    console.log('Cannot fetch dependencies\' repos')
    console.error(err)

    process.exit(EXIT_FAILURE)
  }

  // generating repos object: keys are repos and values are owners
  const repos = {}
  deps.forEach((detail) => {
    if (!detail || !detail.repository) return

    // covering /<owner>/<repo> urls
    const splitUrl = detail.repository.url.split('/')

    // covering also git@github.com:<owner>/<repo> urls
    let owner = splitUrl[splitUrl.length - 2]
    const ownerSplit = owner.split(':')
    if (ownerSplit.length > 1 && ownerSplit[1].length > 0) owner = ownerSplit[1]

    repos[splitUrl[splitUrl.length - 1].replace('.git', '')] = owner
  })

  const reposKeys = Object.keys(repos)
  let reposMatrix = []
  if (reposKeys.length > CHUNK_SIZE) {
    // split repos in subset of CHUNK_SIZE length
    const loops = Math.floor(reposKeys.length / CHUNK_SIZE)

    // fill the reposMatrix (array of arrays)
    for (let i = 0; i < loops; i++) {
      const chunk = []
      for (let j = 0; j < CHUNK_SIZE; j++) {
        chunk.push(reposKeys[(i * CHUNK_SIZE) + j])
      }

      reposMatrix.push(chunk)
    }

    // last array
    const diff = reposKeys.length % CHUNK_SIZE
    if (diff > 0) {
      const chunk = []
      for (let i = 0; i < diff; i++) {
        chunk.push(reposKeys[reposKeys.length - diff + i])
      }

      reposMatrix.push(chunk)
    }
  } else reposMatrix = reposKeys

  try {
    process.stdout.write('Starring dependencies... ')

    let invalidRepoUrl = 0
    const bar = new ProgressBar('  starring [:bar] :percent', {
      complete: '=',
      incomplete: ' ',
      width: 50,
      total: reposMatrix.length
    })

    await reposMatrix.reduce((promise, chunk) => {
      return promise.then(() => {
        bar.tick()

        const promises = chunk.map(repo => {
          return axios({url: `${GITHUB_STAR_URL}/${repos[repo]}/${repo}`, method: 'put', auth})
        })

        return Promise.all(promises)
      }).catch(() => invalidRepoUrl++)
    }, Promise.resolve())
    console.log('done!')
    console.log(`Starred ${Object.keys(repos).length - invalidRepoUrl} repos!`)
  } catch (err) {
    console.log('Cannot star dependencies')
    if (err && err.response && err.response.data && err.response.data.message) console.log(err.response.data.message)
    else console.error(err)

    process.exit(EXIT_FAILURE)
  }
})()
